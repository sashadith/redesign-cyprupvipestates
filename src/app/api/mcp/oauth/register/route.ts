import { NextRequest, NextResponse } from "next/server";
import { validateRegistration } from "@/lib/mcp/auth/clientsValidate";
import { registerClient } from "@/lib/mcp/auth/clients";
import { makeRateLimiter } from "@/lib/antispam";

export const dynamic = "force-dynamic";

// Anyone can register (RFC 7591 open registration) — the redirect-URI
// allow-list is what keeps that harmless. Still throttled so a script can't
// fill the table.
const limiter = makeRateLimiter();

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limiter(`register:${ip}`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: "invalid_request", error_description: "Too many registrations." }, { status: 429, headers: cors });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata", error_description: "Body must be JSON." }, { status: 400, headers: cors });
  }
  const v = validateRegistration(body);
  if (!v.ok) return NextResponse.json({ error: v.error, error_description: v.description }, { status: 400, headers: cors });
  const { clientId } = await registerClient(v);
  return NextResponse.json(
    {
      client_id: clientId,
      client_name: v.clientName ?? undefined,
      redirect_uris: v.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201, headers: cors },
  );
}
