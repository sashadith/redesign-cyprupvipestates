import { test } from "node:test";
import assert from "node:assert/strict";
import { partnerLeadLight, splitPartnerCards, stageAgeText, stageSinceOf, thresholdsFromEnv, type LightThresholds } from "@/lib/crm/partnerPipelines";

const DAY = 86_400_000;
const now = new Date("2026-11-05T12:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * DAY);
const T: LightThresholds = { amberOverdueDays: 1, amberQuietDays: 7, redOverdueDays: 3, redQuietDays: 14 };
const fresh = { nextFollowUpAt: null, lastEntryAt: ago(1), createdAt: ago(2) };

test("fresh lead is green", () => {
  assert.equal(partnerLeadLight(fresh, now, T), "green");
  assert.equal(partnerLeadLight({ ...fresh, nextFollowUpAt: new Date(now.getTime() + DAY) }, now, T), "green");
});

test("follow-up overdue: 2 days amber, 3 days red", () => {
  assert.equal(partnerLeadLight({ ...fresh, nextFollowUpAt: ago(2) }, now, T), "amber");
  assert.equal(partnerLeadLight({ ...fresh, nextFollowUpAt: ago(3) }, now, T), "red");
});

test("quiet: 8 days amber, 14 days red", () => {
  assert.equal(partnerLeadLight({ ...fresh, lastEntryAt: ago(8) }, now, T), "amber");
  assert.equal(partnerLeadLight({ ...fresh, lastEntryAt: ago(14) }, now, T), "red");
});

test("no entry: quiet counts from createdAt", () => {
  assert.equal(partnerLeadLight({ nextFollowUpAt: null, lastEntryAt: null, createdAt: ago(9) }, now, T), "amber");
  assert.equal(partnerLeadLight({ nextFollowUpAt: null, lastEntryAt: null, createdAt: ago(20) }, now, T), "red");
});

test("thresholdsFromEnv: defaults and overrides", () => {
  const def = { amberOverdueDays: 1, amberQuietDays: 7, redOverdueDays: 3, redQuietDays: 14 };
  assert.deepEqual(thresholdsFromEnv({}), def);
  assert.deepEqual(thresholdsFromEnv({ PARTNER_PIPELINE_AMBER: "abc", PARTNER_PIPELINE_RED: "x,y" }), def);
  assert.deepEqual(thresholdsFromEnv({ PARTNER_PIPELINE_AMBER: "0,3", PARTNER_PIPELINE_RED: "-1,5" }), def);
  assert.deepEqual(thresholdsFromEnv({ PARTNER_PIPELINE_AMBER: "2,5", PARTNER_PIPELINE_RED: "4,10" }),
    { amberOverdueDays: 2, amberQuietDays: 5, redOverdueDays: 4, redQuietDays: 10 });
  // red must not be below amber
  assert.deepEqual(thresholdsFromEnv({ PARTNER_PIPELINE_AMBER: "5,20", PARTNER_PIPELINE_RED: "3,14" }), def);
});

test("splitPartnerCards: lapsed or inactive-partner cards go to the flagged group, handed-over ones nowhere", () => {
  const cards = [
    { id: "work", handedOver: false, expired: false },
    { id: "lapsed", handedOver: false, expired: true },
    { id: "handed", handedOver: true, expired: false },
  ];
  const active = splitPartnerCards(cards, "ACTIVE");
  assert.deepEqual(active.working.map((c) => c.id), ["work"]);
  assert.deepEqual(active.stuck.map((c) => [c.id, c.stuckReason]), [["lapsed", "protection_lapsed"]]);
  const suspended = splitPartnerCards(cards, "SUSPENDED");
  assert.deepEqual(suspended.working, []);
  assert.deepEqual(suspended.stuck.map((c) => [c.id, c.stuckReason]), [["work", "partner_inactive"], ["lapsed", "partner_inactive"]]);
});

test("stage age: from the newest status move, else the claim; whole days", () => {
  assert.equal(stageSinceOf(ago(5), ago(20)).getTime(), ago(5).getTime());
  assert.equal(stageSinceOf(null, ago(20)).getTime(), ago(20).getTime());
  assert.equal(stageAgeText(ago(5.4), now), "in stage 5 d");
  assert.equal(stageAgeText(ago(0.3), now), "in stage < 1 d");
});
