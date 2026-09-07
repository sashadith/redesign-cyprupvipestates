import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizationServerMetadata, protectedResourceMetadata } from "@/lib/mcp/auth/metadata";

const origin = "https://design.cyprusvipestates.com";

test("authorization server metadata advertises exactly the supported flow", () => {
  const m = authorizationServerMetadata(origin) as Record<string, unknown>;
  assert.equal(m.issuer, origin);
  assert.equal(m.authorization_endpoint, `${origin}/admin/mcp/authorize`);
  assert.equal(m.token_endpoint, `${origin}/api/mcp/oauth/token`);
  assert.equal(m.registration_endpoint, `${origin}/api/mcp/oauth/register`);
  assert.deepEqual(m.response_types_supported, ["code"]);
  assert.deepEqual(m.grant_types_supported, ["authorization_code", "refresh_token"]);
  assert.deepEqual(m.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(m.token_endpoint_auth_methods_supported, ["none"]);
  assert.equal("client_id_metadata_document_supported" in m, false); // DCR only, by decision
});

test("protected resource metadata points at /api/mcp and this origin", () => {
  const m = protectedResourceMetadata(origin) as Record<string, unknown>;
  assert.equal(m.resource, `${origin}/api/mcp`);
  assert.deepEqual(m.authorization_servers, [origin]);
  assert.deepEqual(m.bearer_methods_supported, ["header"]);
});
