import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dict, PARTNER_LOCALES } from "@/lib/partner/i18n";
import { DEFAULT_POINT_RULES, pointEventsFor, pseudonyms } from "@/lib/partner/rating";
import {
  OUTBOUND_CONTACT_TYPES, claimIdFromRefKey, claimPointFacts, contactsByLead, firstContactSince, isRevokedClaim, pointsCandidateQuery,
  refKeysToRevoke, seasonLockError, seasonOpenForRevocation,
  crmRanking, currentSeason, cyprusDayEnd, cyprusDayStart, overlappingSeasons, parseSeasonForm, pastSeasons, pointRulesFromJson,
  pointsRunSeasonWhere, pointsStartFromEnv, portalRanking, prizesFromJson, ratingCsv, ratingCsvFilename, ratingCsvRows, seasonFormValues,
  seasonStatus, seasonTotals, seasonsForPointsRun, statusChangesByLead, toStatusOf, type PartnerSeasonTotal,
} from "@/lib/partner/ratingFlow";

const DAY = 86_400_000;
const NOW = new Date("2026-10-19T12:00:00Z");
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const form = (over: Record<string, unknown> = {}) => ({
  name: "Autumn 2026", startsOn: "2026-11-01", endsOn: "2026-12-31", points: {}, prizes: { en: "Trip to Cyprus" }, ...over,
});

// ── Season form (Cyprus days) ───────────────────────────────────────────────

test("cyprusDayStart / cyprusDayEnd: Cyprus midnight and 23:59:59, DST-aware", () => {
  // Summer (EEST, UTC+3)
  assert.equal(cyprusDayStart("2026-07-01")!.toISOString(), "2026-06-30T21:00:00.000Z");
  assert.equal(cyprusDayEnd("2026-07-01")!.toISOString(), "2026-07-01T20:59:59.000Z");
  // Winter (EET, UTC+2)
  assert.equal(cyprusDayStart("2026-12-01")!.toISOString(), "2026-11-30T22:00:00.000Z");
  assert.equal(cyprusDayEnd("2026-12-31")!.toISOString(), "2026-12-31T21:59:59.000Z");
  // DST change day (25 Oct 2026: 04:00 → 03:00): the day ends at winter time
  assert.equal(cyprusDayEnd("2026-10-25")!.toISOString(), "2026-10-25T21:59:59.000Z");
  for (const bad of ["2026-02-30", "2026-13-01", "26-01-01", "", null, 20261101, "2026-11-01T00:00"]) {
    assert.equal(cyprusDayStart(bad), null, String(bad));
    assert.equal(cyprusDayEnd(bad), null, String(bad));
  }
});

test("parseSeasonForm: valid form → Cyprus window, default points for blanks, prizes trimmed", () => {
  const v = parseSeasonForm(form({ points: { viewing: "25", closed: "" }, prizes: { en: "  Trip  ", de: "Reise", pl: "", ru: " " } }));
  assert.ok(v.ok);
  if (!v.ok) return;
  assert.equal(v.value.name, "Autumn 2026");
  assert.equal(v.value.startsAt.toISOString(), "2026-10-31T22:00:00.000Z");
  assert.equal(v.value.endsAt.toISOString(), "2026-12-31T21:59:59.000Z");
  assert.deepEqual(v.value.pointRules, { ...DEFAULT_POINT_RULES, viewing: 25 });
  assert.deepEqual(v.value.prizes, { en: "Trip", de: "Reise" });
});

test("parseSeasonForm: one-day season is valid (end inclusive); errors are reported per field", () => {
  assert.ok(parseSeasonForm(form({ startsOn: "2026-11-01", endsOn: "2026-11-01" })).ok);
  const bad = parseSeasonForm(form({ name: " ", startsOn: "2026-11-31", endsOn: "x", points: { reserved: "1.5", closed: "-3", viewing: "abc" }, prizes: { en: "" } }));
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  const text = bad.errors.join(" | ");
  assert.match(text, /name/);
  assert.match(text, /start date is invalid/);
  assert.match(text, /end date is invalid/);
  assert.match(text, /"reserved"/);
  assert.match(text, /"closed"/);
  assert.match(text, /"viewing"/);
  assert.match(text, /English prize text is required/);
  const reversed = parseSeasonForm(form({ startsOn: "2026-12-31", endsOn: "2026-11-01" }));
  assert.ok(!reversed.ok && reversed.errors.some((e) => /start before it ends/.test(e)));
  assert.equal(parseSeasonForm(null).ok, false);
  // Hebrew is never stored
  const he = parseSeasonForm(form({ prizes: { en: "Trip", he: "x" } }));
  assert.ok(he.ok && !("he" in he.value.prizes));
});

