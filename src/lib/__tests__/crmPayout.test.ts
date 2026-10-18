import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BANK_MISSING_ERROR, ISSUER_MISSING_ERROR, PAYOUT_PAUSED_CODE, bankDetailsComplete, canDownloadCreditNote, creditNoteFilename, creditNoteFinal,
  CLAIM_NOT_ACTIVE_ERROR, PAYOUT_BUSY_ERROR, creditNoteYear, isTransactionBusyError, isVatMode, issuerFromEnv, nextCreditNoteSeq, partnerBankView,
  payoutDecision, payoutKind, type PayoutDecisionInput,
} from "@/lib/crm/payoutRules";
import { creditNoteModel, creditNoteNumber } from "@/lib/partner/creditNote";
import { isCreditNoteModel, isPdfBytes, renderCreditNotePdf } from "@/lib/partner/creditNotePdf";
import type { CrmUser } from "@/lib/crm/access";

const NOW = new Date("2026-10-18T10:00:00Z");
const base: PayoutDecisionInput = {
  hasPartnerShare: true, bankComplete: true, issuerComplete: true, blockedUntil: null, now: NOW, override: false, canOverride: true,
};

test("payoutDecision: no partner share is a plain stage change", () => {
  assert.deepEqual(payoutDecision({ ...base, hasPartnerShare: false, bankComplete: false, issuerComplete: false }), { ok: true, creditNote: false, overridden: false });
});

test("payoutDecision: bank, then issuer, then pause", () => {
  assert.deepEqual(payoutDecision({ ...base, bankComplete: false, issuerComplete: false }), { ok: false, error: BANK_MISSING_ERROR });
  assert.deepEqual(payoutDecision({ ...base, issuerComplete: false }), { ok: false, error: ISSUER_MISSING_ERROR });
  assert.deepEqual(payoutDecision(base), { ok: true, creditNote: true, overridden: false });
});

test("payoutDecision: pause matrix", () => {
  const until = new Date("2026-10-20T08:00:00Z");
  const paused = payoutDecision({ ...base, blockedUntil: until });
  assert.equal(paused.ok, false);
  if (!paused.ok) {
    assert.equal(paused.code, PAYOUT_PAUSED_CODE);
    assert.equal(paused.error, "Payouts are paused until 2026-10-20 after a bank-details change. Tick 'Pay anyway' to override.");
  }
  // override without the right does nothing
  assert.equal(payoutDecision({ ...base, blockedUntil: until, override: true, canOverride: false }).ok, false);
  // right without the explicit override does nothing
  assert.equal(payoutDecision({ ...base, blockedUntil: until, override: false, canOverride: true }).ok, false);
  assert.deepEqual(payoutDecision({ ...base, blockedUntil: until, override: true }), { ok: true, creditNote: true, overridden: true });
  // pause over: no override recorded even if the box was ticked
  assert.deepEqual(payoutDecision({ ...base, blockedUntil: new Date("2026-10-18T09:59:59Z"), override: true }), { ok: true, creditNote: true, overridden: false });
  // exactly at the boundary the pause has ended
  assert.equal(payoutDecision({ ...base, blockedUntil: NOW }).ok, true);
  // override never bypasses missing bank details
  assert.deepEqual(payoutDecision({ ...base, blockedUntil: until, override: true, bankComplete: false }), { ok: false, error: BANK_MISSING_ERROR });
});

