import { test } from "node:test";
import assert from "node:assert/strict";
import {
  leadTemperature, TEMPERATURE_WEIGHTS, TEMPERATURE_HOT_MIN, TEMPERATURE_WARM_MIN, type TemperatureInput,
} from "../crm/insights/temperature";
import { channelRows, median, pct1, type ChannelLead } from "../crm/insights/channels";
import { commissionOutlook, OUTLOOK_WEIGHT, type OutlookDeal } from "../crm/insights/outlook";
import {
  partnerQualityRows, LOW_QUALITY_MIN_SUBMITTED, LOW_QUALITY_VALID_RATIO, TOP_PARTNER_MIN_CLOSED, type PartnerClaimFact,
} from "../crm/insights/partnerQuality";
import { resolvePeriod } from "../crm/insights/period";

const NOW = new Date("2026-10-19T09:00:00Z");
const DAY = 86_400_000;
const ago = (days: number, base = NOW) => new Date(base.getTime() - days * DAY);

function ti(over: Partial<TemperatureInput> = {}): TemperatureInput {
  return {
    status: "CONTACTED", timeline: null, budgetMin: null, budgetMax: null, createdAt: ago(3),
    lastInboundAt: null, lastRealContactAt: ago(1), lastPresentationViewAt: null, lastFavoriteAt: null, ...over,
  };
}

// ---------- temperature ----------
test("temperature: closed, lost and keep-contact leads get no temperature", () => {
  for (const status of ["CLOSED", "LOST", "KEEP_CONTACT"]) assert.equal(leadTemperature(ti({ status }), NOW), null);
});

test("temperature: weights constant matches the decision table", () => {
  assert.equal(TEMPERATURE_WEIGHTS.stage.VIEWING_SCHEDULED, 3);
  assert.equal(TEMPERATURE_WEIGHTS.stage.OFFER, 4);
  assert.equal(TEMPERATURE_WEIGHTS.stage.RESERVED, 5);
  assert.equal(TEMPERATURE_WEIGHTS.stage.COMMUNICATING, 1);
  assert.equal(TEMPERATURE_WEIGHTS.timeline.IMMEDIATE, 2);
  assert.equal(TEMPERATURE_WEIGHTS.timeline.JUST_LOOKING, -1);
  assert.equal(TEMPERATURE_HOT_MIN, 5);
  assert.equal(TEMPERATURE_WARM_MIN, 2);
});

test("temperature: stage points", () => {
  assert.equal(leadTemperature(ti({ status: "VIEWING_SCHEDULED" }), NOW)?.score, 3);
  assert.equal(leadTemperature(ti({ status: "OFFER" }), NOW)?.score, 4);
  assert.equal(leadTemperature(ti({ status: "RESERVED" }), NOW)?.score, 5);
  assert.equal(leadTemperature(ti({ status: "COMMUNICATING" }), NOW)?.score, 1);
  assert.equal(leadTemperature(ti({ status: "NEW" }), NOW)?.score, 0);
});

test("temperature: thresholds 5 hot, 2-4 warm, <=1 cold", () => {
  assert.equal(leadTemperature(ti({ status: "RESERVED" }), NOW)?.level, "hot"); // 5
  assert.equal(leadTemperature(ti({ status: "OFFER" }), NOW)?.level, "warm"); // 4
  assert.equal(leadTemperature(ti({ status: "OFFER", timeline: "JUST_LOOKING" }), NOW)?.level, "warm"); // 3
  assert.equal(leadTemperature(ti({ timeline: "IMMEDIATE" }), NOW)?.level, "warm"); // 2
  assert.equal(leadTemperature(ti({ status: "COMMUNICATING" }), NOW)?.level, "cold"); // 1
  assert.equal(leadTemperature(ti({ timeline: "JUST_LOOKING" }), NOW)?.level, "cold"); // -1
});

test("temperature: timeline and budget points", () => {
  assert.equal(leadTemperature(ti({ timeline: "THREE_MONTHS" }), NOW)?.score, 1);
  assert.equal(leadTemperature(ti({ timeline: "SIX_MONTHS" }), NOW)?.score, 0);
  assert.equal(leadTemperature(ti({ budgetMin: 300000 }), NOW)?.score, 1);
  assert.equal(leadTemperature(ti({ budgetMax: 500000 }), NOW)?.score, 1);
  assert.equal(leadTemperature(ti({ budgetMin: 1, budgetMax: 2 }), NOW)?.score, 1);
  assert.equal(leadTemperature(ti({ budgetMin: 0, budgetMax: null }), NOW)?.score, 0);
});

