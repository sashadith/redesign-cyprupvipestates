// RFC 8414 (authorization server) and RFC 9728 (protected resource) discovery
// documents. Pure: given an origin, returns the JSON. Only the
// authorization-code + PKCE flow is advertised; DCR (registration_endpoint)
// is the client-onboarding path claude.ai uses today. CIMD is deliberately
// NOT advertised (client_id_metadata_document_supported absent) — see the
// spec's "Decisions" — so claude.ai keeps registering via DCR.
export const MCP_RESOURCE_PATH = "/api/mcp";

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/admin/mcp/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["crm"],
  };
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}${MCP_RESOURCE_PATH}`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["crm"],
  };
}
