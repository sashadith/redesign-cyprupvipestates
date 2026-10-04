export type TokenRequest =
  | { ok: true; grant: "authorization_code"; code: string; codeVerifier: string; clientId: string; redirectUri: string }
  | { ok: true; grant: "refresh_token"; refreshToken: string; clientId: string }
  | { ok: false; error: "unsupported_grant_type" | "invalid_request" | "invalid_client"; description: string };

const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/; // RFC 7636 §4.1

export function parseTokenRequest(form: URLSearchParams): TokenRequest {
  const grant = form.get("grant_type");
  const clientId = form.get("client_id") ?? "";
  if (grant !== "authorization_code" && grant !== "refresh_token") {
    return { ok: false, error: "unsupported_grant_type", description: "Only authorization_code and refresh_token are supported." };
  }
  if (!clientId) return { ok: false, error: "invalid_client", description: "client_id is required." };
  if (grant === "authorization_code") {
    const code = form.get("code") ?? "";
    const codeVerifier = form.get("code_verifier") ?? "";
    const redirectUri = form.get("redirect_uri") ?? "";
    if (!code || !redirectUri) return { ok: false, error: "invalid_request", description: "code and redirect_uri are required." };
    if (!VERIFIER_RE.test(codeVerifier)) return { ok: false, error: "invalid_request", description: "code_verifier is required (43–128 chars)." };
    return { ok: true, grant, code, codeVerifier, clientId, redirectUri };
  }
  const refreshToken = form.get("refresh_token") ?? "";
  if (!refreshToken) return { ok: false, error: "invalid_request", description: "refresh_token is required." };
  return { ok: true, grant, refreshToken, clientId };
}
