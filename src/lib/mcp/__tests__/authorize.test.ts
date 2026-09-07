import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAuthorizeRequest } from "@/lib/mcp/auth/authorizeValidate";

const client = { redirectUris: ["https://claude.ai/api/mcp/auth_callback"] };
const good = {
  client_id: "abc",
  redirect_uri: "https://claude.ai/api/mcp/auth_callback",
  response_type: "code",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
  state: "xyz",
};

test("accepts a complete PKCE request for a registered redirect URI", () => {
  const r = validateAuthorizeRequest(good, client);
  assert.deepEqual(r, { ok: true, clientId: "abc", redirectUri: good.redirect_uri, state: "xyz", codeChallenge: good.code_challenge });
});

test("unknown client or unregistered redirect URI is NOT redirectable", () => {
  const r1 = validateAuthorizeRequest(good, null);
  assert.equal(r1.ok, false);
  assert.equal(r1.ok === false && r1.redirectable, false);
  const r2 = validateAuthorizeRequest({ ...good, redirect_uri: "https://claude.ai/other" }, client);
  assert.equal(r2.ok === false && r2.redirectable, false);
});

test("bad response_type / missing PKCE / plain method are redirectable errors", () => {
  for (const bad of [
    { ...good, response_type: "token" },
    { ...good, code_challenge: undefined },
    { ...good, code_challenge_method: "plain" },
    { ...good, code_challenge: "too-short" },
  ]) {
    const r = validateAuthorizeRequest(bad as any, client);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.redirectable, true);
  }
});

test("state is optional but preserved", () => {
  const r = validateAuthorizeRequest({ ...good, state: undefined }, client);
  assert.equal(r.ok && r.state, "");
});
