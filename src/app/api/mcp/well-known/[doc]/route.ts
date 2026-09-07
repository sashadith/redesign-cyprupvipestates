import { NextResponse } from "next/server";
import { getMcpPublicOrigin, McpConfigError } from "@/lib/mcp/publicOrigin";
import { authorizationServerMetadata, protectedResourceMetadata } from "@/lib/mcp/auth/metadata";

export const dynamic = "force-dynamic";

// Reached via next.config.mjs rewrites from /.well-known/oauth-authorization-server
// and /.well-known/oauth-protected-resource (the .well-known prefix itself is
// excluded from the intl middleware in src/middleware.ts — without that, the
// request is rewritten to /en/.well-known/... and 404s).
export async function GET(_req: Request, { params }: { params: { doc: string } }) {
  let origin: string;
  try {
    origin = getMcpPublicOrigin();
  } catch (e) {
    if (e instanceof McpConfigError) return NextResponse.json({ error: "server_error", error_description: e.message }, { status: 500 });
    throw e;
  }
  const body =
    params.doc === "oauth-authorization-server" ? authorizationServerMetadata(origin)
    : params.doc === "oauth-protected-resource" ? protectedResourceMetadata(origin)
    : null;
  if (!body) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*" },
  });
}
