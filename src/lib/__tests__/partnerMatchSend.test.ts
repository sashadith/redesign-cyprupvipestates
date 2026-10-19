import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChangeEvent } from "@/lib/crm/inventoryChanges";
import { PARTNER_LOCALES, dict, fmt } from "@/lib/partner/i18n";
import { planMatchAlerts, type PlannedMatchAlert } from "@/lib/partner/matchAlerts";
import {
  MATCH_EVENT_TYPES, OWNER_MARK_BODY, absoluteProjectUrl, buildOwnerMatchEmail, claimProjectIds, developmentIdFromMatchRefKey,
  dropRepeatedAlerts, eventToChanges, groupOwnerDigests, isOwnProjectUrl, localizedProjectUrl, matchRowPayload, matchStartFromEnv,
  ownerMarkedFor, priceFromIdsNeeded, submittedName, type OwnerLead,
} from "@/lib/partner/matchGlue";
import { buildMatchEmail, buildPresentationOpenedEmail, notificationGate, partnerStatusGate, presentationsLink } from "@/lib/partner/notify";
import { buildTelegramNotification, routeNotification } from "@/lib/partner/telegram";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const ref = {
  developmentId: "dev-1",
  name: "Sea View",
  developer: "ACME Developer",
  location: { area: null, district: "Paphos", town: "Paphos" },
  publicUrl: { en: "/projects/sea-view", de: "/de/projects/sea-view", pl: "/pl/projects/sea-view", ru: "/ru/projects/sea-view", he: "/he/projects/sea-view" },
};
const ev = (o: Record<string, unknown>): ChangeEvent => ({ ...ref, at: null, since: null, ...o }) as ChangeEvent;
const URL_EN = "https://cyprusvipestates.com/projects/sea-view";

// ── event → planner change ──────────────────────────────────────────────────

test("published / back_on_market use the development's priceFrom; none without a price", () => {
  const prices = new Map<string, number | null>([["dev-1", 250_000]]);
  for (const type of ["published", "back_on_market"] as const) {
    const [c, ...rest] = eventToChanges(ev({ type }), prices);
    assert.equal(rest.length, 0);
    assert.deepEqual(c, { developmentId: "dev-1", name: "Sea View", location: ref.location, url: URL_EN, type, price: 250_000 });
  }
  assert.deepEqual(eventToChanges(ev({ type: "published" }), new Map([["dev-1", null]])), []);
  assert.deepEqual(eventToChanges(ev({ type: "published" }), new Map()), []);
  assert.deepEqual(priceFromIdsNeeded([ev({ type: "published" }), ev({ type: "back_on_market" }), ev({ type: "new_units", developmentId: "dev-2" })]), ["dev-1"]);
});

test("new_units: the cheapest new unit's price", () => {
  const [c] = eventToChanges(ev({ type: "new_units", count: 3, priceRange: { min: 180_000, max: 420_000 } }), new Map());
  assert.equal(c.type, "new_units");
  assert.equal(c.price, 180_000);
  assert.deepEqual(eventToChanges(ev({ type: "new_units", count: 2, priceRange: null }), new Map()), []);
});

test("price changes: decreases only, previous price kept", () => {
  const [c] = eventToChanges(ev({ type: "price_from_changed", from: 300_000, to: 270_000 }), new Map());
  assert.deepEqual({ type: c.type, price: c.price, previousPrice: c.previousPrice }, { type: "price_from_changed", price: 270_000, previousPrice: 300_000 });
  assert.deepEqual(eventToChanges(ev({ type: "price_from_changed", from: 270_000, to: 300_000 }), new Map()), [], "increase dropped");
  assert.deepEqual(eventToChanges(ev({ type: "price_from_changed", from: 270_000, to: 270_000 }), new Map()), []);
  const units = eventToChanges(ev({
    type: "unit_price_changed",
    units: [{ key: "a", from: 200_000, to: 190_000 }, { key: "b", from: 150_000, to: 160_000 }, { key: "c", from: 400_000, to: 350_000 }],
  }), new Map());
  assert.deepEqual(units.map((u) => [u.price, u.previousPrice]), [[190_000, 200_000], [350_000, 400_000]]);
  assert.ok(units.every((u) => u.type === "unit_price_changed"));
});

