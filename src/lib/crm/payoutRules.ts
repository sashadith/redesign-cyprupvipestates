import { canAssignLeads, canViewLead, type CrmUser } from "./access";
import { ibanValid, isPayoutBlocked, normaliseIban, payoutBlockedUntil, type BankDetails } from "@/lib/partner/bank";

// Pure rules for "Paid out" on a partner deal (partner portal phase 3c). No DB,
// no env reads of their own: markPaidOut (payout.ts) feeds them.

export const PAYOUT_PAUSED_CODE = "PAYOUT_PAUSED" as const;

export const BANK_MISSING_ERROR = "Partner bank details are missing — ask the partner to complete their profile.";
export const ISSUER_MISSING_ERROR = "Company details for credit notes are not configured (CVE_LEGAL_*).";
export function pausedError(until: Date): string {
  return `Payouts are paused until ${until.toISOString().slice(0, 10)} after a bank-details change. Tick 'Pay anyway' to override.`;
}

export type PayoutDecisionInput = {
  hasPartnerShare: boolean;
  bankComplete: boolean;
  issuerComplete: boolean;
  blockedUntil: Date | null;
  now: Date;
  override: boolean;
  canOverride: boolean;
};

export type PayoutDecision =
  | { ok: true; creditNote: boolean; overridden: boolean }
  | { ok: false; error: string; code?: typeof PAYOUT_PAUSED_CODE };

/**
 * Without a partner share: a plain stage change. With one: bank details and issuer
 * data must be complete, and a payout pause (IBAN changed < 7 days ago) only gives
 * way to an explicit override by someone allowed to override.
 */
export function payoutDecision(i: PayoutDecisionInput): PayoutDecision {
  if (!i.hasPartnerShare) return { ok: true, creditNote: false, overridden: false };
  if (!i.bankComplete) return { ok: false, error: BANK_MISSING_ERROR };
  if (!i.issuerComplete) return { ok: false, error: ISSUER_MISSING_ERROR };
  const blocked = isPayoutBlocked(i.blockedUntil, i.now);
  if (blocked && !(i.override && i.canOverride)) {
    return { ok: false, error: pausedError(i.blockedUntil as Date), code: PAYOUT_PAUSED_CODE };
  }
  return { ok: true, creditNote: true, overridden: blocked };
}

/** A deal earns a credit note only with a positive partner commission and an effectively ACTIVE claim. */
export function isPartnerDeal(i: { partnerCommission: number | null; claimEffectivelyActive: boolean }): boolean {
  return (i.partnerCommission ?? 0) > 0 && i.claimEffectivelyActive;
}

/** Everything a credit note needs from the partner's bank details. */
export function bankDetailsComplete(d: BankDetails | null): boolean {
  return !!d && !!d.holder?.trim() && ibanValid(d.iban) && !!d.billingName?.trim() && !!d.billingAddress?.trim();
}

export type Issuer = { legalName: string; address: string; vatId: string; regNo: string };
type Env = Record<string, string | undefined>;

const envVal = (env: Env, ...keys: string[]) => {
  for (const k of keys) {
    const v = env[k]?.trim();
    if (v) return v;
  }
  return "";
};

/**
 * Issuer block from env: CVE_LEGAL_NAME, CVE_LEGAL_ADDRESS (newlines as real
 * line breaks or a literal "\n"), CVE_LEGAL_VAT_ID, CVE_LEGAL_REG_NO. The plan's
 * shorter CVE_VAT_ID / CVE_REG_NO are accepted as fallbacks.
 */
export function issuerFromEnv(env: Env): { ok: true; issuer: Issuer } | { ok: false; missing: string[] } {
  const legalName = envVal(env, "CVE_LEGAL_NAME");
  const address = envVal(env, "CVE_LEGAL_ADDRESS").replace(/\\n/g, "\n");
  const vatId = envVal(env, "CVE_LEGAL_VAT_ID", "CVE_VAT_ID");
  const regNo = envVal(env, "CVE_LEGAL_REG_NO", "CVE_REG_NO");
  const missing = [
    !legalName && "CVE_LEGAL_NAME", !address.trim() && "CVE_LEGAL_ADDRESS", !vatId && "CVE_LEGAL_VAT_ID", !regNo && "CVE_LEGAL_REG_NO",
  ].filter((x): x is string => !!x);
  if (missing.length) return { ok: false, missing };
  return { ok: true, issuer: { legalName, address, vatId, regNo } };
}

export function creditNoteFinal(env: Env): boolean {
  return env.CREDIT_NOTE_FINAL === "1";
}

/** Gap-free yearly sequence: the next number after the locked counter row. */
export function nextCreditNoteSeq(lastSeq: number): number {
  if (!Number.isInteger(lastSeq) || lastSeq < 0) throw new Error("Credit note counter is corrupt.");
  return lastSeq + 1;
}

/** The credit-note year is the document date's (UTC) year. */
export function creditNoteYear(issuedAt: Date): number {
  return issuedAt.getUTCFullYear();
}

/** Staff download: managers, or anyone who may see the deal's lead. */
export function canDownloadCreditNote(user: CrmUser | null, lead: { assignedToId: string | null } | null): boolean {
  if (!user || !user.isActive || !lead) return false;
  return canAssignLeads(user) || canViewLead(user, lead);
}

/** Attachment filename from a credit-note number; anything outside [A-Za-z0-9-] is dropped. */
export function creditNoteFilename(number: string): string {
  const safe = number.replace(/[^A-Za-z0-9-]/g, "");
  return `${safe || "credit-note"}.pdf`;
}

/** What a /crm/partners row may show about bank details: masked IBAN only, never the full number. */
export type PartnerBankView = {
  state: "none" | "unreadable" | "ok";
  holder: string | null;
  ibanMasked: string | null;
  bic: string | null;
  billingName: string | null;
  billingAddress: string | null;
  vatId: string | null;
  complete: boolean;
  /** YYYY-MM-DD while payouts are paused after an IBAN change, else null. */
  pausedUntil: string | null;
};

export function partnerBankView(
  input: { details: BankDetails | null; unreadable: boolean; ibanLast4: string | null; ibanChangedAt: Date | null },
  now: Date,
): PartnerBankView {
  const until = payoutBlockedUntil(input.ibanChangedAt);
  const pausedUntil = isPayoutBlocked(until, now) ? (until as Date).toISOString().slice(0, 10) : null;
  const d = input.details;
  const last4 = input.ibanLast4 ?? (d ? normaliseIban(d.iban).slice(-4) : null);
  return {
    state: input.unreadable ? "unreadable" : d ? "ok" : "none",
    holder: d?.holder ?? null,
    ibanMasked: last4 ? `•••• ${last4}` : null,
    bic: d?.bic ?? null,
    billingName: d?.billingName ?? null,
    billingAddress: d?.billingAddress ?? null,
    vatId: d?.vatId ?? null,
    complete: !input.unreadable && bankDetailsComplete(d) && !!input.ibanLast4,
    pausedUntil,
  };
}

export const VAT_MODES = ["NONE", "CY_VAT", "REVERSE_CHARGE"] as const;
export type VatModeValue = (typeof VAT_MODES)[number];
export function isVatMode(v: unknown): v is VatModeValue {
  return typeof v === "string" && (VAT_MODES as readonly string[]).includes(v);
}
