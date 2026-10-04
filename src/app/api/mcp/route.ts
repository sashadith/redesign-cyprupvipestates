import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { verifyAccessToken } from "@/lib/mcp/auth/tokens";
import { getMcpPublicOrigin } from "@/lib/mcp/publicOrigin";
import { MCP_INSTRUCTIONS } from "@/lib/mcp/instructions";
import { registerReadTools, registerWriteTools } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Stateless streamable HTTP (no sessions, no Redis) — safe under the 2-instance
// PM2 cluster. GET/DELETE (session operations) answer 405 from the handler.
const handler = createMcpHandler(
  (server) => {
    registerReadTools(server);
    registerWriteTools(server);
  },
  {
    // The icon is served with an OPAQUE light background on purpose. Every icon
    // the site itself publishes — favicon.ico, icon.png, apple-icon.png and both
    // manifest icons — is a transparent gold line-drawing, and clients that place
    // a transparent icon on their own dark tile render it as thin gold lines on
    // near-black (measured ~#121509 in the claude.ai connector list, which is not
    // the manifest's #142E2D — the tile is the client's, not ours). Carrying our
    // own background is the only way to control that, and it is why these files
    // exist separately from the site's icon set rather than replacing it.
    //
    // The cast is narrow and deliberate: createMcpHandler types this option as
    // `{ name, version }`, but the value is handed straight to the Server as an
    // `Implementation` (dist/mcp-*.mjs:457 spreads it verbatim into
    // _meta["io.modelcontextprotocol/serverInfo"]), and `Implementation` in the
    // protocol schema carries title/websiteUrl/icons. The option type is simply
    // narrower than what is forwarded. Whether a given client renders `icons` is
    // up to that client — if claude.ai ignores them, this is inert metadata.
    serverInfo: {
      name: "cyprus-vip-estates-crm",
      version: "1.0.0",
      title: "Cyprus VIP Estates CRM",
      websiteUrl: "https://cyprusvipestates.com",
      icons: [
        { src: "https://cyprusvipestates.com/icons/mcp-icon-512.png", mimeType: "image/png", sizes: ["512x512"] },
        { src: "https://cyprusvipestates.com/icons/mcp-icon-192.png", mimeType: "image/png", sizes: ["192x192"] },
      ],
    } as { name: string; version: string },
    instructions: MCP_INSTRUCTIONS,
    capabilities: { tools: {} },
  },
);

// Bearer verification. On failure withMcpAuth answers 401 with
// WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource",
// which is what makes claude.ai (re)start the OAuth flow.
async function verifyToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  const v = await verifyAccessToken(bearer);
  if (!v) return undefined;
  return {
    token: bearer,
    clientId: v.clientId,
    scopes: ["crm"],
    expiresAt: Math.floor(v.expiresAt.getTime() / 1000),
    extra: { userId: v.userId, userName: v.userName, tokenId: v.tokenId },
  };
}

function authed() {
  const origin = getMcpPublicOrigin(); // throws McpConfigError → 500 with the message, deliberately loud
  return withMcpAuth(handler, verifyToken, {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
    // mcp-handler 2.1.1 concatenates this verbatim with resourceMetadataPath
    // (resourceMetadataUrl = `${resourceUrl}${resourceMetadataPath}`), so this
    // must be the bare origin, not `${origin}${MCP_RESOURCE_PATH}` — the
    // latter double-prefixes the challenge's resource_metadata URL with
    // /api/mcp, which 404s (the metadata document is only rewritten from the
    // top-level /.well-known/... path — see next.config.mjs).
    resourceUrl: origin,
  });
}

export async function POST(req: Request) {
  return authed()(req);
}
export async function GET(req: Request) {
  return authed()(req);
}
export async function DELETE(req: Request) {
  return authed()(req);
}
