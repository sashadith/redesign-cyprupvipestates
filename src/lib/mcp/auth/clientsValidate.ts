import { isAllowedRedirectUri } from "./redirectUris";

export type RegistrationResult =
  | { ok: true; clientName: string | null; redirectUris: string[] }
  | { ok: false; error: "invalid_client_metadata" | "invalid_redirect_uri"; description: string };

const ALLOWED_GRANTS = new Set(["authorization_code", "refresh_token"]);

// RFC 7591 request body → what we store. Only the fields we act on are read;
// everything else claude.ai sends (client_uri, logo_uri, ...) is ignored.
export function validateRegistration(body: unknown): RegistrationResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (uris.length === 0) return { ok: false, error: "invalid_redirect_uri", description: "redirect_uris is required." };
  const bad = uris.find((u) => !isAllowedRedirectUri(u));
  if (bad) return { ok: false, error: "invalid_redirect_uri", description: "redirect_uris must be https URLs on claude.ai or claude.com." };
  if (Array.isArray(b.grant_types) && b.grant_types.some((g) => !ALLOWED_GRANTS.has(String(g)))) {
    return { ok: false, error: "invalid_client_metadata", description: "Only authorization_code and refresh_token grants are supported." };
  }
  if (Array.isArray(b.response_types) && b.response_types.some((r) => r !== "code")) {
    return { ok: false, error: "invalid_client_metadata", description: "Only the code response type is supported." };
  }
  if (b.token_endpoint_auth_method != null && b.token_endpoint_auth_method !== "none") {
    return { ok: false, error: "invalid_client_metadata", description: "Only public clients (token_endpoint_auth_method=none) are supported." };
  }
  const name = typeof b.client_name === "string" ? b.client_name.trim().slice(0, 120) : "";
  return { ok: true, clientName: name || null, redirectUris: Array.from(new Set(uris)) };
}