test("events without a public URL or of other types yield nothing", () => {
  assert.deepEqual(eventToChanges(ev({ type: "new_units", publicUrl: null, priceRange: { min: 1, max: 2 } }), new Map()), []);
  assert.deepEqual(eventToChanges(ev({ type: "sold_out" }), new Map([["dev-1", 1]])), []);
  assert.deepEqual([...MATCH_EVENT_TYPES].sort(), ["back_on_market", "new_units", "price_from_changed", "published", "unit_price_changed"]);
});

test("mapped changes feed the planner (end to end, pure)", () => {
  const changes = [
    ...eventToChanges(ev({ type: "price_from_changed", from: 320_000, to: 290_000 }), new Map()),
    ...eventToChanges(ev({ type: "price_from_changed", developmentId: "dev-up", from: 200_000, to: 210_000 }), new Map()),
  ];
  const plan = planMatchAlerts({
    claims: [{ claimId: "c1", partnerId: "p1", leadId: "l1", budgetMin: 200_000, budgetMax: 300_000, projects: [{ developmentId: "dev-x", district: "Paphos", town: null, area: null }] }],
    changes,
    today: "2026-10-19",
  });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].refKey, "match:c1:dev-1:2026-10-19");
  assert.deepEqual(plan[0].payload, { projectName: "Sea View", changeType: "price_from_changed", priceFrom: 290_000, url: URL_EN });
});

// ── links, claims, payload ──────────────────────────────────────────────────

test("project links: absolute English, localized per partner, only our own site", () => {
  assert.equal(absoluteProjectUrl(ref.publicUrl), URL_EN);
  assert.equal(absoluteProjectUrl(null), null);
  assert.equal(absoluteProjectUrl({ en: "https://evil.example/x" }), null);
  assert.equal(localizedProjectUrl(URL_EN, "en"), URL_EN);
  assert.equal(localizedProjectUrl(URL_EN, "de"), "https://cyprusvipestates.com/de/projects/sea-view");
  assert.equal(localizedProjectUrl("https://other.example/projects/x", "de"), "https://other.example/projects/x");
  assert.equal(isOwnProjectUrl(URL_EN), true);
  assert.equal(isOwnProjectUrl("https://cyprusvipestates.com.evil.example/x"), false);
  assert.equal(isOwnProjectUrl("javascript:alert(1)"), false);
  assert.equal(isOwnProjectUrl(42), false);
});

test("claim projects and submitted name come from the submission JSON", () => {
  assert.deepEqual(claimProjectIds({ projects: [{ id: "a", name: "A" }, { id: "a", name: "A" }, { id: "b" }, { name: "no id" }], projectIds: ["z"] }), ["a", "b"]);
  assert.deepEqual(claimProjectIds({ projectIds: ["x", 3, ""] }), ["x"]);
  assert.deepEqual(claimProjectIds(null), []);
  assert.equal(submittedName({ firstName: " Anna ", lastName: "Meier" }), "Anna Meier");
  assert.equal(submittedName({ firstName: "Anna", lastName: null }), "Anna");
  const alert: PlannedMatchAlert = {
    claimId: "c1", partnerId: "p1", leadId: "l1", developmentId: "dev-1", refKey: "match:c1:dev-1:2026-10-19",
    payload: { projectName: "Sea View", changeType: "published", priceFrom: 250_000, url: URL_EN },
  };
  assert.deepEqual(matchRowPayload(alert, "Anna Meier"), { projectName: "Sea View", changeType: "published", priceFrom: 250_000, url: URL_EN, clientName: "Anna Meier" });
});

test("PARTNER_MATCH_START gate", () => {
  assert.equal(matchStartFromEnv({}), null);
  assert.equal(matchStartFromEnv({ PARTNER_MATCH_START: "soon" }), null);
  assert.equal(matchStartFromEnv({ PARTNER_MATCH_START: "2026-10-26T00:00:00Z" })?.toISOString(), "2026-10-26T00:00:00.000Z");
});

// ── cross-day dedupe ────────────────────────────────────────────────────────

