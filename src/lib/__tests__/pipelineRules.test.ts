import { test } from "node:test";
import assert from "node:assert/strict";
import { workedByPartnerOnAccept, partnerMayWork } from "../partner/pipeline/rules";

test("an accepted FIX claim on an unassigned lead is worked by the partner", () => {
  assert.equal(workedByPartnerOnAccept("FIX", null), true);
});

test("a FIX claim on a lead a staff member already owns stays staff-worked", () => {
  assert.equal(workedByPartnerOnAccept("FIX", "u1"), false);
});

test("a HANDOVER claim is never partner-worked", () => {
  assert.equal(workedByPartnerOnAccept("HANDOVER", null), false);
  assert.equal(workedByPartnerOnAccept("HANDOVER", "u1"), false);
});

test("partnerMayWork needs own, partner-worked, live lead", () => {
  const base = { partnerId: "p1", workedByPartner: true, deletedAt: null };
  assert.equal(partnerMayWork(base, "p1"), true);
  assert.equal(partnerMayWork(base, "p2"), false);
  assert.equal(partnerMayWork({ ...base, partnerId: null }, "p1"), false);
  assert.equal(partnerMayWork({ ...base, workedByPartner: false }, "p1"), false);
  assert.equal(partnerMayWork({ ...base, deletedAt: new Date() }, "p1"), false);
});
