import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { notificationGate, partnerStatusGate, optOutGate } from "@/lib/partner/notify";
import { routeNotification } from "@/lib/partner/telegram";
import {
  closedDealClaimsWhere, closedDealsByPartner, mergeTierEdits, parseTierEdits, parseTierUpPayload, proposalEligibility, tierAcceptData,
  tierConfigDiff, tierFromRow, tierLabel, tierProposalTelegram, tierUpPayload, tierUpRefKey, tiersStartFromEnv, type ClaimWithDeals,
} from "@/lib/partner/tierFlow";
import { proposeTier, validateTierConfig, type TierConfig } from "@/lib/partner/tiers";

const DAY = 86_400_000;
const NOW = new Date("2026-10-19T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const TIERS: TierConfig[] = [
  { key: "silver", name: "Silver", sort: 1, minClosedDeals: 0, handoverShare: 30, fixShare: 50, active: true },
  { key: "gold", name: "Gold", sort: 2, minClosedDeals: 3, handoverShare: 35, fixShare: 55, active: true },
  { key: "platinum", name: "Platinum", sort: 3, minClosedDeals: 6, handoverShare: 40, fixShare: 60, active: true },
];
const GOLD = TIERS[1];

// ── Closed deals (batched) ──────────────────────────────────────────────────

test("closedDealClaimsWhere: partner-scoped, ACTIVE claims, not-trashed leads, closed deals in the window", () => {
  const one = closedDealClaimsWhere(["p1"], NOW);
  assert.equal(one.partnerId, "p1");
  assert.equal(one.state, "ACTIVE");
  const many = closedDealClaimsWhere(["p1", "p2"], NOW);
  assert.deepEqual(many.partnerId, { in: ["p1", "p2"] });
  const deals = (many.lead as { deletedAt: null; deals: { some: { commissionStatus: { in: string[] }; earnedAt: { gte: Date; lte: Date } } } });
  assert.equal(deals.deletedAt, null);
  assert.deepEqual(deals.deals.some.commissionStatus.in, ["EARNED", "DEVELOPER_PAID", "PAID_OUT"]);
  assert.equal(deals.deals.some.earnedAt.gte.getTime(), ago(365).getTime());
  assert.throws(() => closedDealClaimsWhere([], NOW));
  assert.throws(() => closedDealClaimsWhere([" "], NOW));
});

test("closedDealsByPartner: per partner, deals since activeSince only, each deal once, zero for listed partners", () => {
  const deal = (id: string, status: string, earnedDays: number | null, createdDays: number) => ({
    id, commissionStatus: status, earnedAt: earnedDays == null ? null : ago(earnedDays), createdAt: ago(createdDays),
  });
  const claims: ClaimWithDeals[] = [
    { partnerId: "p1", createdAt: ago(200), reviewedAt: null, lead: { deletedAt: null, deals: [deal("d1", "EARNED", 10, 100), deal("d2", "PAID_OUT", 400, 450), deal("d3", "EXPECTED", null, 20)] } },
    // Reviewed (known contact): only deals created after the review count.
    { partnerId: "p1", createdAt: ago(300), reviewedAt: ago(50), lead: { deletedAt: null, deals: [deal("d4", "DEVELOPER_PAID", 5, 60), deal("d5", "EARNED", 5, 40)] } },
    // Same deal reached twice for one partner counts once.
    { partnerId: "p1", createdAt: ago(200), reviewedAt: null, lead: { deletedAt: null, deals: [deal("d1", "EARNED", 10, 100)] } },
    { partnerId: "p2", createdAt: ago(10), reviewedAt: null, lead: { deletedAt: new Date(), deals: [deal("d6", "EARNED", 1, 5)] } },
    { partnerId: "p2", createdAt: ago(10), reviewedAt: null, lead: null },
  ];
  const m = closedDealsByPartner(claims, NOW, ["p1", "p2", "p3"]);
  assert.equal(m.get("p1"), 2); // d1, d5
  assert.equal(m.get("p2"), 0);
  assert.equal(m.get("p3"), 0);
});

// ── Proposal eligibility ────────────────────────────────────────────────────

