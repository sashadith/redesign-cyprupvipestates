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
