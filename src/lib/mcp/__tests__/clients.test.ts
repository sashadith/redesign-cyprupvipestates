import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRegistration } from "@/lib/mcp/auth/clientsValidate";

test("accepts a claude.ai registration and normalises the name", () => {
  const r = validateRegistration({ client_name: "  Claude  ", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] });
  assert.deepEqual(r, { ok: true, clientName: "Claude", redirectUris: ["https://claude.ai/api/mcp/auth_callback"] });
});

test("rejects missing, empty, non-https or foreign redirect URIs", () => {
  assert.equal(validateRegistration({}).ok, false);
  assert.equal(validateRegistration({ redirect_uris: [] }).ok, false);
  assert.equal(validateRegistration({ redirect_uris: ["http://claude.ai/cb"] }).ok, false);
  assert.equal(validateRegistration({ redirect_uris: ["https://claude.ai/cb", "https://evil.com/cb"] }).ok, false);
  const r = validateRegistration({ redirect_uris: ["https://evil.com/cb"] });
  assert.equal(r.ok === false && r.error, "invalid_redirect_uri");
});

test("rejects unsupported grant/response types and auth methods when present", () => {
  assert.equal(validateRegistration({ redirect_uris: ["https://claude.ai/cb"], grant_types: ["client_credentials"] }).ok, false);
  assert.equal(validateRegistration({ redirect_uris: ["https://claude.ai/cb"], token_endpoint_auth_method: "client_secret_post" }).ok, false);
  assert.equal(validateRegistration({ redirect_uris: ["https://claude.ai/cb"], grant_types: ["authorization_code", "refresh_token"], token_endpoint_auth_method: "none" }).ok, true);
});
