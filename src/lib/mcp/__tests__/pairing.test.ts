import { test } from "node:test";
import assert from "node:assert/strict";
import { createPairingToken, verifyPairingToken, PAIRING_TTL_MS } from "@/lib/mcp/auth/pairing";

const secret = "test-secret-at-least-32-characters-long!!";
const t0 = Date.parse("2026-09-07T12:00:00Z");

test("a fresh token verifies for its user within the TTL", () => {
  const tok = createPairingToken("user-1", secret, t0);
  assert.match(tok, /^\d+\.[A-Za-z0-9_-]{43}$/);
  assert.equal(verifyPairingToken(tok, "user-1", secret, t0 + 60_000), true);
  assert.equal(verifyPairingToken(tok, "user-1", secret, t0 + PAIRING_TTL_MS - 1), true);
});

test("rejects after expiry, for another user, with another secret, or when tampered", () => {
  const tok = createPairingToken("user-1", secret, t0);
  assert.equal(verifyPairingToken(tok, "user-1", secret, t0 + PAIRING_TTL_MS + 1), false);
  assert.equal(verifyPairingToken(tok, "user-2", secret, t0), false);
  assert.equal(verifyPairingToken(tok, "user-1", secret + "x", t0), false);
  const [exp, mac] = tok.split(".");
  assert.equal(verifyPairingToken(`${Number(exp) + 1000}.${mac}`, "user-1", secret, t0), false);
  assert.equal(verifyPairingToken(undefined, "user-1", secret, t0), false);
  assert.equal(verifyPairingToken("garbage", "user-1", secret, t0), false);
});
