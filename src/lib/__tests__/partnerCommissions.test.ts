import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PartnerNotificationKind } from "@prisma/client";
import type { Activity, RawClaim, RawDeal } from "@/lib/partner/clientDto";
import {
  COMMISSIONS_CAP, commissionClaimsWhere, commissionRowTotals, commissionRows, creditNoteWhere, creditNotesWhere, csvFilename, cyprusDay,
  parsePeriod, periodQuery, toCsvRows, type CreditNoteRef,
} from "@/lib/partner/commissions";
import { commissionsCsv } from "@/lib/partner/commissionsCsv";
import { PARTNER_LOCALES, dict } from "@/lib/partner/i18n";
import {
  NOTIFICATION_KINDS, buildPayoutEmail, commissionsLink, formatPayoutAmount, notificationGate, payoutDealIdFromRefKey, unhandledKind,
} from "@/lib/partner/notify";

const P = "partner-1";
const OTHER = "partner-2";
const t = (iso: string) => new Date(iso);
const now = t("2027-01-10T00:00:00Z");

// ── where-builders ──────────────────────────────────────────────────────────
test("commission where-builders carry the partnerId and refuse an empty one", () => {
  assert.deepEqual(commissionClaimsWhere(P), { partnerId: P, state: "ACTIVE", lead: { deletedAt: null, deals: { some: {} } } });
  assert.deepEqual(creditNotesWhere(P, ["d1"]), { partnerId: P, dealId: { in: ["d1"] } });
  assert.deepEqual(creditNoteWhere(P, "cn1"), { id: "cn1", partnerId: P });
  assert.throws(() => commissionClaimsWhere(""));
  assert.throws(() => creditNotesWhere(" ", []));
  assert.throws(() => creditNoteWhere("", "cn1"));
  assert.equal(COMMISSIONS_CAP, 2000);
});

// ── fixtures with everything a partner must NOT see ─────────────────────────
const SECRETS = ["99999", "ourCommission", "ourRatePercent", "lead-secret@example.com", "Leadname", "internal note text", "CY17002001280000001200527600", "IBAN"];

const lead = { status: "OFFER", deletedAt: null, firstName: "Leadname", email: "lead-secret@example.com", notes: "internal note text" };

function claim(over: Partial<RawClaim> & Record<string, unknown> = {}): RawClaim {
  return {
    id: "claim-1", partnerId: P, leadId: "lead-1", state: "ACTIVE", createdAt: t("2026-03-01T10:00:00Z"), reviewedAt: null,
    submission: { firstName: "Anna", lastName: "Schmidt", email: "anna@typed.example" },
    lead: lead as unknown as RawClaim["lead"],
    ...over,
  } as RawClaim;
}

const deal = (over: Partial<RawDeal> & Record<string, unknown> = {}): RawDeal =>
  ({
    id: "deal-1", leadId: "lead-1", createdAt: t("2026-04-01T00:00:00Z"), projectName: "Sea View", unitLabel: "A12", price: 300000,
    partnerCommission: 4500, rateSource: "PROJECT", commissionStatus: "PAID_OUT", expectedAt: t("2026-05-01T00:00:00Z"),
    earnedAt: t("2026-06-01T12:00:00Z"), developerPaidAt: t("2026-07-01T12:00:00Z"), paidOutAt: t("2026-08-01T12:00:00Z"), cancelledAt: null,
    ourCommission: 99999, ourRatePercent: 5, iban: "CY17002001280000001200527600", ...over,
  }) as RawDeal;

const notes: CreditNoteRef[] = [{ id: "cn-1", number: "CVE-GS-2026-0001", dealId: "deal-1" }];
const ctx = (deals: RawDeal[], activity = new Map<string, Activity>(), creditNotes = notes) => ({ partnerId: P, now, activity, deals, creditNotes });
const all = { from: null, to: null };

