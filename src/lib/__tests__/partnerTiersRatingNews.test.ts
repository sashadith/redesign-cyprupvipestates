import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChangeEvent } from "@/lib/crm/inventoryChanges";
import { PARTNER_LOCALES, dict, fmt } from "@/lib/partner/i18n";
import { buildTierUpEmail } from "@/lib/partner/notify";
import { buildTelegramNotification } from "@/lib/partner/telegram";
import {
  CLOSED_DEAL_STATUSES, closedDealsLast12Months, proposeTier, tierProgress, validateTierConfig, type TierConfig,
} from "@/lib/partner/tiers";
import {
  DEFAULT_POINT_RULES, countdown, pointEventsFor, pseudonym, pseudonyms, rankPartners, seasonPrizes, validateSeason,
  type ClaimPointFacts, type SeasonForPoints,
} from "@/lib/partner/rating";
import { NEWS_MAX_ITEMS, newsItems, unreadCount, type NewsAvailability } from "@/lib/partner/news";

const DAY = 86_400_000;
const NOW = new Date("2026-10-19T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

// ── Tiers ───────────────────────────────────────────────────────────────────

const TIERS: TierConfig[] = [
  { key: "gold", name: "Gold", sort: 2, minClosedDeals: 3, handoverShare: 35, fixShare: 55, active: true },
  { key: "silver", name: "Silver", sort: 1, minClosedDeals: 0, handoverShare: 30, fixShare: 50, active: true },
  { key: "platinum", name: "Platinum", sort: 3, minClosedDeals: 6, handoverShare: 40, fixShare: 60, active: true },
];

test("closedDealsLast12Months: closed statuses only, rolling 365 days, earnedAt required", () => {
  assert.deepEqual([...CLOSED_DEAL_STATUSES], ["EARNED", "DEVELOPER_PAID", "PAID_OUT"]);
  const deals = [
    { commissionStatus: "EARNED", earnedAt: ago(1) },
    { commissionStatus: "DEVELOPER_PAID", earnedAt: ago(100) },
    { commissionStatus: "PAID_OUT", earnedAt: ago(365) }, // boundary: exactly 365 days counts
    { commissionStatus: "PAID_OUT", earnedAt: new Date(ago(365).getTime() - 1) }, // one ms older: out
    { commissionStatus: "EXPECTED", earnedAt: ago(1) },
    { commissionStatus: "CANCELLED", earnedAt: ago(1) },
    { commissionStatus: "EARNED", earnedAt: null },
    { commissionStatus: "EARNED", earnedAt: new Date(NOW.getTime() + DAY) }, // future: not counted
  ];
  assert.equal(closedDealsLast12Months(deals, NOW), 3);
  assert.equal(closedDealsLast12Months([], NOW), 0);
});

test("proposeTier: thresholds are inclusive and pick the highest reachable tier", () => {
  assert.equal(proposeTier(null, 0, TIERS), null, "silver at 0 is not an upgrade for an unset tier (counts as silver)");
  assert.equal(proposeTier(null, 2, TIERS), null);
  assert.equal(proposeTier(null, 3, TIERS)?.key, "gold");
  assert.equal(proposeTier("silver", 5, TIERS)?.key, "gold");
  assert.equal(proposeTier("silver", 6, TIERS)?.key, "platinum", "skips a level when the count allows it");
  assert.equal(proposeTier("gold", 6, TIERS)?.key, "platinum");
  assert.equal(proposeTier("gold", 5, TIERS), null);
});

test("proposeTier: never downgrades and ignores inactive tiers", () => {
  assert.equal(proposeTier("platinum", 0, TIERS), null);
  assert.equal(proposeTier("gold", 1, TIERS), null);
  assert.equal(proposeTier("platinum", 99, TIERS), null, "nothing above the top tier");
  const goldOff = TIERS.map((t) => (t.key === "gold" ? { ...t, active: false } : t));
  assert.equal(proposeTier("silver", 4, goldOff), null);
  assert.equal(proposeTier("silver", 6, goldOff)?.key, "platinum");
  assert.equal(proposeTier("unknown-key", 3, TIERS)?.key, "gold", "an unknown current key counts as the lowest tier");
  assert.equal(proposeTier("silver", 9, []), null);
});

test("tierProgress: remaining deals and percentage toward the next tier", () => {
  const p0 = tierProgress(null, 0, TIERS);
  assert.equal(p0.current.key, "silver");
  assert.equal(p0.next?.key, "gold");
  assert.equal(p0.remaining, 3);
  assert.equal(p0.pct, 0);
  const p1 = tierProgress("silver", 1, TIERS);
  assert.equal(p1.remaining, 2);
  assert.equal(p1.pct, 33);
  const g = tierProgress("gold", 4, TIERS);
  assert.equal(g.next?.key, "platinum");
  assert.equal(g.remaining, 2);
  assert.equal(g.pct, 33, "measured from the current tier's threshold");
  const pending = tierProgress("silver", 4, TIERS);
  assert.equal(pending.remaining, 0, "count already past the next threshold (proposal pending)");
  assert.equal(pending.pct, 100);
});

test("tierProgress: top tier has no next tier and a full bar", () => {
  const top = tierProgress("platinum", 2, TIERS);
  assert.equal(top.current.key, "platinum");
  assert.equal(top.next, null);
  assert.equal(top.remaining, 0);
  assert.equal(top.pct, 100);
  assert.throws(() => tierProgress(null, 0, []));
});

test("validateTierConfig: defaults pass; each rule reports an error", () => {
  assert.deepEqual(validateTierConfig(TIERS), []);
  const bad = (patch: (t: TierConfig[]) => TierConfig[]) => validateTierConfig(patch(TIERS.map((t) => ({ ...t }))));
  assert.ok(bad((t) => t.map((x) => (x.key === "gold" ? { ...x, minClosedDeals: 6 } : x))).length, "equal thresholds");
  assert.ok(bad((t) => t.map((x) => (x.key === "gold" ? { ...x, minClosedDeals: 7 } : x))).length, "decreasing thresholds");
  assert.ok(bad((t) => t.map((x) => (x.key === "gold" ? { ...x, handoverShare: 100.01 } : x))).length, "share > 100");
  assert.ok(bad((t) => t.map((x) => (x.key === "gold" ? { ...x, fixShare: -1 } : x))).length, "share < 0");
  assert.ok(bad((t) => t.map((x) => (x.key === "gold" ? { ...x, name: "  " } : x))).length, "empty name");
  assert.ok(bad((t) => t.map((x) => (x.key === "gold" ? { ...x, name: "x".repeat(41) } : x))).length, "name > 40");
  assert.ok(bad((t) => t.map((x) => (x.key === "silver" ? { ...x, minClosedDeals: 1 } : x))).length, "no active tier with 0");
  assert.ok(bad((t) => t.map((x) => (x.key === "silver" ? { ...x, active: false } : x))).length, "the 0-tier inactive");
  assert.ok(bad((t) => t.map((x) => ({ ...x, active: false }))).length, "no active tier");
  assert.ok(bad((t) => t.map((x) => (x.key === "gold" ? { ...x, minClosedDeals: 2.5 } : x))).length, "non-integer threshold");
  assert.ok(bad((t) => [...t, { ...t[0] }]).length, "duplicate key");
  assert.deepEqual(validateTierConfig([TIERS[1]]), [], "a single silver tier is fine");
  assert.equal(validateTierConfig([TIERS[1], { ...TIERS[0], minClosedDeals: 6, active: false }, TIERS[2]]).length, 0, "inactive tiers do not take part in the ordering");
  assert.deepEqual(validateTierConfig(TIERS.map((t) => (t.key === "gold" ? { ...t, handoverShare: 0, fixShare: 100 } : t))), [], "0 and 100 are allowed");
});

// ── Rating ──────────────────────────────────────────────────────────────────

const SEASON: SeasonForPoints = {
  id: "s1",
  startsAt: new Date("2026-10-01T00:00:00Z"),
  endsAt: new Date("2026-12-31T23:59:59Z"),
  pointRules: { ...DEFAULT_POINT_RULES },
};
const d = (iso: string) => new Date(iso);

test("DEFAULT_POINT_RULES", () => {
  assert.deepEqual(DEFAULT_POINT_RULES, { claim_accepted: 10, viewing: 20, reserved: 50, closed: 100 });
});

test("validateSeason: a valid season normalises; defaults fill missing point rules", () => {
  const r = validateSeason({ name: "  Autumn 2026 ", startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-12-31T00:00:00Z", prizes: { en: " Trip ", de: "", pl: "Wycieczka" } });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.name, "Autumn 2026");
  assert.deepEqual(r.value.pointRules, DEFAULT_POINT_RULES);
  assert.deepEqual(r.value.prizes, { en: "Trip", pl: "Wycieczka" });
  assert.ok(r.value.startsAt instanceof Date);
  const custom = validateSeason({ name: "S", startsAt: new Date("2026-10-01"), endsAt: new Date("2026-10-02"), prizes: { en: "x" }, pointRules: { viewing: 0, closed: 1000 } });
  assert.ok(custom.ok && custom.value.pointRules.viewing === 0 && custom.value.pointRules.closed === 1000 && custom.value.pointRules.reserved === 50);
});

test("validateSeason: boundaries", () => {
  const base = { name: "S", startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-02-01T00:00:00Z", prizes: { en: "Prize" } };
  const fails = (o: Record<string, unknown>) => !validateSeason({ ...base, ...o }).ok;
  assert.ok(fails({ name: "" }));
  assert.ok(fails({ name: "x".repeat(81) }));
  assert.ok(!fails({ name: "x".repeat(80) }));
  assert.ok(fails({ endsAt: base.startsAt }), "start must be before end");
  assert.ok(fails({ endsAt: "2025-12-31T00:00:00Z" }));
  assert.ok(fails({ startsAt: "nope" }));
  assert.ok(!fails({ endsAt: "2027-02-05T00:00:00Z" }), "exactly 400 days");
  assert.ok(fails({ endsAt: "2027-02-05T00:00:01Z" }), "over 400 days");
  assert.ok(fails({ pointRules: { viewing: 1001 } }));
  assert.ok(fails({ pointRules: { viewing: -1 } }));
  assert.ok(fails({ pointRules: { viewing: 2.5 } }));
  assert.ok(fails({ pointRules: { viewing: "20" } }));
  assert.ok(fails({ prizes: { en: "" } }), "EN prize required");
  assert.ok(fails({ prizes: {} }));
  assert.ok(fails({ prizes: null }));
  assert.ok(fails({ prizes: { en: "x".repeat(2001) } }));
  assert.ok(!fails({ prizes: { en: "x".repeat(2000) } }));
  assert.ok(fails({ prizes: { en: "x", ru: "x".repeat(2001) } }));
  assert.ok(!validateSeason(null).ok);
});

test("seasonPrizes falls back to English", () => {
  assert.equal(seasonPrizes({ en: "Trip", de: "Reise" }, "de"), "Reise");
  assert.equal(seasonPrizes({ en: "Trip", de: "Reise" }, "ru"), "Trip");
  assert.equal(seasonPrizes({ en: "Trip", pl: "  " }, "pl"), "Trip");
});

const fact = (o: Partial<ClaimPointFacts> = {}): ClaimPointFacts => ({
  claimId: "c1",
  partnerId: "p1",
  activeSince: d("2026-10-05T10:00:00Z"),
  acceptedAt: d("2026-10-05T10:00:00Z"),
  statusChanges: [],
  ...o,
});

test("pointEventsFor: one event per kind with refKey and the season's points", () => {
  const ev = pointEventsFor([
    fact({
      statusChanges: [
        { toStatus: "CONTACTED", at: d("2026-10-06T00:00:00Z") },
        { toStatus: "VIEWING_SCHEDULED", at: d("2026-10-07T00:00:00Z") },
        { toStatus: "OFFER", at: d("2026-10-08T00:00:00Z") },
        { toStatus: "VIEWING_SCHEDULED", at: d("2026-10-09T00:00:00Z") },
        { toStatus: "RESERVED", at: d("2026-10-10T00:00:00Z") },
        { toStatus: "CLOSED", at: d("2026-10-20T00:00:00Z") },
      ],
    }),
  ], SEASON);
  assert.deepEqual(ev.map((e) => [e.kind, e.refKey, e.points, e.at.toISOString()]), [
    ["claim_accepted", "claim_accepted:c1:s1", 10, "2026-10-05T10:00:00.000Z"],
    ["viewing", "viewing:c1:s1", 20, "2026-10-07T00:00:00.000Z"],
    ["reserved", "reserved:c1:s1", 50, "2026-10-10T00:00:00.000Z"],
    ["closed", "closed:c1:s1", 100, "2026-10-20T00:00:00.000Z"],
  ]);
  assert.ok(ev.every((e) => e.seasonId === "s1" && e.partnerId === "p1"));
  assert.equal(new Set(ev.map((e) => e.refKey)).size, ev.length);
});

test("pointEventsFor: idempotent (same input, same refKeys), order-independent", () => {
  const f = fact({ statusChanges: [{ toStatus: "CLOSED", at: d("2026-10-20T00:00:00Z") }, { toStatus: "OFFER", at: d("2026-10-08T00:00:00Z") }] });
  const a = pointEventsFor([f], SEASON);
  const b = pointEventsFor([f], SEASON);
  assert.deepEqual(a, b);
  // A later stage counts for every earlier milestone it implies.
  assert.deepEqual(a.map((e) => e.kind), ["claim_accepted", "viewing", "reserved", "closed"]);
  assert.equal(a.find((e) => e.kind === "viewing")!.at.toISOString(), "2026-10-08T00:00:00.000Z");
  assert.equal(a.find((e) => e.kind === "reserved")!.at.toISOString(), "2026-10-20T00:00:00.000Z", "CLOSED implies reserved");
});

test("pointEventsFor: season window is inclusive at both ends", () => {
  const atStart = pointEventsFor([fact({ activeSince: SEASON.startsAt, acceptedAt: SEASON.startsAt })], SEASON);
  assert.equal(atStart.length, 1);
  const atEnd = pointEventsFor([fact({ statusChanges: [{ toStatus: "VIEWING_SCHEDULED", at: SEASON.endsAt }] })], SEASON);
  assert.ok(atEnd.some((e) => e.kind === "viewing"));
  const before = pointEventsFor([fact({ activeSince: d("2026-09-30T23:59:59Z"), acceptedAt: d("2026-09-30T23:59:59Z") })], SEASON);
  assert.equal(before.length, 0);
  const after = pointEventsFor([fact({ statusChanges: [{ toStatus: "CLOSED", at: new Date(SEASON.endsAt.getTime() + 1) }] })], SEASON);
  assert.deepEqual(after.map((e) => e.kind), ["claim_accepted"]);
});

test("pointEventsFor: a milestone first reached before the season never counts in a later one", () => {
  const ev = pointEventsFor([fact({
    activeSince: d("2026-09-01T00:00:00Z"), acceptedAt: d("2026-09-01T00:00:00Z"),
    statusChanges: [
      { toStatus: "VIEWING_SCHEDULED", at: d("2026-09-10T00:00:00Z") },
      { toStatus: "COMMUNICATING", at: d("2026-09-20T00:00:00Z") },
      { toStatus: "VIEWING_SCHEDULED", at: d("2026-10-10T00:00:00Z") },
    ],
  })], SEASON);
  assert.deepEqual(ev, []);
});

test("pointEventsFor: active-claim gate (nothing before activeSince)", () => {
  const ev = pointEventsFor([fact({
    activeSince: d("2026-10-15T00:00:00Z"), acceptedAt: d("2026-10-15T00:00:00Z"),
    statusChanges: [
      { toStatus: "VIEWING_SCHEDULED", at: d("2026-10-10T00:00:00Z") }, // before the claim was active
      { toStatus: "RESERVED", at: d("2026-10-16T00:00:00Z") },
    ],
  })], SEASON);
  assert.deepEqual(ev.map((e) => [e.kind, e.at.toISOString()]), [
    ["claim_accepted", "2026-10-15T00:00:00.000Z"],
    ["viewing", "2026-10-16T00:00:00.000Z"],
    ["reserved", "2026-10-16T00:00:00.000Z"],
  ]);
  assert.deepEqual(pointEventsFor([fact({ acceptedAt: null })], SEASON), [], "not accepted: no claim_accepted event");
  const early = pointEventsFor([fact({ acceptedAt: d("2026-10-04T00:00:00Z") })], SEASON);
  assert.deepEqual(early, [], "acceptedAt before activeSince is gated");
});

test("pointEventsFor: KEEP_CONTACT and LOST earn nothing; zero-point rules emit no events", () => {
  const ev = pointEventsFor([fact({ statusChanges: [{ toStatus: "KEEP_CONTACT", at: d("2026-10-07T00:00:00Z") }, { toStatus: "LOST", at: d("2026-10-08T00:00:00Z") }] })], SEASON);
  assert.deepEqual(ev.map((e) => e.kind), ["claim_accepted"]);
  const zero = pointEventsFor([fact()], { ...SEASON, pointRules: { ...DEFAULT_POINT_RULES, claim_accepted: 0 } });
  assert.deepEqual(zero, []);
});

test("rankPartners: points desc, ties by earliest lastAt then partnerId", () => {
  const rows = rankPartners([
    { partnerId: "b", points: 50, lastAt: d("2026-10-10T00:00:00Z") },
    { partnerId: "a", points: 50, lastAt: d("2026-10-10T00:00:00Z") },
    { partnerId: "c", points: 50, lastAt: d("2026-10-05T00:00:00Z") },
    { partnerId: "d", points: 120, lastAt: d("2026-10-30T00:00:00Z") },
    { partnerId: "e", points: 10, lastAt: null },
    { partnerId: "f", points: 10, lastAt: d("2026-11-01T00:00:00Z") },
  ]);
  assert.deepEqual(rows.map((r) => [r.rank, r.partnerId]), [[1, "d"], [2, "c"], [3, "a"], [4, "b"], [5, "f"], [6, "e"]]);
  assert.deepEqual(rankPartners([]), []);
});

test("pseudonym: stable 3-digit number per season, differs across seasons", () => {
  const a = pseudonym("partner-1", "s1");
  assert.equal(a, pseudonym("partner-1", "s1"));
  assert.ok(a >= 100 && a <= 999 && Number.isInteger(a));
  const seasons = ["s1", "s2", "s3", "s4", "s5", "s6"].map((s) => pseudonym("partner-1", s));
  assert.ok(new Set(seasons).size > 1, "a new season reshuffles the numbers");
});

test("pseudonym: collisions resolve via the taken set", () => {
  const n = pseudonym("partner-1", "s1");
  const taken = new Set<number>([n]);
  const m = pseudonym("partner-1", "s1", taken);
  assert.notEqual(m, n);
  assert.equal(m, n === 999 ? 100 : n + 1);
  assert.ok(taken.has(m), "the assigned number is reserved");
  // All 900 three-digit numbers taken: continue with 4 digits instead of throwing
  const full = new Set<number>(Array.from({ length: 900 }, (_, i) => i + 100));
  const four = pseudonym("x", "s1", full);
  assert.ok(four >= 1000 && four <= 9999, String(four));
  assert.ok(full.has(four));
  const all = new Set<number>([...Array.from({ length: 900 }, (_, i) => i + 100), ...Array.from({ length: 9000 }, (_, i) => i + 1000)]);
  assert.throws(() => pseudonym("x", "s1", all));
});

const P = (partnerId: string, firstAt: Date | null = null) => ({ partnerId, firstAt });

test("pseudonyms: no collisions within a season and independent of input order", () => {
  const ids = Array.from({ length: 300 }, (_, i) => P(`partner-${i}`, new Date(NOW.getTime() + i * 1000)));
  const map = pseudonyms(ids, "s1");
  assert.equal(new Set(map.values()).size, 300);
  const reversed = pseudonyms([...ids].reverse(), "s1");
  for (const { partnerId } of ids) assert.equal(map.get(partnerId), reversed.get(partnerId));
});

test("pseudonyms: collisions resolve in order of the first point event (a newcomer never takes a shown number)", () => {
  // Find two ids that hash to the same 3-digit number in season s1
  const seen = new Map<number, string>();
  let pair: [string, string] | null = null;
  for (let i = 0; !pair; i++) {
    const id = `p-${i}`;
    const n = pseudonym(id, "s1");
    if (seen.has(n)) pair = [seen.get(n)!, id];
    else seen.set(n, id);
  }
  const [x, y] = pair;
  const n = pseudonym(x, "s1");
  // y earned points first: y keeps the hashed number even though x sorts first by id
  const yFirst = pseudonyms([P(x, ago(1)), P(y, ago(5))], "s1");
  assert.equal(yFirst.get(y), n);
  assert.notEqual(yFirst.get(x), n);
  const xFirst = pseudonyms([P(y, ago(1)), P(x, ago(5))], "s1");
  assert.equal(xFirst.get(x), n);
  // A partner who joins later never renumbers the earlier ones
  const before = pseudonyms([P(y, ago(5))], "s1");
  const after = pseudonyms([P(y, ago(5)), P(x, ago(1))], "s1");
  assert.equal(after.get(y), before.get(y));
  // Duplicates keep the earliest first event; unknown dates go last
  const dup = pseudonyms([P(x, ago(1)), P(y, null), P(x, ago(9))], "s1");
  assert.equal(dup.get(x), n);
});

test("pseudonyms: more than 900 partners get 4-digit numbers instead of throwing, earlier ones keep theirs", () => {
  const ids = Array.from({ length: 950 }, (_, i) => P(`partner-${i}`, new Date(NOW.getTime() + i * 1000)));
  const map = pseudonyms(ids, "s1");
  assert.equal(new Set(map.values()).size, 950);
  const values = Array.from(map.values());
  assert.equal(values.filter((v) => v >= 100 && v <= 999).length, 900);
  assert.equal(values.filter((v) => v >= 1000 && v <= 9999).length, 50);
  const first900 = pseudonyms(ids.slice(0, 900), "s1");
  for (const { partnerId } of ids.slice(0, 900)) assert.equal(map.get(partnerId), first900.get(partnerId));
});

test("countdown: days and hours, ended at or after the end", () => {
  assert.deepEqual(countdown(new Date(NOW.getTime() + 3 * DAY + 5 * 3_600_000 + 59 * 60_000), NOW), { days: 3, hours: 5, ended: false });
  assert.deepEqual(countdown(new Date(NOW.getTime() + 30 * 60_000), NOW), { days: 0, hours: 0, ended: false });
  assert.deepEqual(countdown(NOW, NOW), { days: 0, hours: 0, ended: true });
  assert.deepEqual(countdown(ago(1), NOW), { days: 0, hours: 0, ended: true });
});

// ── News ────────────────────────────────────────────────────────────────────

const ref = (id: string, name = `Project ${id}`) => ({
  developmentId: id,
  name,
  developer: "ACME Developer",
  location: { area: null, district: "Paphos", town: "Paphos" },
  publicUrl: { en: `/projects/${id}`, de: `/de/projects/${id}`, pl: `/pl/projects/${id}`, ru: `/ru/projects/${id}`, he: `/he/projects/${id}` },
});
const ev = (id: string, o: Record<string, unknown>): ChangeEvent => ({ ...ref(id), at: null, since: null, ...o }) as ChangeEvent;
const empty = new Map<string, NewsAvailability>();

test("newsItems: kinds, price drop decrease-only, rate and localized url", () => {
  const items = newsItems({
    changes: [
      ev("a", { type: "published", at: ago(2) }),
      ev("b", { type: "price_from_changed", since: ago(5), from: 300000, to: 280000 }),
      ev("c", { type: "price_from_changed", since: ago(5), from: 280000, to: 300000 }),
      ev("d", { type: "back_on_market", at: ago(1) }),
      ev("e", { type: "sold_out", at: ago(1) }),
      ev("f", { type: "unit_price_changed", since: ago(1) }),
    ],
    availability: empty,
    rates: new Map([["a", 1.5], ["b", null]]),
    now: NOW,
    locale: "de",
  });
  assert.deepEqual(items.map((i) => [i.kind, i.developmentId]), [["back_on_market", "d"], ["new_project", "a"], ["price_drop", "b"]]);
  const drop = items.find((i) => i.kind === "price_drop")!;
  assert.equal(drop.priceFrom, 280000);
  assert.equal(drop.priceBefore, 300000);
  assert.equal(drop.rate, null);
  assert.equal(items.find((i) => i.kind === "new_project")!.rate, 1.5);
  assert.equal(items.find((i) => i.kind === "back_on_market")!.rate, null, "no rate row = on request");
  assert.ok(drop.url.endsWith("/de/projects/b") && drop.url.startsWith("https://"));
  assert.equal(drop.town, "Paphos");
  assert.equal(drop.name, "Project b");
  for (const i of items) assert.ok(!("developer" in i), "no developer name in news");
});

test("newsItems: price drop equal or without numbers is ignored; dated events use at, snapshot ones since", () => {
  const items = newsItems({
    changes: [
      ev("a", { type: "price_from_changed", since: ago(3), from: 300000, to: 300000 }),
      ev("b", { type: "price_from_changed", since: ago(3), from: null, to: 1 }),
      ev("c", { type: "price_from_changed", since: ago(3), from: 2, to: 1 }),
    ],
    availability: empty, rates: new Map(), now: NOW,
  });
  assert.deepEqual(items.map((i) => i.developmentId), ["c"]);
  assert.equal(items[0].at.getTime(), ago(3).getTime());
  assert.ok(items[0].url.endsWith("/projects/c") && !items[0].url.includes("/en/"), "English has no prefix");
});

test("newsItems: nearly sold out at <= 10 % with at least one unit, dated now, once per development", () => {
  const availability = new Map<string, NewsAvailability>([
    ["a", { available: 1, total: 10 }], // 10 %: yes (name from a change event)
    ["b", { available: 2, total: 19, name: "Bee", town: "Limassol", publicUrl: ref("b").publicUrl }], // 10.5 %: no
    ["c", { available: 0, total: 10, name: "Cee", town: null, publicUrl: ref("c").publicUrl }], // sold out: no
    ["d", { available: 1, total: 0, name: "Dee", town: null, publicUrl: ref("d").publicUrl }], // no total: no
    ["e", { available: 3, total: 40, name: "Eee", town: "Larnaca", publicUrl: ref("e").publicUrl }], // 7.5 %: yes
    ["f", { available: 1, total: 20 }], // no name and no change event: skipped
    ["g", { available: 1, total: 20, name: "Gee", town: null, publicUrl: null }], // not public: skipped
  ]);
  const items = newsItems({
    changes: [ev("a", { type: "published", at: ago(2) }), ev("a", { type: "back_on_market", at: ago(1) })],
    availability, rates: new Map(), now: NOW,
  });
  const sold = items.filter((i) => i.kind === "nearly_sold_out");
  assert.deepEqual(sold.map((i) => i.developmentId).sort(), ["a", "e"]);
  for (const s of sold) assert.equal(s.at.getTime(), NOW.getTime());
  assert.equal(sold.find((i) => i.developmentId === "a")!.name, "Project a");
  assert.equal(sold.find((i) => i.developmentId === "e")!.town, "Larnaca");
});

test("newsItems: one item per development+kind (newest), newest first, max 50", () => {
  const dup = newsItems({
    changes: [ev("a", { type: "back_on_market", at: ago(9) }), ev("a", { type: "back_on_market", at: ago(2) })],
    availability: empty, rates: new Map(), now: NOW,
  });
  assert.equal(dup.length, 1);
  assert.equal(dup[0].at.getTime(), ago(2).getTime());
  const many = newsItems({
    changes: Array.from({ length: 70 }, (_, i) => ev(`p${i}`, { type: "published", at: new Date(ago(30).getTime() + i * 3_600_000) })),
    availability: empty, rates: new Map(), now: NOW,
  });
  assert.equal(NEWS_MAX_ITEMS, 50);
  assert.equal(many.length, 50);
  assert.equal(many[0].developmentId, "p69");
  for (let i = 1; i < many.length; i++) assert.ok(many[i - 1].at.getTime() >= many[i].at.getTime());
  assert.equal(new Set(many.map((i) => i.id)).size, many.length);
});

test("newsItems: unpublished projects (no public url) are skipped", () => {
  const items = newsItems({ changes: [{ ...ev("a", { type: "published", at: ago(1) }), publicUrl: null } as ChangeEvent], availability: empty, rates: new Map(), now: NOW });
  assert.deepEqual(items, []);
});

test("unreadCount: strictly newer than seenAt; everything when never seen", () => {
  const items = [{ at: ago(1) }, { at: ago(3) }, { at: ago(5) }];
  assert.equal(unreadCount(items, null), 3);
  assert.equal(unreadCount(items, ago(3)), 1);
  assert.equal(unreadCount(items, ago(0)), 0);
  assert.equal(unreadCount([], null), 0);
});

// ── Builders + dictionary ───────────────────────────────────────────────────

test("buildTierUpEmail: 4 locales, tier and shares, portal link, escaped", () => {
  for (const l of PARTNER_LOCALES) {
    const t = dict(l).mail.tierUp;
    const m = buildTierUpEmail(l, { partnerFirstName: "Eva", tierName: "Gold <b>", handoverShare: 35, fixShare: 55.5, portalUrl: "https://partner.example/commissions" });
    assert.equal(m.subject, fmt(t.subject, { tier: "Gold <b>" }), l);
    assert.ok(m.text.includes("35") && m.text.includes(l === "en" ? "55.5" : "55,5"), `${l} shares`);
    assert.ok(m.text.includes(`${t.button}: https://partner.example/commissions`), l);
    assert.ok(m.text.includes(t.note), `${l} existing deals unchanged`);
    assert.ok(m.html.includes("Gold &lt;b&gt;") && !m.html.includes("Gold <b>"), l);
  }
});

test("Telegram TIER_UP: tier and shares, escaped, linked, 4 locales", () => {
  for (const l of PARTNER_LOCALES) {
    const tg = buildTelegramNotification(l, { kind: "TIER_UP", tierName: "Gold & <i>", handoverShare: 35, fixShare: 55, url: "https://partner.example/commissions", portalUrl: "https://partner.example" });
    assert.ok(tg.includes("Gold &amp; &lt;i&gt;"), l);
    assert.ok(tg.includes("35") && tg.includes("55"), l);
    assert.ok(tg.includes('href="https://partner.example/commissions"'), l);
    assert.ok(!tg.includes("{"), `${l} no unreplaced placeholder`);
  }
});

test("dictionary: tiers, rating, news and mail.tierUp sections in every locale", () => {
  for (const l of PARTNER_LOCALES) {
    const t = dict(l);
    for (const f of ["one", "few", "many", "other"] as const) assert.ok(t.tiers.progress[f].includes("{tier}"), `${l} ${f}`);
    assert.ok(t.tiers.progress.other.includes("{n}") && t.tiers.reviewing.includes("{tier}"), l);
    assert.ok(t.rating.pseudonym.includes("{n}"), l);
    for (const k of ["new_project", "price_drop", "back_on_market", "nearly_sold_out"] as const) assert.ok(t.news.kinds[k].trim(), `${l} ${k}`);
    for (const k of ["claim_accepted", "viewing", "reserved", "closed"] as const) assert.ok(t.rating.kinds[k].trim(), `${l} ${k}`);
    assert.ok(t.mail.tierUp.subject.includes("{tier}"), l);
  }
  assert.ok(dict("de").mail.tierUp.intro.includes("Sie") || dict("de").mail.tierUp.intro.includes("Ihr"));
  assert.ok(/Państw/.test(dict("pl").mail.tierUp.intro));
  assert.ok(/(Вы|Ваш)/.test(dict("ru").mail.tierUp.intro));
});