test("payoutKind: a positive partner commission needs an active claim covering the deal, else BLOCK", () => {
  const since = new Date("2026-03-01T00:00:00Z");
  const k = (o: Partial<Parameters<typeof payoutKind>[0]> = {}) => payoutKind({
    partnerCommission: 5000, partnerId: "p1", claimEffectivelyActive: true, claimActiveSince: since, dealCreatedAt: new Date("2026-04-01T00:00:00Z"), ...o,
  });
  assert.deepEqual(k(), { kind: "partner" });
  // Deal created exactly at activeSince is covered.
  assert.deepEqual(k({ dealCreatedAt: since }), { kind: "partner" });
  // No / zero partner commission: plain payout, whatever the claim says.
  assert.deepEqual(k({ partnerCommission: 0, claimEffectivelyActive: false }), { kind: "plain" });
  assert.deepEqual(k({ partnerCommission: null, partnerId: null, claimActiveSince: null }), { kind: "plain" });
  assert.deepEqual(k({ partnerCommission: -10 }), { kind: "plain" });
  // Partner commission, but the claim is not (or no longer) active for this deal: blocked, never silently plain.
  const blocked = { kind: "blocked", error: CLAIM_NOT_ACTIVE_ERROR };
  assert.deepEqual(k({ claimEffectivelyActive: false }), blocked);
  assert.deepEqual(k({ claimActiveSince: null, claimEffectivelyActive: false }), blocked);
  assert.deepEqual(k({ partnerId: null }), blocked);
  assert.deepEqual(k({ dealCreatedAt: new Date("2026-02-28T23:59:59Z") }), blocked, "deal before activeSince");
  assert.equal(CLAIM_NOT_ACTIVE_ERROR,
    "This deal carries a partner commission, but the partner's claim is no longer active for it — check the partner claim before paying out.");
});

test("isTransactionBusyError: P2028 and a closed transaction map to the retry message", () => {
  assert.equal(isTransactionBusyError({ code: "P2028", message: "Transaction API error" }), true);
  assert.equal(isTransactionBusyError(new Error("Transaction already closed: A query cannot be executed on an expired transaction.")), true);
  assert.equal(isTransactionBusyError({ code: "P2002" }), false);
  assert.equal(isTransactionBusyError(new Error("boom")), false);
  assert.equal(isTransactionBusyError(null), false);
  assert.equal(PAYOUT_BUSY_ERROR, "Busy issuing another credit note — please try again.");
  const src = readFileSync(join(process.cwd(), "src/lib/crm/payout.ts"), "utf8");
  assert.ok(src.includes("if (isTransactionBusyError(e)) return { error: PAYOUT_BUSY_ERROR };"), "markPaidOut maps it");
  assert.ok(src.includes("if (kind.kind === \"blocked\") throw new Abort(kind.error);"), "markPaidOut blocks instead of a plain payout");
  assert.ok(src.includes("development.override?.alias?.trim() || deal.development.publicName"), "PDF project name = portal/CSV/mail expression");
  for (const k of ["CVE_LEGAL_NAME", "CVE_LEGAL_ADDRESS", "CVE_LEGAL_VAT_ID", "CVE_LEGAL_REG_NO"]) assert.ok(src.includes(k), `payout.ts documents ${k}`);
});

const BANK = { holder: "Nina Bauer", iban: "DE89370400440532013000", bic: null, billingName: "Nina Bauer", billingAddress: "Str. 1\n10115 Berlin", vatId: null };

test("bankDetailsComplete", () => {
  assert.equal(bankDetailsComplete(BANK), true);
  assert.equal(bankDetailsComplete(null), false);
  assert.equal(bankDetailsComplete({ ...BANK, iban: "DE00370400440532013000" }), false);
  assert.equal(bankDetailsComplete({ ...BANK, billingAddress: "  " }), false);
  assert.equal(bankDetailsComplete({ ...BANK, holder: "" }), false);
});