test("commission rows: only partner-facing columns, the submitted name, the credit note, no secrets", () => {
  const rows = commissionRows([claim()], ctx([deal()]), all);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.deepEqual(Object.keys(r).sort(), [
    "client", "commission", "creditNote", "dealId", "developerPaidAt", "earnedAt", "expectedAt", "paidOutAt", "price", "project", "stage", "stageAt", "unit",
  ]);
  assert.equal(r.client, "Anna Schmidt");
  assert.deepEqual(r.creditNote, { id: "cn-1", number: "CVE-GS-2026-0001" });
  assert.equal(r.stageAt.toISOString(), "2026-08-01T12:00:00.000Z");
  const json = JSON.stringify(rows);
  for (const s of SECRETS) assert.ok(!json.includes(s), `row leaks "${s}"`);
});

test("commission rows refuse another partner's claim", () => {
  assert.throws(() => commissionRows([claim({ partnerId: OTHER })], ctx([deal()]), all));
});

test("effective rule: deals before activeSince, trashed leads and expired uncommitted claims are left out; committed claims stay", () => {
  // Accepted known contact: reviewedAt is activeSince — the deal created before it is not the partner's.
  assert.equal(commissionRows([claim({ reviewedAt: t("2026-04-02T00:00:00Z") })], ctx([deal()]), all).length, 0);
  assert.equal(commissionRows([claim({ lead: { status: "OFFER", deletedAt: t("2026-09-01T00:00:00Z") } })], ctx([deal()]), all).length, 0);
  // Only a CANCELLED deal, protection (6 months from activeSince) long over, no recent contact → EXPIRED → nothing.
  const cancelled = deal({ commissionStatus: "CANCELLED", cancelledAt: t("2026-05-01T12:00:00Z") });
  assert.equal(commissionRows([claim()], ctx([cancelled]), all).length, 0);
  // Same, but a real contact keeps protection alive → the cancelled deal is listed.
  const activity = new Map<string, Activity>([["lead-1", { events: [], firstRealContactAt: null, lastRealContactAt: t("2026-12-01T00:00:00Z") }]]);
  assert.equal(commissionRows([claim()], ctx([cancelled], activity), all).length, 1);
  // A live deal commits the claim long after protection ran out.
  assert.equal(commissionRows([claim()], ctx([deal()]), all).length, 1);
  // A deal on another lead never appears.
  assert.equal(commissionRows([claim()], ctx([deal({ leadId: "lead-9" })]), all).length, 0);
});

test("missing rate → commission null ('being calculated'); totals skip it and CANCELLED", () => {
  const rows = commissionRows([claim()], ctx([
    deal(),
    deal({ id: "deal-2", rateSource: "MISSING", partnerCommission: 7000, commissionStatus: "EARNED" }),
    deal({ id: "deal-3", partnerCommission: 1000, commissionStatus: "CANCELLED", cancelledAt: t("2026-09-01T12:00:00Z") }),
    deal({ id: "deal-4", partnerCommission: 2000, commissionStatus: "EXPECTED", earnedAt: null, developerPaidAt: null, paidOutAt: null }),
  ]), all);
  assert.equal(rows.length, 4);
  assert.equal(rows.find((r) => r.dealId === "deal-2")!.commission, null);
  assert.equal(rows.find((r) => r.dealId === "deal-4")!.stageAt.toISOString(), "2026-05-01T00:00:00.000Z", "EXPECTED uses expectedAt");
  assert.deepEqual(commissionRowTotals(rows), { EXPECTED: 2000, EARNED: 0, DEVELOPER_PAID: 0, PAID_OUT: 4500 });
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].stageAt >= rows[i].stageAt, "newest stage date first");
});

test("period filter: inclusive Cyprus days on the current stage date", () => {
  const late = deal({ paidOutAt: t("2026-12-31T22:30:00Z") }); // 1 Jan 2027 00:30 in Cyprus
  assert.equal(cyprusDay(late.paidOutAt!), "2027-01-01");
  assert.equal(commissionRows([claim()], ctx([late]), { from: "2026-01-01", to: "2026-12-31" }).length, 0);
  assert.equal(commissionRows([claim()], ctx([late]), { from: "2027-01-01", to: "2027-01-01" }).length, 1, "from = to is one whole day");
  assert.equal(commissionRows([claim()], ctx([deal()]), { from: "2026-08-01", to: null }).length, 1);
  assert.equal(commissionRows([claim()], ctx([deal()]), { from: null, to: "2026-07-31" }).length, 0);
});