test("temperature: inbound window 7 days = +3, up to 30 days = +1, beyond = 0", () => {
  assert.equal(leadTemperature(ti({ lastInboundAt: ago(7) }), NOW)?.score, 3);
  assert.equal(leadTemperature(ti({ lastInboundAt: new Date(ago(7).getTime() - 1) }), NOW)?.score, 1);
  assert.equal(leadTemperature(ti({ lastInboundAt: ago(30) }), NOW)?.score, 1);
  assert.equal(leadTemperature(ti({ lastInboundAt: new Date(ago(30).getTime() - 1) }), NOW)?.score, 0);
});

test("temperature: presentation and favorite windows are 14 days", () => {
  assert.equal(leadTemperature(ti({ lastPresentationViewAt: ago(14) }), NOW)?.score, 2);
  assert.equal(leadTemperature(ti({ lastPresentationViewAt: new Date(ago(14).getTime() - 1) }), NOW)?.score, 0);
  assert.equal(leadTemperature(ti({ lastFavoriteAt: ago(14) }), NOW)?.score, 1);
  assert.equal(leadTemperature(ti({ lastFavoriteAt: new Date(ago(14).getTime() - 1) }), NOW)?.score, 0);
});

test("temperature: last real contact older than 30 days costs 2", () => {
  assert.equal(leadTemperature(ti({ lastRealContactAt: ago(30) }), NOW)?.score, 0);
  const t = leadTemperature(ti({ lastRealContactAt: ago(41) }), NOW)!;
  assert.equal(t.score, -2);
  assert.ok(t.reasons.includes("No contact for 41 days"));
});

test("temperature: never contacted costs 2 only once the lead is older than 7 days", () => {
  assert.equal(leadTemperature(ti({ lastRealContactAt: null, createdAt: ago(7) }), NOW)?.score, 0);
  assert.equal(leadTemperature(ti({ lastRealContactAt: null, createdAt: new Date(ago(7).getTime() - 1) }), NOW)?.score, -2);
  const t = leadTemperature(ti({ lastRealContactAt: null, createdAt: ago(8) }), NOW)!;
  assert.equal(t.score, -2);
  assert.ok(t.reasons.includes("Never contacted (8 days old)"));
});

test("temperature: lead older than 90 days still at NEW/CONTACTED costs 2", () => {
  const base = { lastRealContactAt: ago(1) };
  assert.equal(leadTemperature(ti({ ...base, createdAt: ago(90) }), NOW)?.score, 0);
  assert.equal(leadTemperature(ti({ ...base, createdAt: ago(91) }), NOW)?.score, -2);
  assert.equal(leadTemperature(ti({ ...base, status: "NEW", createdAt: ago(91) }), NOW)?.score, -2);
  assert.equal(leadTemperature(ti({ ...base, status: "COMMUNICATING", createdAt: ago(91) }), NOW)?.score, 1);
});

test("temperature: reasons carry day counts and read as short English chips", () => {
  const t = leadTemperature(ti({
    status: "VIEWING_SCHEDULED", timeline: "IMMEDIATE", budgetMax: 400000, lastInboundAt: ago(2),
    lastPresentationViewAt: ago(5), lastFavoriteAt: ago(0),
  }), NOW)!;
  assert.equal(t.score, 3 + 2 + 1 + 3 + 2 + 1);
  assert.equal(t.level, "hot");
  for (const r of ["Viewing scheduled", "Replied 2 days ago", "Presentation opened 5 days ago", "Favorite added today", "Wants to buy now", "Budget given"]) {
    assert.ok(t.reasons.includes(r), r);
  }
  assert.ok(leadTemperature(ti({ lastInboundAt: ago(1) }), NOW)!.reasons.includes("Replied 1 day ago"));
});

// ---------- channels ----------
test("median: odd, even (mean of the middle two, rounded), empty", () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([1, 2, 3, 10]), 3); // (2+3)/2 = 2.5 -> 3
  assert.equal(median([10, 20]), 15);
  assert.equal(median([1, 4]), 3); // 2.5 -> 3
  assert.equal(median([]), null);
});