test("seasonFormValues round-trips the stored season to the same Cyprus days", () => {
  const v = parseSeasonForm(form({ startsOn: "2026-03-29", endsOn: "2026-10-25" }));
  assert.ok(v.ok);
  if (!v.ok) return;
  const back = seasonFormValues({ ...v.value, pointRules: v.value.pointRules, prizes: v.value.prizes });
  assert.equal(back.startsOn, "2026-03-29");
  assert.equal(back.endsOn, "2026-10-25");
  assert.equal(back.points.closed, "100");
  assert.deepEqual(back.prizes, { en: "Trip to Cyprus", de: "", pl: "", ru: "" });
  assert.ok(parseSeasonForm(back).ok);
});

test("stored JSON parsing is defensive", () => {
  assert.deepEqual(pointRulesFromJson(null), DEFAULT_POINT_RULES);
  assert.deepEqual(pointRulesFromJson({ viewing: 5, closed: -1, reserved: "50", claim_accepted: 1.5 }), { ...DEFAULT_POINT_RULES, viewing: 5 });
  assert.deepEqual(prizesFromJson({ en: " A ", de: "", pl: 3, ru: "Б", he: "x" }), { en: "A", ru: "Б" });
  assert.deepEqual(prizesFromJson("x"), { en: "" });
});

// ── Windows ─────────────────────────────────────────────────────────────────

const S = (id: string, from: string, to: string) => ({ id, name: id, startsAt: new Date(from), endsAt: new Date(to) });

test("seasonStatus and overlap warning", () => {
  const a = S("a", "2026-10-01T00:00:00Z", "2026-10-31T00:00:00Z");
  assert.equal(seasonStatus(a, NOW), "active");
  assert.equal(seasonStatus(a, new Date("2026-09-30T23:59:59Z")), "upcoming");
  assert.equal(seasonStatus(a, new Date("2026-10-31T00:00:00Z")), "active");
  assert.equal(seasonStatus(a, new Date("2026-10-31T00:00:01Z")), "ended");
  const b = S("b", "2026-10-31T00:00:00Z", "2026-11-30T00:00:00Z");
  const c = S("c", "2026-11-01T00:00:00Z", "2026-11-30T00:00:00Z");
  assert.deepEqual(overlappingSeasons(a, [a, b, c], "a").map((s) => s.id), ["b"]);
  assert.deepEqual(overlappingSeasons(c, [a, b, c], "c").map((s) => s.id), ["b"]);
});

test("cron window: started and at most 3 days past the end; the Prisma filter has the same bounds", () => {
  const seasons = [
    S("running", "2026-10-01T00:00:00Z", "2026-12-31T00:00:00Z"),
    S("late", "2026-09-01T00:00:00Z", "2026-10-16T12:00:00Z"), // ended exactly 3 days ago
    S("old", "2026-09-01T00:00:00Z", "2026-10-16T11:59:59Z"), // 3 days + 1 s ago
    S("future", "2026-10-19T12:00:01Z", "2026-12-31T00:00:00Z"),
    S("startsNow", "2026-10-19T12:00:00Z", "2026-12-31T00:00:00Z"),
  ];
  assert.deepEqual(seasonsForPointsRun(seasons, NOW).map((s) => s.id), ["running", "late", "startsNow"]);
  const w = pointsRunSeasonWhere(NOW);
  assert.equal(w.startsAt.lte.getTime(), NOW.getTime());
  assert.equal(w.endsAt.gte.getTime(), NOW.getTime() - 3 * DAY);
  assert.equal(pointsStartFromEnv({}), null);
  assert.equal(pointsStartFromEnv({ PARTNER_POINTS_START: "soon" }), null);
  assert.equal(pointsStartFromEnv({ PARTNER_POINTS_START: " 2026-10-26T00:00:00Z " })!.toISOString(), "2026-10-26T00:00:00.000Z");
});