test("dropRepeatedAlerts: same claim + development + change + price within the window is not repeated", () => {
  const a = (dev: string, changeType: "published" | "price_from_changed", priceFrom: number, claimId = "c1"): PlannedMatchAlert => ({
    claimId, partnerId: "p1", leadId: "l1", developmentId: dev, refKey: `match:${claimId}:${dev}:2026-10-20`,
    payload: { projectName: dev, changeType, priceFrom, url: URL_EN },
  });
  const recent = [
    { claimId: "c1", refKey: "match:c1:dev-1:2026-10-19", payload: { changeType: "price_from_changed", priceFrom: 290_000 } },
    { claimId: "c1", refKey: "match:c1:dev-2:2026-10-19", payload: { changeType: "published", priceFrom: 100_000 } },
    { claimId: null, refKey: "match:c9:dev-3:2026-10-19", payload: { changeType: "published", priceFrom: 1 } },
    { claimId: "c1", refKey: "stage:xyz", payload: {} },
  ];
  const planned = [
    a("dev-1", "price_from_changed", 290_000), // repeat → dropped
    a("dev-1", "price_from_changed", 280_000), // dropped further → new
    a("dev-2", "price_from_changed", 100_000), // other change type → new
    a("dev-1", "price_from_changed", 290_000, "c2"), // other claim → new
  ];
  const { keep, repeated } = dropRepeatedAlerts(planned, recent);
  assert.equal(repeated, 1);
  assert.deepEqual(keep.map((k) => `${k.claimId}:${k.developmentId}:${k.payload.priceFrom}`), ["c1:dev-1:280000", "c1:dev-2:100000", "c2:dev-1:290000"]);
  assert.equal(developmentIdFromMatchRefKey("match:c1:dev-1:2026-10-19"), "dev-1");
  assert.equal(developmentIdFromMatchRefKey("presopen:x"), null);
});

// ── owner digest ────────────────────────────────────────────────────────────

test("groupOwnerDigests: one digest per active owner with e-mail; marked / ownerless / inactive leads skipped once", () => {
  const owner = (id: string, o: Partial<NonNullable<OwnerLead["owner"]>> = {}) => ({ id, name: `Owner ${id}`, email: `${id}@cve.test`, isActive: true, ...o });
  const leads = new Map<string, OwnerLead>([
    ["l1", { id: "l1", name: "Zoe Client", owner: owner("u1"), markedToday: false }],
    ["l2", { id: "l2", name: "Adam Client", owner: owner("u1"), markedToday: false }],
    ["l3", { id: "l3", name: "Marked", owner: owner("u2"), markedToday: true }],
    ["l4", { id: "l4", name: "Nobody", owner: null, markedToday: false }],
    ["l5", { id: "l5", name: "Gone", owner: owner("u3", { isActive: false }), markedToday: false }],
    ["l6", { id: "l6", name: "Mailless", owner: owner("u4", { email: " " }), markedToday: false }],
  ]);
  const row = (leadId: string, developmentId: string, projectName = "P") => ({ leadId, partnerId: "p1", developmentId, payload: { projectName, changeType: "new_units", priceFrom: 200_000 } });
  const { digests, skipped } = groupOwnerDigests({
    rows: [row("l1", "d1", "Sea View"), row("l1", "d2", "Hill"), row("l2", "d1", "Sea View"), row("l3", "d1"), row("l3", "d2"), row("l4", "d1"), row("l5", "d1"), row("l6", "d1"), row("l9", "d1")],
    leads,
    partnerLabels: new Map([["p1", "Partner GmbH"]]),
  });
  assert.equal(digests.length, 1);
  const d = digests[0];
  assert.equal(d.email, "u1@cve.test");
  assert.deepEqual(d.leadIds.sort(), ["l1", "l2"]);
  assert.deepEqual(d.developmentIdsByLead, { l1: ["d1", "d2"], l2: ["d1"] });
  assert.deepEqual(d.items.map((i) => `${i.leadName}/${i.project}`), ["Adam Client/Sea View", "Zoe Client/Hill", "Zoe Client/Sea View"]);
  assert.equal(d.items[0].partner, "Partner GmbH");
  assert.deepEqual(skipped, { "already sent": 1, "no owner": 1, "owner inactive": 1, "owner without email": 1, "lead missing": 1 });
});

test("ownerMarkedFor: only today's mark counts", () => {
  assert.equal(ownerMarkedFor({ partnerMatch: "2026-10-19", developmentIds: ["d1"] }, "2026-10-19"), true);
  assert.equal(ownerMarkedFor({ partnerMatch: "2026-10-18" }, "2026-10-19"), false);
  assert.equal(ownerMarkedFor(null, "2026-10-19"), false);
  assert.equal(OWNER_MARK_BODY, "Partner match alert sent to owner");
});