test("pct1: one decimal, null for an empty denominator", () => {
  assert.equal(pct1(1, 3), 33.3);
  assert.equal(pct1(2, 3), 66.7);
  assert.equal(pct1(0, 5), 0);
  assert.equal(pct1(5, 5), 100);
  assert.equal(pct1(0, 0), null);
});

const cl = (id: string, source: string, over: Partial<ChannelLead> = {}): ChannelLead => ({
  id, source, partnerMode: null, status: "NEW", createdAt: new Date("2026-10-01T10:00:00Z"), ...over,
});

test("channels: empty cohort gives no rows", () => {
  assert.deepEqual(channelRows({ leads: [], firstContacts: [], viewings: [], deals: [] }), []);
});

test("channels: one row per source present, PARTNER split by mode, NEWSLETTER and trashed excluded", () => {
  const rows = channelRows({
    leads: [
      cl("a", "CONTACT_FORM"), cl("b", "CONTACT_FORM"), cl("c", "NEWSLETTER"), cl("d", "CONTACT_FORM", { trashed: true }),
      cl("p1", "PARTNER", { partnerMode: "HANDOVER" }), cl("p2", "PARTNER", { partnerMode: "FIX" }),
      cl("p3", "PARTNER", { partnerMode: "FIX" }), cl("p4", "PARTNER"),
    ],
    firstContacts: [], viewings: [], deals: [],
  });
  assert.deepEqual(rows.map((r) => [r.label, r.leads]), [
    ["CONTACT_FORM", 2], ["PARTNER · Fix", 2], ["PARTNER", 1], ["PARTNER · Handover", 1],
  ]);
});

test("channels: contacted %, median first response, viewings, reserved+closed, won rate, commission", () => {
  const t0 = new Date("2026-10-01T10:00:00Z");
  const at = (min: number) => new Date(t0.getTime() + min * 60_000);
  const rows = channelRows({
    leads: [
      cl("a", "WHATSAPP", { status: "CLOSED" }),
      cl("b", "WHATSAPP", { status: "RESERVED" }),
      cl("c", "WHATSAPP", { status: "LOST" }),
      cl("d", "WHATSAPP", { status: "COMMUNICATING" }),
    ],
    firstContacts: [
      { leadId: "a", at: at(10) }, { leadId: "b", at: at(30) }, { leadId: "c", at: at(60) },
      { leadId: "zzz", at: at(1) }, // not in the cohort
    ],
    viewings: ["c"], // lost after a viewing; a and b count through their current status
    deals: [
      { leadId: "a", status: "PAID_OUT", ourCommission: 10_000 },
      { leadId: "a", status: "EARNED", ourCommission: 2_500.4 },
      { leadId: "b", status: "EXPECTED", ourCommission: 7_000 },
      { leadId: "b", status: "CANCELLED", ourCommission: 9_999 },
      { leadId: "x", status: "EARNED", ourCommission: 99 },
    ],
  });
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.leads, 4);
  assert.equal(r.contacted, 3);
  assert.equal(r.contactedPct, 75);
  assert.equal(r.medianFirstResponseMin, 30); // 10, 30, 60
  assert.equal(r.viewings, 3);
  assert.equal(r.reservedOrClosed, 2);
  assert.equal(r.closed, 1);
  assert.equal(r.wonRate, 25);
  assert.equal(r.earnedCommission, 12_500);
});

test("channels: a source with no contacts has null median and 0% contacted", () => {
  const [r] = channelRows({ leads: [cl("a", "PHONE")], firstContacts: [], viewings: [], deals: [] });
  assert.equal(r.contactedPct, 0);
  assert.equal(r.medianFirstResponseMin, null);
  assert.equal(r.wonRate, 0);
  assert.equal(r.earnedCommission, 0);
});

// ---------- outlook ----------
const deal = (over: Partial<OutlookDeal>): OutlookDeal => ({
  status: "EXPECTED", ourCommission: 0, partnerCommission: null, earnedAt: null, developerPaidAt: null, paidOutAt: null, ...over,
});