test("parsePeriod: presets, custom range (swapped when reversed), junk ignored", () => {
  assert.deepEqual(parsePeriod({}, now), { preset: "all", from: null, to: null });
  assert.deepEqual(parsePeriod({ period: "this-year" }, now), { preset: "this-year", from: "2027-01-01", to: "2027-12-31" });
  assert.deepEqual(parsePeriod({ period: "last-year" }, now), { preset: "last-year", from: "2026-01-01", to: "2026-12-31" });
  // 31 Dec 23:00 UTC is already 1 Jan in Cyprus.
  assert.equal(parsePeriod({ period: "this-year" }, t("2026-12-31T23:00:00Z")).from, "2027-01-01");
  assert.deepEqual(parsePeriod({ from: "2026-09-30", to: "2026-01-01", period: "this-year" }, now), { preset: "custom", from: "2026-01-01", to: "2026-09-30" });
  assert.deepEqual(parsePeriod({ from: "2026-02-30", to: "x';drop" }, now), { preset: "all", from: null, to: null });
  assert.deepEqual(parsePeriod({ from: "2026-02-01" }, now), { preset: "custom", from: "2026-02-01", to: null });
  assert.deepEqual(parsePeriod({ period: ["this-year"] }, now), { preset: "all", from: null, to: null });
});

test("period query and CSV filename only carry validated values", () => {
  assert.equal(periodQuery(parsePeriod({}, now)), "");
  assert.equal(periodQuery(parsePeriod({ period: "last-year" }, now)), "?period=last-year");
  assert.equal(periodQuery(parsePeriod({ from: "2026-01-01", to: "2026-03-31" }, now)), "?from=2026-01-01&to=2026-03-31");
  assert.equal(csvFilename(parsePeriod({}, now)), "commissions-all-all.csv");
  assert.equal(csvFilename(parsePeriod({ period: "this-year" }, now)), "commissions-2027-01-01-2027-12-31.csv");
  assert.match(csvFilename(parsePeriod({ from: '"; evil', to: "2026-01-01" }, now)), /^commissions-[0-9a-z-]+\.csv$/);
});

test("CSV rows are built from the DTO only", () => {
  const rows = commissionRows([claim()], ctx([deal(), deal({ id: "deal-2", rateSource: "MISSING", commissionStatus: "EARNED" })]), all);
  const csvRows = toCsvRows(rows);
  for (const r of csvRows) {
    assert.deepEqual(Object.keys(r).sort(), [
      "client", "commission", "creditNoteNumber", "developerPaidAt", "earnedAt", "expectedAt", "paidOutAt", "price", "project", "stage", "unit",
    ]);
  }
  const csv = commissionsCsv(csvRows, "en");
  for (const s of SECRETS) assert.ok(!csv.includes(s), `CSV leaks "${s}"`);
  assert.ok(csv.includes("CVE-GS-2026-0001"));
  assert.ok(csv.includes("being calculated"));
  assert.ok(csv.includes("2026-08-01"));
});