test("issuerFromEnv: built-in company data, env overrides, fallbacks and literal \\n", () => {
  const full = { CVE_LEGAL_NAME: "Example Ltd", CVE_LEGAL_ADDRESS: "1 Street\\n8000 Paphos", CVE_LEGAL_VAT_ID: "CY1", CVE_LEGAL_REG_NO: "HE1" };
  assert.deepEqual(issuerFromEnv(full), { ok: true, issuer: { legalName: "Example Ltd", address: "1 Street\n8000 Paphos", vatId: "CY1", regNo: "HE1" } });
  assert.deepEqual(issuerFromEnv({}), {
    ok: true,
    issuer: { legalName: "SecretBrand Solutions LTD", address: "Palaion Patron Germanou 11\n8011 Paphos\nCyprus", vatId: "CY60038766O", regNo: "HE450005" },
  });
  const blank = issuerFromEnv({ ...full, CVE_LEGAL_NAME: "   " });
  assert.ok(blank.ok && blank.issuer.legalName === "SecretBrand Solutions LTD", "a blank override falls back to the built-in name");
  const short = { CVE_LEGAL_NAME: "X", CVE_LEGAL_ADDRESS: "A", CVE_VAT_ID: "CY2", CVE_REG_NO: "HE2" };
  const r = issuerFromEnv(short);
  assert.ok(r.ok && r.issuer.vatId === "CY2" && r.issuer.regNo === "HE2");
  assert.equal(creditNoteFinal({ CREDIT_NOTE_FINAL: "1" }), true);
  assert.equal(creditNoteFinal({ CREDIT_NOTE_FINAL: "true" }), false);
  assert.equal(creditNoteFinal({}), false);
});

test("counter: next sequence, corrupt rows refused, Cyprus-time year", () => {
  assert.equal(nextCreditNoteSeq(0), 1);
  assert.equal(nextCreditNoteSeq(41), 42);
  assert.throws(() => nextCreditNoteSeq(-1));
  assert.throws(() => nextCreditNoteSeq(1.5));
  assert.throws(() => nextCreditNoteSeq(Number.NaN));
  // Cyprus is UTC+2 on 31 Dec: 21:59 UTC is still 2026, 22:30 UTC is already 1 Jan 2027.
  assert.equal(creditNoteYear(new Date("2026-12-31T21:59:59Z")), 2026);
  assert.equal(creditNoteYear(new Date("2026-12-31T22:30:00Z")), 2027);
  assert.equal(creditNoteYear(new Date("2027-01-01T00:00:00Z")), 2027);
  assert.equal(creditNoteNumber(2026, nextCreditNoteSeq(0)), "CVE-GS-2026-0001");
});

const user = (o: Partial<CrmUser> = {}): CrmUser => ({
  id: "u1", role: "EDITOR", isOwner: false, isActive: true, canSeeColleagues: false, canEditColleagues: false, ...o,
});

test("canDownloadCreditNote: managers or lead viewers only", () => {
  const otherLead = { assignedToId: "u2" };
  assert.equal(canDownloadCreditNote(null, otherLead), false);
  assert.equal(canDownloadCreditNote(user(), null), false);
  assert.equal(canDownloadCreditNote(user(), otherLead), false);
  assert.equal(canDownloadCreditNote(user(), { assignedToId: "u1" }), true);
  assert.equal(canDownloadCreditNote(user({ canSeeColleagues: true }), otherLead), true);
  assert.equal(canDownloadCreditNote(user({ role: "ADMIN" }), otherLead), true);
  assert.equal(canDownloadCreditNote(user({ isOwner: true }), otherLead), true);
  assert.equal(canDownloadCreditNote(user({ isOwner: true, isActive: false }), otherLead), false);
  assert.equal(creditNoteFilename("CVE-GS-2026-0001"), "CVE-GS-2026-0001.pdf");
  assert.equal(creditNoteFilename('x"\r\n;y'), "xy.pdf");
  assert.equal(creditNoteFilename(""), "credit-note.pdf");
});