test("outlook: OUTLOOK_WEIGHT is 0.7 and weighted rounds to whole euros", () => {
  assert.equal(OUTLOOK_WEIGHT, 0.7);
  const o = commissionOutlook({ deals: [deal({ ourCommission: 1_001 })], now: NOW, period: { from: ago(30), to: NOW } });
  assert.equal(o.totals.expected, 1_001);
  assert.equal(o.weightedExpected, 701); // 700.7
  const o2 = commissionOutlook({ deals: [deal({ ourCommission: 1_000.4 }), deal({ ourCommission: 0.5 })], now: NOW, period: { from: ago(30), to: NOW } });
  assert.equal(o2.totals.expected, 1_001); // 1000.9
  assert.equal(o2.weightedExpected, 701);
});

test("outlook: totals by stage, cancelled ignored, paid out only inside the period, partner owed", () => {
  const o = commissionOutlook({
    now: NOW, period: { from: new Date("2026-10-01T00:00:00Z"), to: NOW },
    deals: [
      deal({ status: "EXPECTED", ourCommission: 5_000 }),
      deal({ status: "EARNED", ourCommission: 4_000, partnerCommission: 1_000, earnedAt: ago(5) }),
      deal({ status: "DEVELOPER_PAID", ourCommission: 3_000, partnerCommission: 600, earnedAt: ago(40), developerPaidAt: ago(2) }),
      deal({ status: "DEVELOPER_PAID", ourCommission: 800, earnedAt: ago(40), developerPaidAt: ago(2) }),
      deal({ status: "PAID_OUT", ourCommission: 2_000, partnerCommission: 500, paidOutAt: ago(3) }),
      deal({ status: "PAID_OUT", ourCommission: 1_500, paidOutAt: ago(60) }),
      deal({ status: "CANCELLED", ourCommission: 9_000, partnerCommission: 900, earnedAt: ago(5) }),
    ],
  });
  assert.deepEqual(o.totals, { expected: 5_000, earned: 4_000, developerPaid: 3_800, paidOutInPeriod: 2_000 });
  assert.equal(o.partnerOwed, 1_600);
});

test("outlook: 12 monthly buckets ending at the current Cyprus month, empty months included", () => {
  const o = commissionOutlook({ deals: [], now: NOW, period: { from: ago(30), to: NOW } });
  assert.equal(o.months.length, 12);
  assert.equal(o.months[0].month, "2025-11");
  assert.equal(o.months[11].month, "2026-10");
  assert.ok(o.months.every((m) => m.earned === 0 && m.developerPaid === 0));
});

test("outlook: month bucketing uses Cyprus time at month end (summer UTC+3, winter UTC+2)", () => {
  // 21:30Z on 31 Aug = 00:30 on 1 Sep in Cyprus; 21:30Z on 30 Nov = 23:30 on 30 Nov (UTC+2); 22:30Z on 30 Nov = 00:30 on 1 Dec.
  const o = commissionOutlook({
    now: new Date("2026-12-15T10:00:00Z"), period: { from: ago(30), to: NOW },
    deals: [
      deal({ status: "EARNED", ourCommission: 100, earnedAt: new Date("2026-08-31T21:30:00Z") }),
      deal({ status: "EARNED", ourCommission: 200, earnedAt: new Date("2026-08-31T20:30:00Z") }),
      deal({ status: "EARNED", ourCommission: 300, earnedAt: new Date("2026-11-30T21:30:00Z") }),
      deal({ status: "EARNED", ourCommission: 400, earnedAt: new Date("2026-11-30T22:30:00Z") }),
      deal({ status: "DEVELOPER_PAID", ourCommission: 50, earnedAt: new Date("2026-11-30T22:30:00Z"), developerPaidAt: new Date("2026-12-01T09:00:00Z") }),
    ],
  });
  const by = Object.fromEntries(o.months.map((m) => [m.month, m]));
  assert.equal(by["2026-08"].earned, 200);
  assert.equal(by["2026-09"].earned, 100);
  assert.equal(by["2026-11"].earned, 300);
  assert.equal(by["2026-12"].earned, 450);
  assert.equal(by["2026-12"].developerPaid, 50);
  assert.equal(o.months[0].month, "2026-01");
  assert.equal(o.months[11].month, "2026-12");
});