test("proposalEligibility: needs an upgrade, no open proposal, and more deals than the latest decline", () => {
  const base = { proposed: GOLD, openProposal: false, lastDecided: null, closedDeals: 3 };
  assert.deepEqual(proposalEligibility(base), { ok: true, tier: GOLD });
  assert.deepEqual(proposalEligibility({ ...base, proposed: null }), { skip: "no upgrade" });
  assert.deepEqual(proposalEligibility({ ...base, openProposal: true }), { skip: "open proposal" });
  assert.deepEqual(proposalEligibility({ ...base, lastDecided: { decision: "DECLINED", closedDeals: 3 } }), { skip: "declined" });
  assert.deepEqual(proposalEligibility({ ...base, lastDecided: { decision: "DECLINED", closedDeals: 5 } }), { skip: "declined" });
  assert.deepEqual(proposalEligibility({ ...base, closedDeals: 4, lastDecided: { decision: "DECLINED", closedDeals: 3 } }), { ok: true, tier: GOLD });
  // The latest decision was an accept: older declines no longer matter.
  assert.deepEqual(proposalEligibility({ ...base, lastDecided: { decision: "ACCEPTED", closedDeals: 9 } }), { ok: true, tier: GOLD });
});

test("cron flow: proposeTier + eligibility never downgrade and skip the same tier", () => {
  assert.equal(proposeTier("platinum", 0, TIERS), null);
  assert.equal(proposeTier("gold", 4, TIERS), null);
  assert.equal(proposeTier(null, 3, TIERS)?.key, "gold");
  assert.equal(proposeTier("gold", 6, TIERS)?.key, "platinum");
});

test("cron: PARTNER_TIERS_START gate", () => {
  assert.equal(tiersStartFromEnv({}), null);
  assert.equal(tiersStartFromEnv({ PARTNER_TIERS_START: "soon" }), null);
  assert.equal(tiersStartFromEnv({ PARTNER_TIERS_START: "2026-10-26T00:00:00Z" })?.toISOString(), "2026-10-26T00:00:00.000Z");
});

test("office Telegram: English, escaped, counted, linked to /crm/partners, bounded", () => {
  const html = tierProposalTelegram(
    [{ partnerName: "Anna <b>", company: "A&B", fromLabel: "Silver (default)", toName: "Gold", closedDeals: 3 },
      { partnerName: "Ben", company: null, fromLabel: "Gold", toName: "Platinum", closedDeals: 1 }],
    "https://crm.example/crm/partners",
  );
  assert.ok(html.startsWith("<b>Partner tier proposals: 2 new</b>"));
  assert.ok(html.includes("Anna &lt;b&gt; (A&amp;B): Silver (default) → <b>Gold</b>, 3 closed deals in 12 months"));
  assert.ok(html.includes("Ben: Gold → <b>Platinum</b>, 1 closed deal in 12 months"));
  assert.ok(html.includes('<a href="https://crm.example/crm/partners">'));
  const many = Array.from({ length: 45 }, (_, i) => ({ partnerName: `P${i}`, company: null, fromLabel: "Silver", toName: "Gold", closedDeals: 3 }));
  const big = tierProposalTelegram(many, "https://crm.example/crm/partners");
  assert.ok(big.includes("…and 15 more"));
  assert.ok(big.length < 4096);
});

// ── Accept data mapping ─────────────────────────────────────────────────────

test("tierFromRow: Decimal shares become numbers", () => {
  const dec = { toString: () => "32.5", valueOf: () => 32.5 };
  const t = tierFromRow({ key: "gold", name: "Gold", sort: 2, minClosedDeals: 3, handoverShare: dec, fixShare: "55", active: true });
  assert.equal(t.handoverShare, 32.5);
  assert.equal(t.fixShare, 55);
});

test("tierAcceptData: tier → partner fields; missing or inactive tier refused", () => {
  const r = tierAcceptData(GOLD, NOW);
  assert.ok("data" in r);
  assert.deepEqual(r.data, { tierKey: "gold", tierSince: NOW, handoverShare: 35, fixShare: 55 });
  assert.ok("error" in tierAcceptData(null, NOW));
  const inactive = tierAcceptData({ ...GOLD, active: false }, NOW);
  assert.ok("error" in inactive && inactive.error.includes("inactive"));
  // Stale proposal after a manual change: never a downgrade or a no-op.
  assert.ok("error" in tierAcceptData(GOLD, NOW, TIERS[2]));
  assert.ok("error" in tierAcceptData(GOLD, NOW, GOLD));
  assert.ok("data" in tierAcceptData(GOLD, NOW, TIERS[0]));
});

test("TIER_UP outbox row: refKey per proposal, payload round-trips through the sender's parser", () => {
  assert.equal(tierUpRefKey("abc"), "tierup:abc");
  const payload = tierUpPayload(GOLD);
  assert.deepEqual(payload, { tierKey: "gold", tierName: "Gold", handoverShare: 35, fixShare: 55 });
  assert.deepEqual(parseTierUpPayload(JSON.parse(JSON.stringify(payload))), payload);
});

