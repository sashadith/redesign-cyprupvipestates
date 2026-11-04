import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateSendAttempt, MAX_CODE_ATTEMPTS } from "@/lib/mcp/drafts/draftState";

const now = new Date("2026-09-07T12:00:00Z");
const base = { status: "PENDING" as const, failedAttempts: 0, expiresAt: new Date("2026-09-08T11:00:00Z"), approvalCode: "7K3PQ2" };

test("right code on a live pending draft → send", () => {
  assert.deepEqual(evaluateSendAttempt(base, "7k3pq2", now), { action: "send" });
});

test("expired pending draft → expire, even with the right code", () => {
  const r = evaluateSendAttempt({ ...base, expiresAt: new Date("2026-09-07T11:59:59Z") }, "7K3PQ2", now);
  assert.equal(r.action, "expire");
});

test("non-pending statuses are rejected with a status-specific message", () => {
  for (const [status, needle] of [["SENDING", /being sent/], ["SENT", /already sent/], ["SUPERSEDED", /newer draft/], ["EXPIRED", /expired/], ["LOCKED", /locked/]] as const) {
    const r = evaluateSendAttempt({ ...base, status }, "7K3PQ2", now);
    assert.equal(r.action, "reject");
    assert.match(r.action === "reject" ? r.message : "", needle);
  }
});

test("wrong code counts attempts and locks at the cap without revealing the code", () => {
  const r1 = evaluateSendAttempt(base, "AAAAAA", now);
  assert.deepEqual(r1, { action: "wrong_code", failedAttempts: 1, lock: false, message: `Approval code not accepted (${MAX_CODE_ATTEMPTS - 1} attempts left).` });
  const r5 = evaluateSendAttempt({ ...base, failedAttempts: MAX_CODE_ATTEMPTS - 1 }, "AAAAAA", now);
  assert.equal(r5.action, "wrong_code");
  assert.equal(r5.action === "wrong_code" && r5.lock, true);
  assert.doesNotMatch(JSON.stringify(r5), /7K3PQ2/);
});

test("failedAttempts already at the cap on a still-PENDING draft → locked, even with the right code", () => {
  const r = evaluateSendAttempt({ ...base, failedAttempts: 5 }, "7K3PQ2", now);
  assert.equal(r.action, "reject");
  assert.match(r.action === "reject" ? r.message : "", /locked/);
});

test("crm_send_email without draftId: the code alone picks the one open draft it belongs to", async () => {
  const { draftForCode } = await import("@/lib/mcp/drafts/draftState");
  const now = new Date("2026-11-04T10:00:00Z");
  const later = new Date("2026-11-05T10:00:00Z");
  const drafts = [
    { id: "a", approvalCode: "ABC234", expiresAt: later, failedAttempts: 0 },
    { id: "b", approvalCode: "XYZ789", expiresAt: later, failedAttempts: 0 },
  ];
  assert.deepEqual(draftForCode(drafts, "xyz-789", now), { kind: "one", id: "b" });
  assert.deepEqual(draftForCode(drafts, "QQQ222", now), { kind: "none" });
  assert.deepEqual(draftForCode([...drafts, { id: "c", approvalCode: "ABC234", expiresAt: later, failedAttempts: 0 }], "ABC234", now), { kind: "many" });
  // An expired or locked-by-attempts draft is never picked.
  assert.deepEqual(draftForCode([{ id: "d", approvalCode: "ABC234", expiresAt: new Date("2026-11-03T10:00:00Z"), failedAttempts: 0 }], "ABC234", now), { kind: "none" });
  assert.deepEqual(draftForCode([{ id: "e", approvalCode: "ABC234", expiresAt: later, failedAttempts: 5 }], "ABC234", now), { kind: "none" });
});
