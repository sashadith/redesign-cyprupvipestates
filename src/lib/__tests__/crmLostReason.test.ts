import { test } from "node:test";
import assert from "node:assert/strict";
import { lostReasonUpdate } from "@/lib/crm/updateLeadStatus";

test("LOST with a reason stores it", () => {
  assert.deepEqual(lostReasonUpdate("LOST", "BUDGET"), { lostReason: "BUDGET" });
});

test("LOST without a reason leaves the column untouched (old CRM dropdown)", () => {
  assert.deepEqual(lostReasonUpdate("LOST", undefined), {});
});

test("leaving LOST clears a stale reason", () => {
  assert.deepEqual(lostReasonUpdate("CONTACTED", undefined), { lostReason: null });
});

test("a reason with any other status is rejected", () => {
  assert.throws(() => lostReasonUpdate("OFFER", "BUDGET"), /only allowed with status LOST/);
});

import { standaloneLostReason } from "@/lib/crm/updateLeadStatus";

test("already LOST + LOST + reason: reason is stored as a plain update", () => {
  assert.equal(standaloneLostReason("LOST", "LOST", "BUDGET"), "BUDGET");
});

test("status really changing to LOST: reason travels with the status change, not standalone", () => {
  assert.equal(standaloneLostReason("CONTACTED", "LOST", "BUDGET"), undefined);
});

test("no reason or no status: nothing standalone", () => {
  assert.equal(standaloneLostReason("LOST", "LOST", undefined), undefined);
  assert.equal(standaloneLostReason("LOST", undefined, undefined), undefined);
});
