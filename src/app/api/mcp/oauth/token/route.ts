import { NextRequest, NextResponse } from "next/server";
import { parseTokenRequest } from "@/lib/mcp/auth/grants";
import { exchangeAuthorizationCode, refreshTokens } from "@/lib/mcp/auth/tokens";
import { getMcpPublicOrigin, McpConfigError } from "@/lib/mcp/publicOrigin";
import { makeRateLimiter } from "@/lib/antispam";

export const dynamic = "force-dynamic";

// 10 failed exchanges per client id per 15 minutes → 429. Per instance, like
// the login throttle in src/auth.ts — adequate for one operator.
const failures = makeRateLimiter();
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

  const throttleKey = `token:${parsed.clientId}`;
  if (failures(throttleKey, 10, FAIL_WINDOW_MS)) {
    // makeRateLimiter counts every call, so a healthy client that refreshes
    // once every 8 h never gets near 10; only repeated failures do.
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