test("current season = active now, ending soonest; past = last 4 ended, latest first", () => {
  const seasons = [
    S("long", "2026-01-01T00:00:00Z", "2026-12-31T00:00:00Z"),
    S("short", "2026-10-01T00:00:00Z", "2026-10-31T00:00:00Z"),
    S("next", "2026-11-01T00:00:00Z", "2026-11-30T00:00:00Z"),
    ...[1, 2, 3, 4, 5].map((m) => S(`p${m}`, `2026-0${m}-01T00:00:00Z`, `2026-0${m}-20T00:00:00Z`)),
  ];
  assert.equal(currentSeason(seasons, NOW)?.id, "short");
  assert.equal(currentSeason([seasons[2]], NOW), null);
  assert.deepEqual(pastSeasons(seasons, NOW).map((s) => s.id), ["p5", "p4", "p3", "p2"]);
});

// ── Claim facts → events ────────────────────────────────────────────────────

test("STATUS_CHANGE history → facts; pointEventsFor honours activeSince and the season window", () => {
  assert.equal(toStatusOf({ toStatus: "OFFER" }), "OFFER");
  assert.equal(toStatusOf({ toStatus: 3 }), null);
  assert.equal(toStatusOf(null), null);
  const byLead = statusChangesByLead([
    { leadId: "L1", occurredAt: new Date("2026-09-20T00:00:00Z"), metadata: { toStatus: "VIEWING_SCHEDULED" } }, // before activeSince
    { leadId: "L1", occurredAt: new Date("2026-10-05T00:00:00Z"), metadata: { toStatus: "VIEWING_SCHEDULED" } },
    { leadId: "L1", occurredAt: new Date("2026-10-10T00:00:00Z"), metadata: { toStatus: "RESERVED" } },
    { leadId: "L1", occurredAt: new Date("2026-10-11T00:00:00Z"), metadata: { other: 1 } },
  ]);
  assert.equal(byLead.get("L1")!.length, 3);
  const since = new Date("2026-10-01T00:00:00Z");
  const season = { id: "s1", startsAt: new Date("2026-10-01T00:00:00Z"), endsAt: new Date("2026-10-31T00:00:00Z"), pointRules: DEFAULT_POINT_RULES };
  const events = pointEventsFor([{ claimId: "c1", partnerId: "p1", acceptedAt: since, activeSince: since, statusChanges: byLead.get("L1")! }], season);
  assert.deepEqual(events.map((e) => [e.kind, e.points, e.at.toISOString().slice(0, 10)]), [
    ["claim_accepted", 10, "2026-10-01"], ["viewing", 20, "2026-10-05"], ["reserved", 50, "2026-10-10"],
  ]);
});

// ── Rankings ────────────────────────────────────────────────────────────────

const T = (partnerId: string, points: number, lastIso: string, byKind?: Partial<PartnerSeasonTotal["byKind"]>): PartnerSeasonTotal => ({
  partnerId, points, lastAt: new Date(lastIso), byKind: { claim_accepted: 0, viewing: 0, reserved: 0, closed: 0, ...byKind },
});

test("seasonTotals folds the (partner, kind) aggregate", () => {
  const t = seasonTotals([
    { partnerId: "a", kind: "viewing", points: 40, lastAt: new Date("2026-10-02T00:00:00Z") },
    { partnerId: "a", kind: "closed", points: 100, lastAt: new Date("2026-10-05T00:00:00Z") },
    { partnerId: "a", kind: "legacy", points: 5, lastAt: null },
    { partnerId: "b", kind: "claim_accepted", points: 10, lastAt: null },
  ]);
  const a = t.find((x) => x.partnerId === "a")!;
  assert.equal(a.points, 145);
  assert.deepEqual(a.byKind, { claim_accepted: 0, viewing: 40, reserved: 0, closed: 100 });
  assert.equal(a.lastAt!.toISOString(), "2026-10-05T00:00:00.000Z");
  assert.equal(t.find((x) => x.partnerId === "b")!.lastAt, null);
});

