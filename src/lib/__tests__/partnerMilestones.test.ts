import { test } from "node:test";
import assert from "node:assert/strict";
import { milestonesFor, responseMinutes } from "@/lib/partner/milestones";
import { PARTNER_LOCALES, lookup } from "@/lib/partner/i18n";

const t = (s: string) => new Date(s);
const claim = t("2026-03-01T10:00:00Z");
const base = { claimCreatedAt: claim, deals: [], messages: [] };

test("only events at/after claim, first real contact once, newest first", () => {
  const m = milestonesFor({
    ...base,
    interactions: [
      { type: "CALL", occurredAt: t("2026-02-01T00:00:00Z"), metadata: null },
      { type: "CALL", occurredAt: t("2026-03-03T00:00:00Z"), metadata: null },
      { type: "EMAIL_OUT", occurredAt: t("2026-03-02T00:00:00Z"), metadata: null },
      { type: "STATUS_CHANGE", occurredAt: t("2026-03-04T00:00:00Z"), metadata: { toStatus: "VIEWING_SCHEDULED" } },
      { type: "STATUS_CHANGE", occurredAt: t("2026-02-20T00:00:00Z"), metadata: { toStatus: "OFFER" } },
    ],
  });
  assert.deepEqual(m.map((x) => x.key), ["milestones.statusViewing", "milestones.firstContact"]);
  assert.equal(m[1].at.toISOString(), "2026-03-02T00:00:00.000Z");
});
test("never exposes note bodies; messages are the only bodies", () => {
  const m = milestonesFor({
    ...base,
    interactions: [{ type: "NOTE", occurredAt: t("2026-03-05T00:00:00Z"), metadata: { body: "secret" } }],
    deals: [],
    messages: [{ createdAt: t("2026-03-06T00:00:00Z"), body: "Hello partner" }],
  });
  assert.equal(m.length, 1);
  assert.equal(m[0].key, "milestones.message");
  assert.equal(m[0].body, "Hello partner");
  for (const x of milestonesFor({ ...base, interactions: [{ type: "STATUS_CHANGE", occurredAt: t("2026-03-05T00:00:00Z"), metadata: { toStatus: "LOST", body: "x" } }], deals: [], messages: [] }))
    assert.equal(x.body, undefined);
});
test("booking confirmed, deals, unknown status ignored", () => {
  const m = milestonesFor({
    claimCreatedAt: claim,
    interactions: [
      { type: "BOOKING_EVENT", occurredAt: t("2026-03-05T00:00:00Z"), metadata: { legacyType: "BOOKING_CONFIRMED" } },
      { type: "BOOKING_EVENT", occurredAt: t("2026-03-05T01:00:00Z"), metadata: { legacyType: "BOOKING_PROPOSED" } },
      { type: "STATUS_CHANGE", occurredAt: t("2026-03-05T02:00:00Z"), metadata: { toStatus: "BOGUS" } },
      { type: "STATUS_CHANGE", occurredAt: t("2026-03-05T03:00:00Z"), metadata: "junk" },
    ],
    deals: [{ createdAt: t("2026-03-07T00:00:00Z"), earnedAt: t("2026-03-09T00:00:00Z"), cancelledAt: t("2026-03-10T00:00:00Z"), commissionStatus: "X" },
            { createdAt: t("2026-01-07T00:00:00Z"), earnedAt: null, cancelledAt: null, commissionStatus: "X" }],
    messages: [],
  });
  assert.deepEqual(m.map((x) => x.key), ["milestones.dealCancelled", "milestones.dealEarned", "milestones.dealCreated", "milestones.viewingConfirmed"]);
});
test("identical key within the same minute is deduped", () => {
  const m = milestonesFor({ ...base, deals: [], messages: [], interactions: [
    { type: "STATUS_CHANGE", occurredAt: t("2026-03-05T00:00:05Z"), metadata: { toStatus: "OFFER" } },
    { type: "STATUS_CHANGE", occurredAt: t("2026-03-05T00:00:40Z"), metadata: { toStatus: "OFFER" } },
    { type: "STATUS_CHANGE", occurredAt: t("2026-03-05T00:02:00Z"), metadata: { toStatus: "OFFER" } },
  ] });
  assert.equal(m.length, 2);
});
test("milestone keys exist in every locale", () => {
  const all = ["Viewing", "Offer", "Reserved", "Closed", "OnHold", "Lost", "Contacted", "Communicating"].map((s) => `milestones.status${s}`)
    .concat(["firstContact", "viewingConfirmed", "dealCreated", "dealEarned", "dealCancelled", "message"].map((k) => `milestones.${k}`));
  for (const l of PARTNER_LOCALES) for (const k of all) assert.ok(lookup(l, k), `${l} ${k}`);
});
test("responseMinutes", () => {
  assert.equal(responseMinutes(claim, []), null);
  assert.equal(responseMinutes(claim, [{ type: "NOTE", occurredAt: t("2026-03-01T10:05:00Z"), metadata: null }]), null);
  assert.equal(responseMinutes(claim, [
    { type: "CALL", occurredAt: t("2026-03-01T09:00:00Z"), metadata: null },
    { type: "WHATSAPP_OUT", occurredAt: t("2026-03-01T11:30:00Z"), metadata: null },
    { type: "CALL", occurredAt: t("2026-03-02T11:30:00Z"), metadata: null },
  ]), 90);
});