// ── PAYOUT notification ─────────────────────────────────────────────────────
test("payout e-mail in every locale: amount, credit-note number, commissions link, escaped values", () => {
  const link = commissionsLink("https://partner.example");
  assert.equal(link, "https://partner.example/commissions");
  for (const l of PARTNER_LOCALES) {
    const amount = formatPayoutAmount(l, 4500);
    const m = buildPayoutEmail(l, {
      partnerFirstName: "Jan", clientName: "<b>Anna</b> & Co", project: "Sea View", unit: "A12", amount, creditNoteNumber: "CVE-GS-2026-0007", link,
    });
    assert.equal(m.subject, dict(l).mail.payout.subject);
    for (const part of [m.text, m.html]) {
      assert.ok(part.includes("CVE-GS-2026-0007"), l);
      assert.ok(part.includes(link), l);
      assert.ok(part.includes("Sea View"), l);
    }
    assert.ok(m.text.includes(amount), l);
    assert.ok(m.html.includes("&lt;b&gt;Anna&lt;/b&gt; &amp; Co"), `${l}: client name escaped`);
    assert.ok(!m.html.includes("<b>Anna</b>"), l);
    assert.ok(!/\{\w+\}/.test(m.text), `${l}: no unfilled placeholder`);
    for (const s of ["IBAN", "ourCommission", "99999"]) assert.ok(!m.text.includes(s) && !m.html.includes(s), `${l} leaks ${s}`);
  }
  const noUnit = buildPayoutEmail("en", { partnerFirstName: "", clientName: "", project: null, unit: null, amount: "€1", creditNoteNumber: "N", link });
  assert.ok(noUnit.text.includes("— (—, —)"), "missing values become a dash");
});

test("PAYOUT gate: told whatever the claim's state, but only for the partner's own claim", () => {
  for (const effective of ["ACTIVE", "EXPIRED", "NOT_PROCEEDING", "REJECTED"] as const) {
    assert.equal(notificationGate({ kind: "PAYOUT", accepted: false, claim: { ownedByPartner: true, effective } }), null, effective);
  }
  assert.equal(notificationGate({ kind: "PAYOUT", accepted: false, claim: { ownedByPartner: false, effective: "ACTIVE" } }), "claim missing");
  assert.equal(notificationGate({ kind: "PAYOUT", accepted: false, claim: null }), "claim missing");
  // The other kinds keep their gate.
  assert.equal(notificationGate({ kind: "STAGE", accepted: false, claim: { ownedByPartner: true, effective: "EXPIRED" } }), "protection ended");
});

test("notification kinds match the enum; the sender switch is exhaustive and handles PAYOUT explicitly", () => {
  assert.deepEqual([...NOTIFICATION_KINDS].sort(), Object.values(PartnerNotificationKind).sort());
  assert.throws(() => unhandledKind("NEW_KIND" as never), /unhandled notification kind NEW_KIND/);
  assert.equal(payoutDealIdFromRefKey("paid:deal-1"), "deal-1");
  assert.equal(payoutDealIdFromRefKey("paid:"), null);
  assert.equal(payoutDealIdFromRefKey("msg:deal-1"), null);
  const src = readFileSync(join(process.cwd(), "src/lib/partner/notifySend.ts"), "utf8");
  for (const k of NOTIFICATION_KINDS) assert.ok(src.includes(`case "${k}":`), `sender has a case for ${k}`);
  assert.ok(src.includes("default:\n      return unhandledKind(row.kind);"), "default branch is the never-check");
  assert.ok(src.includes("creditNoteWhere(row.partnerId, creditNoteId)"), "credit note loaded with the partnerId check");
});

test("commissions paths reach the portal: middleware matcher includes them and the host rewrite prefixes them", async () => {
  const { partnerRewritePath } = await import("@/lib/partner/host");
  const src = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");
  const m = src.match(/matcher:\s*\[\s*"\/\(\((.*)\)\.\*\)",/);
  assert.ok(m, "matcher found");
  const re = new RegExp(`^/(${m![1].replace(/\\\\/g, "\\")}).*$`);
  const env = { PARTNER_HOST: "partner.cyprusvipestates.com", NODE_ENV: "production" };
  for (const p of ["/commissions", "/commissions/report", "/commissions/export.csv", "/commissions/credit-note/abc"]) {
    assert.ok(re.test(p), `matcher covers ${p}`);
    assert.equal(partnerRewritePath("partner.cyprusvipestates.com", p, env), `/partner-portal${p}`);
  }
  assert.ok(!re.test("/api/x"), "sanity: excluded prefixes stay excluded");
});
