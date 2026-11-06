import { test } from "node:test";
import assert from "node:assert/strict";
import { claimEligible, partnerMayAct } from "@/lib/partner/pipeline/rules";

const claim = { partnerId: "p1", mode: "FIX" as const, state: "ACTIVE" as const };

test("only an ACTIVE FIX claim of the same partner opens the pipeline", () => {
  assert.equal(claimEligible(claim, "p1"), true);
  assert.equal(claimEligible(claim, "p2"), false);
  assert.equal(claimEligible({ ...claim, mode: "HANDOVER" }, "p1"), false);
  assert.equal(claimEligible({ ...claim, state: "IN_REVIEW" }, "p1"), false);
  assert.equal(claimEligible({ ...claim, state: "REJECTED" }, "p1"), false);
  assert.equal(claimEligible(null, "p1"), false);
});

const lead = { partnerId: "p1", workedByPartner: true, deletedAt: null };

test("the partner acts only while the claim is effectively ACTIVE and the lead is his to work", () => {
  assert.equal(partnerMayAct(claim, "ACTIVE", lead, "p1"), true);
  assert.equal(partnerMayAct(claim, "NOT_PROCEEDING", lead, "p1"), false);
  assert.equal(partnerMayAct(claim, "EXPIRED", lead, "p1"), false);
  assert.equal(partnerMayAct(claim, null, lead, "p1"), false);
  assert.equal(partnerMayAct({ ...claim, state: "IN_REVIEW" }, "ACTIVE", lead, "p1"), false);
  assert.equal(partnerMayAct(claim, "ACTIVE", { ...lead, workedByPartner: false }, "p1"), false);
  assert.equal(partnerMayAct(claim, "ACTIVE", { ...lead, deletedAt: new Date() }, "p1"), false);
  assert.equal(partnerMayAct(claim, "ACTIVE", null, "p1"), false);
  assert.equal(partnerMayAct(claim, "ACTIVE", lead, "p2"), false);
});
