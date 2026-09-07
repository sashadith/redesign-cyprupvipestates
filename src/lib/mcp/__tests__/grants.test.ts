import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTokenRequest } from "@/lib/mcp/auth/grants";

const form = (o: Record<string, string>) => new URLSearchParams(o);

test("parses an authorization_code grant", () => {
  const r = parseTokenRequest(form({ grant_type: "authorization_code", code: "c", code_verifier: "v".repeat(43), client_id: "id", redirect_uri: "https://claude.ai/cb" }));
  assert.deepEqual(r, { ok: true, grant: "authorization_code", code: "c", codeVerifier: "v".repeat(43), clientId: "id", redirectUri: "https://claude.ai/cb" });
});

test("parses a refresh_token grant", () => {
  const r = parseTokenRequest(form({ grant_type: "refresh_token", refresh_token: "r", client_id: "id" }));
  assert.deepEqual(r, { ok: true, grant: "refresh_token", refreshToken: "r", clientId: "id" });
});

test("rejects unsupported grants and missing fields with RFC error codes", () => {
  assert.deepEqual(parseTokenRequest(form({ grant_type: "password" })), { ok: false, error: "unsupported_grant_type", description: "Only authorization_code and refresh_token are supported." });
  const r1 = parseTokenRequest(form({ grant_type: "authorization_code", code: "c", client_id: "id", redirect_uri: "https://claude.ai/cb" }));
  assert.equal(r1.ok === false && r1.error, "invalid_request"); // no code_verifier
  const r2 = parseTokenRequest(form({ grant_type: "authorization_code", code: "c", code_verifier: "short", client_id: "id", redirect_uri: "https://claude.ai/cb" }));
  assert.equal(r2.ok === false && r2.error, "invalid_request"); // verifier length 43..128
  const r3 = parseTokenRequest(form({ grant_type: "refresh_token", client_id: "id" }));
  assert.equal(r3.ok === false && r3.error, "invalid_request");
  const r4 = parseTokenRequest(form({ grant_type: "refresh_token", refresh_token: "r" }));
  assert.equal(r4.ok === false && r4.error, "invalid_client"); // client_id required for public clients
});

test("rejects missing code/redirect_uri, bad verifier charset and length bounds", () => {
  const noCode = parseTokenRequest(form({ grant_type: "authorization_code", code_verifier: "v".repeat(43), client_id: "id", redirect_uri: "https://claude.ai/cb" }));
  assert.equal(noCode.ok, false);
  assert.equal(noCode.ok === false && noCode.error, "invalid_request");
  assert.equal(noCode.ok === false && noCode.description, "code and redirect_uri are required.");

  const noRedirect = parseTokenRequest(form({ grant_type: "authorization_code", code: "c", code_verifier: "v".repeat(43), client_id: "id" }));
  assert.equal(noRedirect.ok, false);
  assert.equal(noRedirect.ok === false && noRedirect.error, "invalid_request");
  assert.equal(noRedirect.ok === false && noRedirect.description, "code and redirect_uri are required.");

  const plusVerifier = parseTokenRequest(form({ grant_type: "authorization_code", code: "c", code_verifier: "v".repeat(42) + "+", client_id: "id", redirect_uri: "https://claude.ai/cb" }));
  assert.equal(plusVerifier.ok, false);
  assert.equal(plusVerifier.ok === false && plusVerifier.error, "invalid_request");

  const slashVerifier = parseTokenRequest(form({ grant_type: "authorization_code", code: "c", code_verifier: "v".repeat(42) + "/", client_id: "id", redirect_uri: "https://claude.ai/cb" }));
  assert.equal(slashVerifier.ok, false);
  assert.equal(slashVerifier.ok === false && slashVerifier.error, "invalid_request");

  const tooLong = parseTokenRequest(form({ grant_type: "authorization_code", code: "c", code_verifier: "v".repeat(129), client_id: "id", redirect_uri: "https://claude.ai/cb" }));
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.ok === false && tooLong.error, "invalid_request");

  const maxLen = parseTokenRequest(form({ grant_type: "authorization_code", code: "c", code_verifier: "v".repeat(128), client_id: "id", redirect_uri: "https://claude.ai/cb" }));
  assert.equal(maxLen.ok, true);
  assert.equal(maxLen.ok === true && maxLen.grant, "authorization_code");
});