test("crmRanking: names and companies, every status, tie by the earlier last point", () => {
  const rows = crmRanking(
    [T("a", 50, "2026-10-05T00:00:00Z"), T("b", 50, "2026-10-03T00:00:00Z"), T("c", 10, "2026-10-01T00:00:00Z")],
    [
      { id: "a", status: "ACTIVE", country: "DE", firstName: "Anna", lastName: "Alt", company: "Alt GmbH" },
      { id: "b", status: "SUSPENDED", country: "PL", firstName: "Bob", lastName: "Bauer", company: null },
    ],
  );
  assert.deepEqual(rows.map((r) => [r.rank, r.partnerId, r.name, r.status]), [
    [1, "b", "Bob Bauer", "SUSPENDED"], [2, "a", "Anna Alt", "ACTIVE"], [3, "c", "(deleted partner)", ""],
  ]);
});

const PARTNERS = [
  { id: "self-id", status: "ACTIVE", country: "DE", firstName: "Me", lastName: "Self", company: "Mine Ltd" },
  ...Array.from({ length: 30 }, (_, i) => ({ id: `p${String(i).padStart(2, "0")}`, status: i === 0 ? "SUSPENDED" : "ACTIVE", country: "GB", firstName: `Secret${i}`, lastName: "Name", company: `Company${i}` })),
];

test("portalRanking: anonymised (no ids, names or companies), only ACTIVE ranked, own row always", () => {
  const totals = PARTNERS.filter((p) => p.id !== "self-id").map((p, i) => T(p.id, 1000 - i * 10, "2026-10-05T00:00:00Z"));
  totals.push(T("self-id", 5, "2026-10-06T00:00:00Z", { claim_accepted: 5 }));
  const r = portalRanking({ seasonId: "s1", meId: "self-id", totals, partners: PARTNERS });
  // p00 (SUSPENDED, the leader) is left out; ranks are among ACTIVE partners only
  assert.equal(r.total, 30);
  assert.equal(r.rows.length, 21);
  assert.equal(r.rows[0].rank, 1);
  assert.equal(r.rows[0].points, 990);
  assert.equal(r.myRank, 30);
  assert.equal(r.myPoints, 5);
  assert.equal(r.myByKind.claim_accepted, 5);
  assert.ok(r.meOutsideTop);
  const own = r.rows[20];
  assert.deepEqual(own, { rank: 30, me: true, pseudonym: null, flag: "🇩🇪", points: 5 });
  const names = pseudonyms(totals.map((t) => ({ partnerId: t.partnerId, firstAt: t.firstAt ?? null })), "s1");
  assert.equal(r.rows[0].pseudonym, names.get("p01"));
  assert.equal(r.rows[0].flag, "🇬🇧");
  // The DTO never carries another partner's identity
  const json = JSON.stringify(r);
  for (const p of PARTNERS) {
    assert.ok(!json.includes(`"${p.id}"`), `id ${p.id} leaked`);
    assert.ok(!json.includes(p.firstName), `name ${p.firstName} leaked`);
    if (p.company) assert.ok(!json.includes(p.company), `company ${p.company} leaked`);
  }
  for (const row of r.rows) assert.deepEqual(Object.keys(row).sort(), ["flag", "me", "points", "pseudonym", "rank"]);
});