test("owner e-mail: English, lead link to /crm/leads/<id>, values escaped", () => {
  const mail = buildOwnerMatchEmail(
    { ownerName: "Maria Example", items: [{ leadId: "l1", leadName: "<b>Bob</b>", partner: "P & Co", project: "Sea View", changeType: "price_from_changed", priceFrom: 290_000 }] },
    "https://cyprusvipestates.com/",
    "2026-10-19",
  );
  assert.ok(mail.subject.startsWith("Partner match alerts on your leads (1)"));
  assert.ok(mail.text.includes("Hi Maria,"));
  assert.ok(mail.text.includes("Match alerts queued for the partners of these clients today."));
  assert.ok(!/were told/.test(mail.text), "queued, not claimed as delivered");
  assert.ok(mail.text.includes("https://cyprusvipestates.com/crm/leads/l1"));
  assert.ok(mail.text.includes("price reduced, from €290,000"));
  assert.ok(mail.html.includes("&lt;b&gt;Bob&lt;/b&gt;") && !mail.html.includes("<b>Bob</b>"));
  assert.ok(mail.html.includes("P &amp; Co"));
  assert.ok(mail.html.includes('href="https://cyprusvipestates.com/crm/leads/l1"'));
});

// ── partner e-mail builders ─────────────────────────────────────────────────

const matchInput = {
  partnerFirstName: "Eva", clientName: "Anna <script>", projectName: "Sea & View", changeType: "price_from_changed",
  priceFrom: 290_000, url: "https://cyprusvipestates.com/de/projects/sea-view", portalUrl: "https://partner.example/clients/c1",
};

test("buildMatchEmail: 4 locales, project link as button, price and portal link, escaped, no internal fields", () => {
  for (const l of PARTNER_LOCALES) {
    const t = dict(l).mail.match;
    const m = buildMatchEmail(l, matchInput);
    assert.equal(m.subject, fmt(t.subject, { client: "Anna <script>" }), l);
    assert.ok(m.text.includes(`${t.button}: ${matchInput.url}`), l);
    assert.ok(m.text.includes(matchInput.portalUrl), l);
    assert.ok(m.text.includes(dict(l).telegram.changeTypes.price_from_changed), l);
    assert.ok(/290/.test(m.text), l);
    assert.ok(!m.html.includes("<script>") && m.html.includes("Anna &lt;script&gt;"), l);
    assert.ok(m.html.includes("Sea &amp; View"), l);
    assert.ok(m.html.includes(`href="${matchInput.url}"`), l);
    // Only what the builder was given: no commission figures, no developer, no staff/lead contact data.
    for (const leak of ["ourCommission", "ourRate", "ACME", "@"]) assert.ok(!m.text.includes(leak) && !m.html.replace(/<img[^>]*>/, "").includes(leak), `${l} ${leak}`);
  }
  const noPrice = buildMatchEmail("en", { ...matchInput, priceFrom: null });
  assert.ok(!noPrice.text.includes("Price from"));
});

test("buildPresentationOpenedEmail: 4 locales, presentations link, escaped", () => {
  const link = presentationsLink("https://partner.example");
  assert.equal(link, "https://partner.example/presentations");
  for (const l of PARTNER_LOCALES) {
    const t = dict(l).mail.presentationOpened;
    const m = buildPresentationOpenedEmail(l, { partnerFirstName: "Eva", clientName: "Bob & <i>", link });
    assert.equal(m.subject, fmt(t.subject, { client: "Bob & <i>" }), l);
    assert.ok(m.text.includes(`${t.button}: ${link}`), l);
    assert.ok(m.html.includes("Bob &amp; &lt;i&gt;") && !m.html.includes("<i>"), l);
  }
  assert.ok(buildPresentationOpenedEmail("en", { partnerFirstName: "", clientName: "", link }).text.includes("—"));
});

test("Telegram texts for MATCH and PRESENTATION_OPENED are escaped and linked", () => {
  const tg = buildTelegramNotification("de", {
    kind: "MATCH", clientName: "A<b>", projectName: "Sea & View", changeType: "unit_price_changed", priceFrom: "290.000 €",
    url: matchInput.url, portalUrl: matchInput.portalUrl,
  });
  assert.ok(tg.includes("A&lt;b&gt;") && tg.includes("Sea &amp; View"));
  assert.ok(tg.includes(`href="${matchInput.url}"`) && tg.includes(`href="${matchInput.portalUrl}"`));
  const po = buildTelegramNotification("en", { kind: "PRESENTATION_OPENED", clientName: "Bob", url: "https://partner.example/presentations", portalUrl: "https://partner.example" });
  assert.ok(po.includes("Bob") && po.includes('href="https://partner.example/presentations"'));
});