// ── TIER_UP sender gate ─────────────────────────────────────────────────────

test("TIER_UP sender gate: partner ACTIVE only, no claim needed, never opted out, routed like other kinds", () => {
  assert.equal(notificationGate({ kind: "TIER_UP", accepted: false, claim: null }), null);
  assert.equal(partnerStatusGate("ACTIVE"), null);
  assert.equal(partnerStatusGate("SUSPENDED"), "suspended");
  assert.equal(partnerStatusGate("PENDING"), "pending");
  assert.equal(optOutGate("TIER_UP", false), null);
  assert.deepEqual(routeNotification({ kind: "TIER_UP", notifyChannel: "EMAIL", chatLinked: true, emailNotifications: false }), { email: true, telegram: false });
  assert.deepEqual(routeNotification({ kind: "TIER_UP", notifyChannel: "TELEGRAM", chatLinked: true, emailNotifications: true }), { email: false, telegram: true });
  assert.deepEqual(routeNotification({ kind: "TIER_UP", notifyChannel: "TELEGRAM", chatLinked: false, emailNotifications: true }), { email: true, telegram: false });
});

test("TIER_UP sender: invalid payloads are skipped, never mailed", () => {
  for (const bad of [null, [], "x", {}, { tierKey: "gold", tierName: "", handoverShare: 35, fixShare: 55 }, { tierKey: "gold", tierName: "Gold", handoverShare: 135, fixShare: 55 },
    { tierKey: "gold", tierName: "Gold", handoverShare: "35", fixShare: 55 }, { tierName: "Gold", handoverShare: 35, fixShare: 55 }]) {
    assert.equal(parseTierUpPayload(bad), null, JSON.stringify(bad));
  }
  const s = src("src/lib/partner/notifySend.ts");
  assert.match(s, /case "TIER_UP": \{[^]*?parseTierUpPayload\(row\.payload\)[^]*?return \{ skip: "invalid payload" \}[^]*?buildTierUpEmail\(locale,/);
  assert.ok(!s.includes("not implemented yet"));
});

// ── CRM form parsing ────────────────────────────────────────────────────────

const formRows = () => [
  { key: "silver", name: " Silver ", minClosedDeals: "0", handoverShare: "30", fixShare: "50", active: true },
  { key: "gold", name: "Gold", minClosedDeals: "3", handoverShare: "35,5", fixShare: "55.25", active: true },
  { key: "platinum", name: "Platinum", minClosedDeals: "6", handoverShare: "40", fixShare: "60", active: false },
];

test("parseTierEdits: strings, decimal comma, two decimals at most, whole thresholds", () => {
  const r = parseTierEdits(formRows());
  assert.ok("rows" in r);
  assert.deepEqual(r.rows[1], { key: "gold", name: "Gold", minClosedDeals: 3, handoverShare: 35.5, fixShare: 55.25, active: true });
  assert.equal(r.rows[0].name, "Silver");
  assert.equal(r.rows[2].active, false);
  const bad = (patch: Record<string, unknown>) => parseTierEdits([{ ...formRows()[0], ...patch }]);
  assert.ok("error" in bad({ minClosedDeals: "1.5" }));
  assert.ok("error" in bad({ minClosedDeals: "-1" }));
  assert.ok("error" in bad({ handoverShare: "30.125" }));
  assert.ok("error" in bad({ handoverShare: "abc" }));
  assert.ok("error" in bad({ fixShare: "" }));
  assert.ok("error" in bad({ key: "" }));
  assert.ok("error" in parseTierEdits([]));
  assert.ok("error" in parseTierEdits("x"));
  // Over 100 parses, validateTierConfig refuses it.
  const over = parseTierEdits([{ ...formRows()[0], handoverShare: "101" }]);
  assert.ok("rows" in over);
});

test("mergeTierEdits + validateTierConfig + diff: stored sort kept, unknown/missing keys refused, only changes audited", () => {
  const edits = parseTierEdits(formRows());
  assert.ok("rows" in edits);
  const merged = mergeTierEdits(TIERS, edits.rows);
  assert.ok("rows" in merged);
  assert.deepEqual(merged.rows.map((t) => [t.key, t.sort]), [["silver", 1], ["gold", 2], ["platinum", 3]]);
  assert.deepEqual(validateTierConfig(merged.rows), []);
  const diff = tierConfigDiff(TIERS, merged.rows);
  assert.deepEqual(diff.changed.map((t) => t.key), ["gold", "platinum"]);
  assert.deepEqual(diff.before, { gold: { handoverShare: 35, fixShare: 55 }, platinum: { active: true } });
  assert.deepEqual(diff.after, { gold: { handoverShare: 35.5, fixShare: 55.25 }, platinum: { active: false } });
  assert.ok("error" in mergeTierEdits(TIERS, edits.rows.slice(0, 2)));
  assert.ok("error" in mergeTierEdits(TIERS, [...edits.rows.slice(0, 2), { ...edits.rows[2], key: "diamond" }]));
  assert.ok("error" in mergeTierEdits(TIERS, [edits.rows[0], edits.rows[0], edits.rows[1]]));
  // A threshold that is not increasing fails validation after the merge.
  const flat = mergeTierEdits(TIERS, edits.rows.map((r) => (r.key === "gold" ? { ...r, minClosedDeals: 0 } : r)));
  assert.ok("rows" in flat && validateTierConfig(flat.rows).length > 0);
});

test("tierLabel: stored name, default silver, unknown key", () => {
  assert.equal(tierLabel("gold", TIERS), "Gold");
  assert.equal(tierLabel(null, TIERS), "Silver (default)");
  assert.equal(tierLabel("gone", TIERS), "gone");
});

// ── Wiring ──────────────────────────────────────────────────────────────────

test("CRM actions: guarded, audited in the transaction, row-locked, guarded proposal update, TIER_UP outbox row", () => {
  const s = src("src/app/crm/partners/tierActions.ts");
  assert.ok(s.startsWith('"use server";'));
  for (const fn of ["saveTierConfigAction", "acceptTierProposalAction", "declineTierProposalAction"]) {
    assert.match(s, new RegExp(`export async function ${fn}\\([^)]*\\): Promise<Result> \\{\\n  const actor = await guard\\(\\);\\n  if \\(!actor\\) return \\{ error: DENIED \\};`), fn);
  }
  assert.equal(s.split("where: { id: proposalId, decidedAt: null }").length - 1, 2, "both decisions only touch an undecided proposal");
  assert.ok(s.includes("FROM partners WHERE id = ${id} FOR UPDATE"));
  assert.ok(s.includes("SELECT key FROM partner_tiers FOR UPDATE"));
  for (const a of ["partner_tiers_update", "partner_tier_accept", "partner_tier_decline"]) assert.match(s, new RegExp(`writeAudit\\(actor, "${a}"[^]*?, tx\\);`), a);
  assert.ok(s.includes('kind: "TIER_UP", refKey: tierUpRefKey(proposalId)'));
});

test("cron route: same auth as partner-digest, START gate, lock, crontab line", () => {
  const r = src("src/app/api/cron/partner-tiers/route.ts");
  assert.ok(r.includes('if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET)'));
  assert.ok(r.includes("0 3 * * * curl -s \"http://127.0.0.1:3000/api/cron/partner-tiers?key=$CRON_SECRET\""));
  assert.ok(r.includes('return { skipped: "PARTNER_TIERS_START not set" }'));
  assert.ok(r.includes("withTiersLock(() => runTierProposals(now, start, crmBase))"));
  const store = src("src/lib/partner/tierStore.ts");
  assert.ok(store.includes("pg_try_advisory_xact_lock(${TIERS_LOCK_KEY}::bigint)"));
  assert.ok(store.includes('where: { status: "ACTIVE" }'));
  assert.ok(store.includes("take: TIERS_PARTNER_CAP"));
  assert.ok(store.includes('skip("open proposal")'), "P2002 on the open-proposal index is a skip");
  assert.ok(store.includes('result.errors.push(`office telegram:'), "a Telegram failure is logged, not thrown");
});

test("portal: tier card on Overview (ACTIVE) and Commissions, partner-scoped status", () => {
  const home = src("src/app/partner-portal/home/page.tsx");
  assert.ok(home.includes('me.partner.status === "ACTIVE" ? myTierStatus(me.partner.id) : Promise.resolve(null)'));
  assert.ok(home.includes("<TierCard"));
  const comm = src("src/app/partner-portal/commissions/page.tsx");
  assert.ok(comm.includes("myTierStatus(me.partner.id)") && comm.includes("<TierCard"));
  const store = src("src/lib/partner/tierStore.ts");
  assert.ok(store.includes("closedDealCounts([partnerId], now)"));
});