test("outlook: events older than 12 months fall out, cancelled deals never count", () => {
  const o = commissionOutlook({
    now: NOW, period: { from: ago(30), to: NOW },
    deals: [
      deal({ status: "EARNED", ourCommission: 100, earnedAt: new Date("2025-10-31T10:00:00Z") }),
      deal({ status: "CANCELLED", ourCommission: 100, earnedAt: ago(2) }),
    ],
  });
  assert.ok(o.months.every((m) => m.earned === 0));
});

// ---------- partner quality ----------
const partners = [{ id: "p1", name: "Alpha", status: "ACTIVE" }, { id: "p2", name: "Beta", status: "SUSPENDED" }];
function cf(over: Partial<PartnerClaimFact> = {}): PartnerClaimFact {
  return {
    partnerId: "p1", state: "ACTIVE", createdAt: ago(20), reviewedAt: null, lastRealContactAt: ago(2),
    leadDeleted: false, leadStatus: "CONTACTED", leadLostReason: null, hasLiveDeal: false,
    reachedViewing: false, responseMinutes: null, ...over,
  };
}

test("partner quality: constants", () => {
  assert.equal(LOW_QUALITY_MIN_SUBMITTED, 5);
  assert.equal(LOW_QUALITY_VALID_RATIO, 0.4);
  assert.equal(TOP_PARTNER_MIN_CLOSED, 2);
});

test("partner quality: counts, valid, viewing, closed, conversion, response median", () => {
  const rows = partnerQualityRows({
    partners, now: NOW,
    claims: [
      cf({ responseMinutes: 10 }),
      cf({ leadStatus: "LOST", leadLostReason: "UNREACHABLE" }),
      cf({ leadStatus: "LOST", leadLostReason: "BUDGET", reachedViewing: true, responseMinutes: 30 }),
      cf({ leadStatus: "CLOSED", hasLiveDeal: true, reachedViewing: true, responseMinutes: 50 }),
      cf({ state: "IN_REVIEW" }),
      cf({ state: "REJECTED" }),
      cf({ state: "REJECTED" }),
    ],
  });
  const a = rows.find((r) => r.partnerId === "p1")!;
  assert.equal(a.submitted, 7);
  assert.equal(a.accepted, 4);
  assert.equal(a.inReview, 1);
  assert.equal(a.rejected, 2);
  assert.equal(a.valid, 3);
  assert.equal(a.reachedViewing, 2);
  assert.equal(a.closed, 1);
  assert.equal(a.conversionPct, 25);
  assert.equal(a.medianResponseMin, 30);
  const b = rows.find((r) => r.partnerId === "p2")!;
  assert.equal(b.submitted, 0);
  assert.equal(b.conversionPct, null);
  assert.equal(b.medianResponseMin, null);
  assert.deepEqual([b.lowQuality, b.topPartner], [false, false]);
});

test("partner quality: accepted = passed review (ACTIVE or EXPIRED), expiry never reduces it, trashed excluded", () => {
  const rows = partnerQualityRows({
    partners: [partners[0]], now: NOW,
    claims: [
      cf(), // plain active
      cf({ state: "ACTIVE", createdAt: ago(400), lastRealContactAt: null, leadStatus: "RESERVED" }), // old but committed
      cf({ state: "ACTIVE", createdAt: ago(400), lastRealContactAt: null }), // protection ran out: still accepted, valid
      cf({ state: "EXPIRED" }), // stored EXPIRED: still accepted
      cf({ state: "ACTIVE", leadDeleted: true }), // trashed lead: not accepted
      cf({ state: "IN_REVIEW", leadStatus: "RESERVED" }), // never
      cf({ state: "REJECTED", hasLiveDeal: true }), // never
    ],
  });
  assert.equal(rows[0].accepted, 4);
  assert.equal(rows[0].valid, 4);
  assert.equal(rows[0].inReview, 1);
  assert.equal(rows[0].rejected, 1);
});

