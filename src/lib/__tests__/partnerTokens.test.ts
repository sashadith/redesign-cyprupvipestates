import { test } from "node:test";
import assert from "node:assert/strict";
import { newToken, hashToken, addHours } from "@/lib/partner/tokens";

test("token: base64url, hash is 64 hex and matches hashToken", () => {
  const { token, hash } = newToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hashToken(token), hash);
  assert.equal(hashToken(token), hashToken(token));
});
test("token: different tokens differ", () => {
  const a = newToken(), b = newToken();
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.hash, b.hash);
});
test("addHours", () => {
  const d = new Date("2026-10-18T10:00:00Z");
  assert.equal(addHours(d, 48).toISOString(), "2026-10-20T10:00:00.000Z");
  assert.equal(d.toISOString(), "2026-10-18T10:00:00.000Z");
});
