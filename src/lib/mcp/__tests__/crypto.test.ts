import { test } from "node:test";
import assert from "node:assert/strict";
import { randomToken, sha256Hex, pkceChallenge, verifyPkce, safeEqual } from "@/lib/mcp/auth/crypto";

test("randomToken is base64url of the requested byte length and unique", () => {
  const a = randomToken();
  const b = randomToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/); // 32 bytes → 43 chars, no padding
  assert.notEqual(a, b);
  assert.match(randomToken(16), /^[A-Za-z0-9_-]{22}$/);
});

test("sha256Hex matches a known vector", () => {
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("pkceChallenge matches RFC 7636 appendix B", () => {
  // Verifier and challenge straight from the RFC.
  assert.equal(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("verifyPkce accepts the right verifier and rejects others", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(verifyPkce(verifier, pkceChallenge(verifier)), true);
  assert.equal(verifyPkce(verifier + "x", pkceChallenge(verifier)), false);
  assert.equal(verifyPkce("", pkceChallenge(verifier)), false);
});

test("safeEqual compares without throwing on length mismatch", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "ab"), false);
  assert.equal(safeEqual("", ""), true);
});