test("partnerBankView: masked only, badges", () => {
  const v = partnerBankView({ details: BANK, unreadable: false, ibanLast4: "3000", ibanChangedAt: new Date("2026-10-15T00:00:00Z") }, NOW);
  assert.equal(v.ibanMasked, "•••• 3000");
  assert.equal(v.pausedUntil, "2026-10-22");
  assert.equal(v.complete, true);
  assert.ok(!JSON.stringify(v).includes(BANK.iban), "full IBAN never in the view");
  const none = partnerBankView({ details: null, unreadable: false, ibanLast4: null, ibanChangedAt: null }, NOW);
  assert.equal(none.state, "none");
  assert.equal(none.complete, false);
  assert.equal(none.pausedUntil, null);
  const bad = partnerBankView({ details: null, unreadable: true, ibanLast4: "3000", ibanChangedAt: new Date("2026-01-01T00:00:00Z") }, NOW);
  assert.equal(bad.state, "unreadable");
  assert.equal(bad.complete, false);
  assert.equal(bad.pausedUntil, null);
  assert.equal(isVatMode("CY_VAT"), true);
  assert.equal(isVatMode("cy_vat"), false);
  assert.equal(isVatMode(null), false);
});

const sampleModel = () => creditNoteModel({
  issuer: { legalName: "Example Estates Ltd", address: "1 Sample Street\n8000 Paphos", vatId: "CY99999999X", regNo: "HE 000000" },
  partner: { billingName: "Agnieszka Łukasiewicz", billingAddress: "ul. Przykładowa 12\n00-001 Warszawa", vatId: null },
  number: creditNoteNumber(2026, 3), issuedAt: NOW,
  deal: { projectName: "Seaside Example", unitLabel: "B-204" },
  clientInitials: "Д. И.", net: 12345, vatMode: "CY_VAT", ibanLast4: "4321", final: false,
});

test("isCreditNoteModel: accepts the real model, rejects missing fields", () => {
  const m = sampleModel();
  assert.equal(isCreditNoteModel(m), true);
  assert.equal(isCreditNoteModel(null), false);
  assert.equal(isCreditNoteModel([]), false);
  const { number: _n, ...noNumber } = m;
  assert.equal(isCreditNoteModel(noNumber), false);
  assert.equal(isCreditNoteModel({ ...m, rows: [] }), false);
  assert.equal(isCreditNoteModel({ ...m, rows: [{ label: "x" }] }), false);
  assert.equal(isCreditNoteModel({ ...m, issuerLines: ["a", 1] }), false);
  assert.equal(isCreditNoteModel({ ...m, vatNote: 3 }), false);
  assert.equal(isCreditNoteModel({ ...m, draftFooter: null }), true);
});

test("worker keeps the same required string fields as isCreditNoteModel", () => {
  const src = readFileSync(join(process.cwd(), "scripts", "credit-note-pdf-worker.mjs"), "utf8");
  for (const k of ["title", "numberLabel", "number", "dateLabel", "date", "issuerLabel", "recipientLabel", "referenceLabel", "reference", "paymentNote", "selfBillingNote"]) {
    assert.ok(src.includes(`"${k}"`), `worker checks ${k}`);
  }
});

test("isPdfBytes", () => {
  assert.equal(isPdfBytes(Buffer.from("%PDF-1.3\n...")), true);
  assert.equal(isPdfBytes(Buffer.from("<html>")), false);
  assert.equal(isPdfBytes(Buffer.alloc(0)), false);
});

test("worker renders a real PDF from a sample model (no DB, no network)", { timeout: 30_000 }, async (t) => {
  try {
    await import("@react-pdf/renderer");
  } catch {
    console.warn("[crmPayout.test] @react-pdf/renderer not importable — worker render test skipped");
    t.skip("@react-pdf/renderer not importable");
    return;
  }
  const pdf = await renderCreditNotePdf(sampleModel());
  assert.ok(isPdfBytes(pdf));
  assert.ok(pdf.length > 1024, `pdf is ${pdf.length} bytes`);
});

test("renderCreditNotePdf rejects an incomplete model without spawning", async () => {
  await assert.rejects(renderCreditNotePdf({ title: "x" } as never), /incomplete/);
});