test("partner quality: low quality = valid / decided < 40%, decided = submitted - inReview, needs 5 decided", () => {
  const bad = (n: number, validN: number) => [
    ...Array.from({ length: validN }, () => cf()),
    ...Array.from({ length: n - validN }, () => cf({ leadStatus: "LOST", leadLostReason: "INVALID" })),
  ];
  const run = (claims: PartnerClaimFact[]) => partnerQualityRows({ partners: [partners[0]], claims, now: NOW })[0];
  assert.equal(run(bad(5, 1)).lowQuality, true); // 20%
  assert.equal(run(bad(5, 2)).lowQuality, false); // exactly 40%
  assert.equal(run(bad(4, 0)).lowQuality, false); // too few
  assert.equal(run(bad(10, 3)).lowQuality, true); // 30%
  assert.equal(run(bad(10, 4)).lowQuality, false); // exactly 40%
  const inReview = (k: number) => Array.from({ length: k }, () => cf({ state: "IN_REVIEW" }));
  assert.equal(run([...bad(4, 0), ...inReview(10)]).lowQuality, false); // only 4 decided
  assert.equal(run([...bad(5, 2), ...inReview(10)]).lowQuality, false); // 2/5 = 40%, review claims do not dilute
  assert.equal(run([...bad(5, 1), ...inReview(10)]).lowQuality, true); // 1/5
});

test("partner quality: top partner needs 2 closed", () => {
  const run = (n: number) => partnerQualityRows({
    partners: [partners[0]], now: NOW,
    claims: Array.from({ length: n }, () => cf({ leadStatus: "CLOSED", hasLiveDeal: true })),
  })[0];
  assert.equal(run(1).topPartner, false);
  assert.equal(run(2).topPartner, true);
});

// ---------- period ----------
test("period: this month starts at the Cyprus month start and ends at tomorrow start", () => {
  const p = resolvePeriod({ preset: "this_month", now: NOW }); // 19 Oct, UTC+3
  assert.equal(p.preset, "this_month");
  assert.equal(p.fromKey, "2026-10-01");
  assert.equal(p.toKey, "2026-10-19");
  assert.equal(p.from.toISOString(), "2026-09-30T21:00:00.000Z");
  assert.equal(p.to.toISOString(), "2026-10-19T21:00:00.000Z");
});

test("period: Cyprus day boundary, 21:30Z on the 18th is already the 19th", () => {
  const p = resolvePeriod({ preset: "this_month", now: new Date("2026-10-18T21:30:00Z") });
  assert.equal(p.toKey, "2026-10-19");
});

test("period: last 3 months, this year, last 12 months", () => {
  const m3 = resolvePeriod({ preset: "last_3_months", now: NOW });
  assert.equal(m3.fromKey, "2026-08-01");
  const y = resolvePeriod({ preset: "this_year", now: NOW });
  assert.equal(y.fromKey, "2026-01-01");
  assert.equal(y.from.toISOString(), "2025-12-31T22:00:00.000Z"); // winter UTC+2
  const m12 = resolvePeriod({ preset: "last_12_months", now: NOW });
  assert.equal(m12.fromKey, "2025-11-01");
  const jan = resolvePeriod({ preset: "last_3_months", now: new Date("2026-01-10T10:00:00Z") });
  assert.equal(jan.fromKey, "2025-11-01");
});

test("period: custom range is inclusive of the end day", () => {
  const p = resolvePeriod({ preset: "custom", from: "2026-03-30", to: "2026-03-31", now: NOW });
  assert.equal(p.preset, "custom");
  assert.equal(p.fromKey, "2026-03-30");
  assert.equal(p.toKey, "2026-03-31");
  assert.equal(p.from.toISOString(), "2026-03-29T21:00:00.000Z"); // before DST (UTC+2)
  assert.equal(p.to.toISOString(), "2026-03-31T21:00:00.000Z"); // 1 Apr 00:00 Cyprus after DST (UTC+3)
});

test("period: invalid or reversed custom input and unknown preset fall back to this month", () => {
  assert.equal(resolvePeriod({ preset: "custom", from: "nope", to: "2026-03-31", now: NOW }).preset, "this_month");
  assert.equal(resolvePeriod({ preset: "custom", from: "2026-04-02", to: "2026-04-01", now: NOW }).preset, "this_month");
  assert.equal(resolvePeriod({ preset: "custom", from: "2026-02-31", to: "2026-03-01", now: NOW }).preset, "this_month");
  assert.equal(resolvePeriod({ preset: "bogus", now: NOW }).preset, "this_month");
  assert.equal(resolvePeriod({ now: NOW }).preset, "this_month");
});