test("portalRanking: viewer in the top 20 is not duplicated; viewer without points gets an unranked own row", () => {
  const totals = [T("self-id", 300, "2026-10-01T00:00:00Z"), T("p01", 200, "2026-10-01T00:00:00Z")];
  const r = portalRanking({ seasonId: "s1", meId: "self-id", totals, partners: PARTNERS });
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows.map((x) => [x.rank, x.me]), [[1, true], [2, false]]);
  assert.equal(r.meOutsideTop, false);
  const none = portalRanking({ seasonId: "s1", meId: "self-id", meCountry: "AT", totals: [T("p01", 200, "2026-10-01T00:00:00Z")], partners: PARTNERS });
  assert.equal(none.myRank, null);
  assert.equal(none.myPoints, 0);
  assert.deepEqual(none.rows.at(-1), { rank: null, me: true, pseudonym: null, flag: "🇦🇹", points: 0 });
  // Pseudonyms do not depend on who is ACTIVE (a suspension never renumbers the others)
  const withSusp = portalRanking({ seasonId: "s1", meId: "self-id", totals: [T("p00", 9, "2026-10-01T00:00:00Z"), T("p01", 200, "2026-10-01T00:00:00Z")], partners: PARTNERS });
  assert.equal(withSusp.rows[0].pseudonym, pseudonyms([{ partnerId: "p00", firstAt: null }, { partnerId: "p01", firstAt: null }], "s1").get("p01"));
});

// ── CSV ─────────────────────────────────────────────────────────────────────

test("ratingCsv: BOM, semicolons, formula guard, points by kind", () => {
  const rows = crmRanking(
    [T("a", 130, "2026-10-05T08:30:00Z", { claim_accepted: 10, viewing: 20, closed: 100 })],
    [{ id: "a", status: "ACTIVE", country: "DE", firstName: "=HYPERLINK(\"x\")", lastName: "", company: "Semi;colon" }],
  );
  assert.deepEqual(ratingCsvRows(rows)[0], [1, 1, "=HYPERLINK(\"x\")", "Semi;colon", "DE", "ACTIVE", 10, 20, 0, 100, 130, "2026-10-05 08:30 UTC"]);
  const csv = ratingCsv(rows);
  assert.ok(csv.startsWith("﻿Rank;Portal rank;Partner;Company;"));
  const line = csv.split("\r\n")[1];
  assert.equal(line, `1;1;"'=HYPERLINK(""x"")";"Semi;colon";DE;ACTIVE;10;20;0;100;130;2026-10-05 08:30 UTC`);
  assert.ok(csv.endsWith("\r\n"));
  assert.equal(ratingCsvFilename("Autumn 2026 / Ü", new Date("2026-10-31T22:00:00Z")), "rating-autumn-2026-2026-11-01.csv");
  assert.equal(ratingCsvFilename("!!!", new Date("2026-10-31T22:00:00Z")), "rating-season-2026-11-01.csv");
});

// ── Wiring (source checks) ──────────────────────────────────────────────────

