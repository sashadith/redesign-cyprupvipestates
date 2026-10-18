import { test } from "node:test";
import assert from "node:assert/strict";
import { decideSubmission, claimProtection, REAL_CONTACT_TYPES } from "@/lib/partner/claims";
import { partnerStage, PARTNER_STEPS, lostCategory } from "@/lib/partner/milestones";
import { LEAD_STATUSES, LOST_REASONS } from "@/lib/crm/leadStatus";
import { PARTNER_LOCALES, lookup } from "@/lib/partner/i18n";

test("real contact types", () => {
  assert.deepEqual([...REAL_CONTACT_TYPES], ["CALL", "EMAIL_OUT", "EMAIL_IN", "WHATSAPP_OUT", "WHATSAPP_IN"]);
});
test("decideSubmission", () => {
  assert.deepEqual(decideSubmission({ duplicate: null, myActiveClaimLeadIds: ["a"] }), { kind: "CREATE" });
  assert.deepEqual(decideSubmission({ duplicate: { leadId: "a" }, myActiveClaimLeadIds: ["a"] }), { kind: "ALREADY_YOURS", leadId: "a" });
  assert.deepEqual(decideSubmission({ duplicate: { leadId: "b" }, myActiveClaimLeadIds: ["a"] }), { kind: "REVIEW", leadId: "b" });
});
test("claimProtection: 6 months from claim", () => {
  const r = claimProtection({ claimCreatedAt: new Date("2026-01-15T10:00:00Z"), lastRealContactAt: null, now: new Date("2026-07-15T09:59:59Z") });
  assert.equal(r.protectedUntil.toISOString(), "2026-07-15T10:00:00.000Z");
  assert.equal(r.expired, false);
  assert.equal(claimProtection({ claimCreatedAt: new Date("2026-01-15T10:00:00Z"), lastRealContactAt: null, now: new Date("2026-07-15T10:00:01Z") }).expired, true);
});
test("claimProtection: later contact extends, earlier contact ignored", () => {
  const c = new Date("2026-01-01T00:00:00Z");
  const now = new Date("2026-08-01T00:00:00Z");
  assert.equal(claimProtection({ claimCreatedAt: c, lastRealContactAt: new Date("2026-05-10T00:00:00Z"), now }).protectedUntil.toISOString(), "2026-11-10T00:00:00.000Z");
  assert.equal(claimProtection({ claimCreatedAt: c, lastRealContactAt: new Date("2025-05-10T00:00:00Z"), now }).protectedUntil.toISOString(), "2026-07-01T00:00:00.000Z");
});
test("claimProtection: day-of-month clamp", () => {
  const f = (iso: string) => claimProtection({ claimCreatedAt: new Date(iso), lastRealContactAt: null, now: new Date(iso) }).protectedUntil.toISOString();
  assert.equal(f("2026-08-31T12:00:00Z"), "2027-02-28T12:00:00.000Z");
  assert.equal(f("2027-08-31T12:00:00Z"), "2028-02-29T12:00:00.000Z");
  assert.equal(f("2026-12-31T00:00:00Z"), "2027-06-30T00:00:00.000Z");
});
test("partnerStage covers every status", () => {
  assert.equal(PARTNER_STEPS.length, 7);
  assert.deepEqual(partnerStage("NEW"), { step: 1, key: "stages.submitted" });
  assert.deepEqual(partnerStage("CLOSED"), { step: 7, key: "stages.sold" });
  assert.deepEqual(partnerStage("KEEP_CONTACT"), { step: null, key: "stages.onHold" });
  assert.deepEqual(partnerStage("LOST"), { step: null, key: "stages.lost" });
  for (const s of LEAD_STATUSES) {
    const { key } = partnerStage(s);
    for (const l of PARTNER_LOCALES) assert.ok(lookup(l, key), `${l} ${key}`);
  }
});
test("lostCategory exhaustive", () => {
  const cats = new Set(["budget", "timing", "other_choice", "unreachable", "other"]);
  for (const r of LOST_REASONS) {
    const c = lostCategory(r);
    assert.ok(cats.has(c), r);
    for (const l of PARTNER_LOCALES) assert.ok(lookup(l, `lost.${c}`));
  }
  assert.equal(lostCategory("BUDGET"), "budget");
  assert.equal(lostCategory("BOUGHT_ELSEWHERE"), "other_choice");
  assert.equal(lostCategory("TIMING"), "timing");
  assert.equal(lostCategory("UNREACHABLE"), "unreachable");
  assert.equal(lostCategory(null), "other");
  assert.equal(lostCategory("INVALID"), "other");
});
