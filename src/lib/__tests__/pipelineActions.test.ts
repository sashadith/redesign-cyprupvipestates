import { test } from "node:test";
import assert from "node:assert/strict";
import { claimEligible, viewingDateMissing } from "@/lib/partner/pipeline/rules";

const claim = { partnerId: "p1", mode: "FIX" as const, state: "ACTIVE" as const };

test("only an ACTIVE FIX claim of the same partner opens the pipeline", () => {
  assert.equal(claimEligible(claim, "p1"), true);
  assert.equal(claimEligible(claim, "p2"), false);
  assert.equal(claimEligible({ ...claim, mode: "HANDOVER" }, "p1"), false);
  assert.equal(claimEligible({ ...claim, state: "IN_REVIEW" }, "p1"), false);
  assert.equal(claimEligible({ ...claim, state: "REJECTED" }, "p1"), false);
  assert.equal(claimEligible(null, "p1"), false);
});

test("VIEWING_SCHEDULED needs a date only when the status changes to it", () => {
  const at = new Date("2026-11-10T10:00:00Z");
  assert.equal(viewingDateMissing("CONTACTED", "VIEWING_SCHEDULED", undefined), true);
  assert.equal(viewingDateMissing("CONTACTED", "VIEWING_SCHEDULED", at), false);
  assert.equal(viewingDateMissing("VIEWING_SCHEDULED", "VIEWING_SCHEDULED", undefined), false);
  assert.equal(viewingDateMissing("CONTACTED", "OFFER", undefined), false);
});