// ── sender gates ────────────────────────────────────────────────────────────

test("sender gates: partner must be ACTIVE for every kind", () => {
  assert.equal(partnerStatusGate("ACTIVE"), null);
  assert.equal(partnerStatusGate("SUSPENDED"), "suspended");
  assert.equal(partnerStatusGate("PENDING"), "pending");
  assert.equal(partnerStatusGate(null), "partner missing");
});

test("sender gates: MATCH needs the partner's own, effectively ACTIVE claim", () => {
  const g = (claim: Parameters<typeof notificationGate>[0]["claim"]) => notificationGate({ kind: "MATCH", accepted: false, claim });
  assert.equal(g({ ownedByPartner: true, effective: "ACTIVE" }), null);
  assert.equal(g({ ownedByPartner: true, effective: "EXPIRED" }), "protection ended");
  assert.equal(g({ ownedByPartner: true, effective: "NOT_PROCEEDING" }), "lead trashed");
  assert.equal(g({ ownedByPartner: true, effective: "REJECTED" }), "claim inactive");
  assert.equal(g({ ownedByPartner: false, effective: "ACTIVE" }), "claim inactive");
  assert.equal(g(null), "claim inactive");
});

test("sender gates: PRESENTATION_OPENED needs no claim; channels follow routeNotification", () => {
  for (const claim of [null, { ownedByPartner: false, effective: "EXPIRED" as const }, { ownedByPartner: true, effective: "ACTIVE" as const }]) {
    assert.equal(notificationGate({ kind: "PRESENTATION_OPENED", accepted: false, claim }), null);
  }
  // The e-mail switch (3d) concerns STAGE/MESSAGE only: match and presentation mails still go out.
  for (const kind of ["MATCH", "PRESENTATION_OPENED"] as const) {
    assert.deepEqual(routeNotification({ kind, notifyChannel: "EMAIL", chatLinked: false, emailNotifications: false }), { email: true, telegram: false });
    assert.deepEqual(routeNotification({ kind, notifyChannel: "TELEGRAM", chatLinked: true, emailNotifications: true }), { email: false, telegram: true });
    assert.deepEqual(routeNotification({ kind, notifyChannel: "BOTH", chatLinked: true, emailNotifications: true }), { email: true, telegram: true });
  }
});

test("sender wiring: MATCH validates its payload and links our own localized project page", () => {
  const s = src("src/lib/partner/notifySend.ts");
  assert.ok(s.includes('if (!projectName || !changeType || !isOwnProjectUrl(p.url)) return { skip: "invalid payload" };'));
  assert.ok(s.includes("const url = localizedProjectUrl(p.url, locale);"));
  assert.ok(s.includes('row.kind !== "PRESENTATION_OPENED" && row.kind !== "TIER_UP" && !(row.kind === "CLAIM_OUTCOME" && !accepted)'), "no lead lookups for presentation-opened rows");
  assert.ok(s.includes('if (!claim && row.kind !== "PRESENTATION_OPENED" && row.kind !== "TIER_UP") return { skip: "claim missing" };'));
});

test("cron route: same auth as partner-digest, START gate, lock, crontab line", () => {
  const r = src("src/app/api/cron/partner-match/route.ts");
  assert.ok(r.includes('if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET)'));
  assert.ok(r.includes('{ status: 401 }'));
  assert.ok(r.includes('return { skipped: "PARTNER_MATCH_START not set" }'));
  assert.ok(r.includes("withMatchLock(() => runMatchAlerts(now, start))"));
  assert.ok(r.includes('0 4 * * * curl -s "http://127.0.0.1:3000/api/cron/partner-match?key=$CRON_SECRET" >/dev/null'));
  const m = src("src/lib/partner/matchSend.ts");
  assert.ok(m.includes("pg_try_advisory_xact_lock"));
  assert.ok(m.includes("skipDuplicates: true"));
  assert.ok(m.includes("take: MATCH_CLAIM_CAP"));
  assert.ok(m.includes("limit: MATCH_CHANGE_CAP"));
  // The owner mark is written only after the owner's mail went out.
  assert.ok(m.indexOf("await sendEmail({ to: d.email") < m.indexOf("body: OWNER_MARK_BODY,\n"), "mark after send");
});
