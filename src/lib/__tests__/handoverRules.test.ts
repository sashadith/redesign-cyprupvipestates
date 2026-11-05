import { test } from "node:test";
import assert from "node:assert/strict";
import { handoverPlan, handoverAllowed, mayKeepFix, HANDOVER_KEEPS_FIX_FROM } from "@/lib/partner/pipeline/handoverRules";

test("a FIX lead before the viewing stage with no deal is downgraded", () => {
  assert.deepEqual(handoverPlan({ status: "CONTACTED", partnerMode: "FIX", hasLiveDeal: false }), { downgrade: true, noDowngradeBecauseDeal: false });
});

test("every stage before the viewing downgrades", () => {
  for (const status of ["NEW", "CONTACTED", "COMMUNICATING", "KEEP_CONTACT"] as const) {
    assert.equal(handoverPlan({ status, partnerMode: "FIX", hasLiveDeal: false }).downgrade, true, status);
  }
});

test("the viewing stage and later keep the FIX share", () => {
  assert.equal(HANDOVER_KEEPS_FIX_FROM, "VIEWING_SCHEDULED");
  for (const status of ["VIEWING_SCHEDULED", "OFFER", "RESERVED", "CLOSED", "LOST"] as const) {
    assert.deepEqual(handoverPlan({ status, partnerMode: "FIX", hasLiveDeal: false }), { downgrade: false, noDowngradeBecauseDeal: false }, status);
  }
});

test("a live deal blocks the downgrade and says so", () => {
  assert.deepEqual(handoverPlan({ status: "CONTACTED", partnerMode: "FIX", hasLiveDeal: true }), { downgrade: false, noDowngradeBecauseDeal: true });
});

test("a HANDOVER or unset mode has nothing to downgrade", () => {
  assert.deepEqual(handoverPlan({ status: "NEW", partnerMode: "HANDOVER", hasLiveDeal: true }), { downgrade: false, noDowngradeBecauseDeal: false });
  assert.deepEqual(handoverPlan({ status: "NEW", partnerMode: null, hasLiveDeal: false }), { downgrade: false, noDowngradeBecauseDeal: false });
});

test("keeping the FIX share is not allowed with a live deal", () => {
  assert.equal(mayKeepFix(true), false);
  assert.equal(mayKeepFix(false), true);
});

test("no handover request on a closed or lost lead", () => {
  assert.equal(handoverAllowed("CLOSED"), false);
  assert.equal(handoverAllowed("LOST"), false);
  for (const s of ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "KEEP_CONTACT"] as const) {
    assert.equal(handoverAllowed(s), true, s);
  }
});