test("wiring: cron route, CRM guard + audit, CSV route guard, portal isolation and nav", () => {
  const cron = src("src/app/api/cron/partner-points/route.ts");
  assert.match(cron, /30 3 \* \* \* curl/);
  assert.match(cron, /CRON_SECRET/);
  assert.match(cron, /PARTNER_POINTS_START/);
  assert.match(cron, /withPointsLock/);
  assert.match(cron, /withCronLog\("partner-points"/);

  const store = src("src/lib/partner/ratingStore.ts");
  assert.match(store, /skipDuplicates: true/);
  assert.match(store, /POINTS_CLAIM_CAP = 5000/);
  assert.match(store, /pointsCandidateQuery\(season\)/);
  assert.match(store, /type: "STATUS_CHANGE"/);
  assert.match(store, /OUTBOUND_CONTACT_TYPES/);
  assert.match(store, /revokePoints\(season, now\)/);
  // The portal path reads only status + country of other partners
  const portalFn = store.slice(store.indexOf("async function portalSeasonRanking"), store.indexOf("export type MyRatingView"));
  assert.match(portalFn, /select: \{ id: true, status: true, country: true \}/);
  assert.doesNotMatch(portalFn, /firstName|lastName|company|email/);

  const actions = src("src/app/crm/partners/ratingActions.ts");
  assert.match(actions, /canAssignLeads\(actor\)/);
  assert.match(actions, /rating_season_create/);
  assert.match(actions, /rating_season_update/);
  const csvRoute = src("src/app/crm/partners/rating/export.csv/route.ts");
  assert.match(csvRoute, /canAssignLeads\(user\)/);
  assert.match(csvRoute, /no-store/);
  const crmPage = src("src/app/crm/partners/rating/page.tsx");
  assert.match(crmPage, /canAssignLeads\(user\)/);
  assert.match(src("src/app/crm/partners/page.tsx"), /href="\/crm\/partners\/rating"/);

  const portal = src("src/app/partner-portal/rating/page.tsx");
  assert.match(portal, /requirePartner\(\{ active: true \}\)/);
  assert.match(portal, /myRatingView\(me\.partner\.id/);
  assert.match(src("src/app/partner-portal/components/PortalShell.tsx"), /href="\/rating">\{t\.nav\.rating\}/);
});

test("dictionary: nav.rating and pastNoPoints in every partner locale, no Hebrew", () => {
  assert.ok(!(PARTNER_LOCALES as readonly string[]).includes("he"));
  for (const l of PARTNER_LOCALES) {
    assert.ok(dict(l).nav.rating.length > 0, l);
    assert.ok(dict(l).rating.pastNoPoints.length > 0, l);
  }
});

// ── Final fix wave ──────────────────────────────────────────────────────────

const D = (iso: string) => new Date(iso);
const SEASON_W = { id: "s1", startsAt: D("2026-10-01T00:00:00Z"), endsAt: D("2026-12-31T21:59:59Z"), pointRules: DEFAULT_POINT_RULES };

test("claim_accepted anti-farming: awarded only at the first outbound contact at/after activeSince, dated by it", () => {
  assert.deepEqual([...OUTBOUND_CONTACT_TYPES], ["CALL", "EMAIL_OUT", "WHATSAPP_OUT"]);
  const claim = { id: "c1", partnerId: "p1", leadId: "L1", createdAt: D("2026-10-05T00:00:00Z"), reviewedAt: null };
  // No outbound contact yet: no claim_accepted event (a farmed, never-contacted claim earns nothing)
  const none = claimPointFacts([claim], new Map(), new Map());
  assert.equal(none[0].acceptedAt, null);
  assert.deepEqual(pointEventsFor(none, SEASON_W), []);
  // A contact before activeSince does not count; the first one after it dates the event
  const contacts = contactsByLead([
    { leadId: "L1", occurredAt: D("2026-10-04T00:00:00Z") },
    { leadId: "L1", occurredAt: D("2026-10-09T00:00:00Z") },
    { leadId: "L1", occurredAt: D("2026-10-07T00:00:00Z") },
    { leadId: "L2", occurredAt: D("2026-10-06T00:00:00Z") },
  ]);
  const facts = claimPointFacts([claim], new Map(), contacts);
  assert.equal(facts[0].acceptedAt!.toISOString(), "2026-10-07T00:00:00.000Z");
  const ev = pointEventsFor(facts, SEASON_W);
  assert.deepEqual(ev.map((e) => [e.kind, e.at.toISOString()]), [["claim_accepted", "2026-10-07T00:00:00.000Z"]]);
  // A reviewed claim gates on reviewedAt
  const reviewed = claimPointFacts([{ ...claim, reviewedAt: D("2026-10-08T00:00:00Z") }], new Map(), contacts);
  assert.equal(reviewed[0].acceptedAt!.toISOString(), "2026-10-09T00:00:00.000Z");
  assert.equal(firstContactSince([], D("2026-10-01T00:00:00Z")), null);
  assert.equal(firstContactSince([D("2026-10-01T00:00:00Z")], D("2026-10-01T00:00:00Z"))!.toISOString(), "2026-10-01T00:00:00.000Z", "at activeSince counts");
  // The store reads only outbound types for it
  const store = src("src/lib/partner/ratingStore.ts");
  assert.match(store, /type: \{ in: \[\.\.\.OUTBOUND_CONTACT_TYPES\] \}/);
  assert.match(store, /claimPointFacts\(claims, statusChangesByLead\(history\), contactsByLead\(contacts\)\)/);
});

test("revocation: REJECTED claim, trashed/missing lead, LOST as INVALID/UNREACHABLE; only while the season can change", () => {
  const lead = (o: Partial<{ deletedAt: Date | null; status: string; lostReason: string | null }> = {}) => ({ deletedAt: null, status: "QUALIFIED", lostReason: null, ...o });
  assert.equal(isRevokedClaim({ state: "ACTIVE", lead: lead() }), false);
  assert.equal(isRevokedClaim({ state: "REJECTED", lead: lead() }), true);
  assert.equal(isRevokedClaim({ state: "ACTIVE", lead: lead({ deletedAt: D("2026-10-10T00:00:00Z") }) }), true);
  assert.equal(isRevokedClaim({ state: "ACTIVE", lead: lead({ status: "LOST", lostReason: "INVALID" }) }), true);
  assert.equal(isRevokedClaim({ state: "ACTIVE", lead: lead({ status: "LOST", lostReason: "UNREACHABLE" }) }), true);
  assert.equal(isRevokedClaim({ state: "ACTIVE", lead: lead({ status: "LOST", lostReason: "BUDGET" }) }), false, "a genuine lost client keeps the points");
  assert.equal(isRevokedClaim({ state: "ACTIVE", lead: lead({ status: "QUALIFIED", lostReason: "INVALID" }) }), false, "stale reason on a live lead");
  assert.equal(isRevokedClaim({ state: "ACTIVE", lead: null }), true);
  assert.equal(isRevokedClaim(null), true);

  assert.equal(claimIdFromRefKey("viewing:c1:s1"), "c1");
  assert.equal(claimIdFromRefKey("broken"), null);
  const events = [
    { refKey: "claim_accepted:c1:s1" }, { refKey: "viewing:c1:s1" }, { refKey: "claim_accepted:c2:s1" },
    { refKey: "claim_accepted:c3:s1" }, { refKey: "claim_accepted:gone:s1" }, { refKey: "odd" },
  ];
  const claims = new Map([
    ["c1", { state: "ACTIVE", lead: lead({ status: "LOST", lostReason: "INVALID" }) }],
    ["c2", { state: "ACTIVE", lead: lead() }],
    ["c3", { state: "REJECTED", lead: lead() }],
  ]);
  assert.deepEqual(refKeysToRevoke(events, claims), ["claim_accepted:c1:s1", "viewing:c1:s1", "claim_accepted:c3:s1", "claim_accepted:gone:s1"]);

  const s = { endsAt: D("2026-10-31T21:59:59Z") };
  assert.equal(seasonOpenForRevocation(s, D("2026-10-20T00:00:00Z")), true);
  assert.equal(seasonOpenForRevocation(s, new Date(s.endsAt.getTime() + 3 * DAY)), true, "end + 3 days still open");
  assert.equal(seasonOpenForRevocation(s, new Date(s.endsAt.getTime() + 3 * DAY + 1)), false, "final after that");

  const store = src("src/lib/partner/ratingStore.ts");
  const fn = store.slice(store.indexOf("async function revokePoints"), store.indexOf("async function pointsForSeason"));
  assert.match(fn, /seasonOpenForRevocation\(season, now\)/);
  assert.match(fn, /partnerPointEvent\.deleteMany\(\{ where: \{ seasonId: season\.id, refKey: \{ in: part \} \} \}\)/);
  // Revoked claims never earn new points either
  assert.match(store, /\.filter\(\(c\) => !isRevokedClaim\(c\)\)/);
  assert.match(store, /lostReason: true/);
});

test("seasonLockError: with point events, dates and point rules are frozen; name and prizes stay editable", () => {
  const before = { startsAt: SEASON_W.startsAt, endsAt: SEASON_W.endsAt, pointRules: { ...DEFAULT_POINT_RULES } };
  const same = { startsAt: new Date(SEASON_W.startsAt), endsAt: new Date(SEASON_W.endsAt), pointRules: { ...DEFAULT_POINT_RULES } };
  assert.equal(seasonLockError(before, same, true), null, "name / prize-only edit passes");
  assert.equal(seasonLockError(before, { ...same, endsAt: D("2027-01-31T21:59:59Z") }, false), null, "no events: anything goes");
  const end = seasonLockError(before, { ...same, endsAt: D("2027-01-31T21:59:59Z") }, true);
  assert.ok(end && end.includes("end date") && end.includes("Name and prizes"), String(end));
  assert.ok(seasonLockError(before, { ...same, startsAt: D("2026-10-02T00:00:00Z") }, true)?.includes("start date"));
  assert.ok(seasonLockError(before, { ...same, pointRules: { ...DEFAULT_POINT_RULES, viewing: 25 } }, true)?.includes("point values"));
  // Stored JSON with missing keys reads as the defaults (as the form shows them)
  assert.equal(seasonLockError({ ...before, pointRules: {} }, same, true), null);
  const actions = src("src/app/crm/partners/ratingActions.ts");
  assert.match(actions, /partnerPointEvent\.findFirst\(\{ where: \{ seasonId: id \}/);
  assert.match(actions, /seasonLockError\(before, s, hasEvents\)/);
  const page = src("src/app/crm/partners/rating/page.tsx");
  assert.match(page, /locked=\{ranking\.length > 0\}/);
  assert.match(src("src/app/crm/components/RatingSeasonForm.tsx"), /dates and point values are locked/);
});

test("crmRanking: portal rank among ACTIVE partners next to the overall rank; CRM page shows it", () => {
  const rows = crmRanking(
    [T("a", 90, "2026-10-05T00:00:00Z"), T("b", 80, "2026-10-03T00:00:00Z"), T("c", 70, "2026-10-01T00:00:00Z"), T("d", 60, "2026-10-01T00:00:00Z")],
    [
      { id: "a", status: "SUSPENDED", country: "DE", firstName: "A", lastName: "A" },
      { id: "b", status: "ACTIVE", country: "DE", firstName: "B", lastName: "B" },
      { id: "c", status: "PENDING", country: "DE", firstName: "C", lastName: "C" },
      { id: "d", status: "ACTIVE", country: "DE", firstName: "D", lastName: "D" },
    ],
  );
  assert.deepEqual(rows.map((r) => [r.partnerId, r.rank, r.portalRank]), [["a", 1, null], ["b", 2, 1], ["c", 3, null], ["d", 4, 2]]);
  assert.match(src("src/app/crm/partners/rating/page.tsx"), /Portal rank/);
});

test("seasonTotals keeps each partner's first point time; portal pseudonyms follow it", () => {
  const t = seasonTotals([
    { partnerId: "a", kind: "viewing", points: 20, lastAt: D("2026-10-09T00:00:00Z"), firstAt: D("2026-10-04T00:00:00Z") },
    { partnerId: "a", kind: "claim_accepted", points: 10, lastAt: D("2026-10-02T00:00:00Z"), firstAt: D("2026-10-02T00:00:00Z") },
  ]);
  assert.equal(t[0].firstAt!.toISOString(), "2026-10-02T00:00:00.000Z");
  assert.match(src("src/lib/partner/ratingStore.ts"), /_min: \{ createdAt: true \}/);
});

test("pointsCandidateQuery: lead activity since the season start, newest activity first, created by the end", () => {
  const q = pointsCandidateQuery(SEASON_W);
  const w = q.where as {
    state: string; createdAt: { lte: Date };
    lead: { deletedAt: null; OR: [{ updatedAt: { gte: Date } }, { interactions: { some: { type: { in: string[] }; occurredAt: { gte: Date } } } }] };
  };
  assert.equal(w.state, "ACTIVE");
  assert.equal(w.createdAt.lte, SEASON_W.endsAt);
  assert.equal(w.lead.deletedAt, null);
  assert.equal(w.lead.OR[0].updatedAt.gte, SEASON_W.startsAt);
  assert.deepEqual(w.lead.OR[1].interactions.some.type.in, ["STATUS_CHANGE", "CALL", "EMAIL_OUT", "WHATSAPP_OUT"]);
  assert.equal(w.lead.OR[1].interactions.some.occurredAt.gte, SEASON_W.startsAt);
  assert.deepEqual(q.orderBy, [{ lead: { updatedAt: "desc" } }, { createdAt: "desc" }, { id: "asc" }]);
  const store = src("src/lib/partner/ratingStore.ts");
  assert.match(store, /take: POINTS_CLAIM_CAP \+ 1/);
  assert.match(store, /orderBy: q\.orderBy/);
});
