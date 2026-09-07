import { NextRequest, NextResponse } from "next/server";
import { parseTokenRequest } from "@/lib/mcp/auth/grants";
import { exchangeAuthorizationCode, refreshTokens } from "@/lib/mcp/auth/tokens";
import { getMcpPublicOrigin, McpConfigError } from "@/lib/mcp/publicOrigin";
import { makeRateLimiter } from "@/lib/antispam";

export const dynamic = "force-dynamic";

// 10 token requests per client id and source IP per 15 minutes → 429. The
// limiter counts every call (successes included); a healthy client refreshes
// about once per 8 h, so only abuse gets near the cap, and keying on the IP
// means a third party who knows the public client_id cannot lock the real
// client out.
const tokenRequests = makeRateLimiter();
const FAIL_WINDOW_MS = 15 * 60_000;

const headers = { "Cache-Control": "no-store", Pragma: "no-cache", "Access-Control-Allow-Origin": "*" };
const oauthError = (status: number, error: string, description: string) =>
  NextResponse.json({ error, error_description: description }, { status, headers });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" } });
}

export async function POST(req: NextRequest) {
  let issuedHost: string;
  try {
    issuedHost = new URL(getMcpPublicOrigin()).host;
  } catch (e) {
    if (e instanceof McpConfigError) return oauthError(500, "server_error", e.message);
    throw e;
  }
  const form = new URLSearchParams(await req.text());
  const parsed = parseTokenRequest(form);
  if (!parsed.ok) return oauthError(parsed.error === "invalid_client" ? 401 : 400, parsed.error, parsed.description);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const throttleKey = `token:${parsed.clientId}:${ip}`;
  if (tokenRequests(throttleKey, 10, FAIL_WINDOW_MS)) {
    // Keyed on client id AND source IP: client_id is public (it appears in
    // the /authorize URL), so keying on client_id alone would let a third
    // party lock out the real client by spamming junk requests with it.
    return oauthError(429, "invalid_request", "Too many token requests — try again later.");
  }

  const result =
    parsed.grant === "authorization_code"
      ? await exchangeAuthorizationCode(parsed, issuedHost)
      : await refreshTokens(parsed, issuedHost);

  if ("error" in result) return oauthError(400, result.error, result.description);
  return NextResponse.json(
    { access_token: result.accessToken, token_type: "Bearer", expires_in: result.expiresIn, refresh_token: result.refreshToken, scope: "crm" },
    { headers },
  );
}
