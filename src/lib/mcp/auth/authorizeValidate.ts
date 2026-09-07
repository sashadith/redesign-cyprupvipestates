export type AuthorizeValidation =
  | { ok: true; clientId: string; redirectUri: string; state: string; codeChallenge: string }
  | { ok: false; redirectable: boolean; error: string; description: string };

// RFC 6749 §4.1.2.1: if the client id or redirect URI is bad we must NOT
// redirect (that would send the error — and later a code — to an attacker's
// URL). Every other error goes back to the registered redirect URI.
export function validateAuthorizeRequest(
  p: Record<string, string | undefined>,
  client: { redirectUris: string[] } | null,
): AuthorizeValidation {
  const clientId = p.client_id ?? "";
  const redirectUri = p.redirect_uri ?? "";
  if (!clientId || !client) return { ok: false, redirectable: false, error: "invalid_client", description: "Unknown client_id." };
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return { ok: false, redirectable: false, error: "invalid_request", description: "redirect_uri is not registered for this client." };
  }
  if (p.response_type !== "code") return { ok: false, redirectable: true, error: "unsupported_response_type", description: "Only response_type=code is supported." };
  if (p.code_challenge_method !== "S256") return { ok: false, redirectable: true, error: "invalid_request", description: "code_challenge_method must be S256." };
  const challenge = p.code_challenge ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) return { ok: false, redirectable: true, error: "invalid_request", description: "code_challenge must be a base64url SHA-256 (43 chars)." };
  return { ok: true, clientId, redirectUri, state: p.state ?? "", codeChallenge: challenge };
}
