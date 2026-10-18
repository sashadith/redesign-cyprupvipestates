// Pure bank-detail logic (no DB, no node:crypto): validation, masking, payout block.
// Encryption lives in ./bankCrypto (server only) so client code can import this file.

const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, BA: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
  EE: 20, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GI: 23, GL: 18, GR: 27, HR: 21, HU: 28, IE: 22,
  IL: 23, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MT: 31,
  NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, RS: 22, SE: 24, SI: 19, SK: 24, SM: 27, TR: 26, UA: 29,
  VA: 22, XK: 20,
};

export const PAYOUT_BLOCK_DAYS = 7;

export function normaliseIban(s: string): string {
  return String(s).replace(/\s+/g, "").toUpperCase();
}

export function ibanValid(s: string): boolean {
  if (typeof s !== "string") return false;
  const iban = normaliseIban(s);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;
  if (IBAN_LENGTHS[iban.slice(0, 2)] !== iban.length) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = ch >= "A" ? ch.charCodeAt(0) - 55 : ch.charCodeAt(0) - 48;
    rem = (v > 9 ? rem * 100 + v : rem * 10 + v) % 97;
  }
  return rem === 1;
}

export function maskIban(iban: string): string {
  return `•••• ${normaliseIban(iban).slice(-4)}`;
}

export function bicValid(s: string): boolean {
  return typeof s === "string" && /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(s.replace(/\s+/g, "").toUpperCase());
}

export function vatIdValid(s: string): boolean {
  return typeof s === "string" && /^[A-Z]{2}[A-Z0-9]{2,18}$/.test(s.replace(/[\s.-]+/g, "").toUpperCase());
}

export interface BankDetails {
  holder: string;
  iban: string;
  bic: string | null;
  billingName: string;
  billingAddress: string;
  vatId: string | null;
}

export type BankDetailsResult =
  | { ok: true; data: BankDetails }
  | { ok: false; field: string; code: string };

export const BANK_ERROR_CODES = [
  "err.invalid", "err.unknownField", "err.holder", "err.iban", "err.bic", "err.billingName", "err.billingAddress", "err.vatId",
] as const;

const ALLOWED = new Set(["holder", "iban", "bic", "billingName", "billingAddress", "vatId"]);
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const HEBREW_RE = /[֐-׿]/;

const fail = (field: string, code: string): BankDetailsResult => ({ ok: false, field, code });
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const badLine = (s: string) => CONTROL_RE.test(s) || HEBREW_RE.test(s);

export function validateBankDetails(raw: unknown): BankDetailsResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("_", "err.invalid");
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!ALLOWED.has(k)) return fail(k, "err.unknownField");

  const holder = str(r.holder);
  if (!holder || holder.length > 80 || badLine(holder)) return fail("holder", "err.holder");

  if (typeof r.iban !== "string" || r.iban.length > 60 || !ibanValid(r.iban)) return fail("iban", "err.iban");
  const iban = normaliseIban(r.iban);

  let bic: string | null = null;
  if (r.bic !== undefined && r.bic !== null && str(r.bic) !== "") {
    if (typeof r.bic !== "string" || !bicValid(r.bic)) return fail("bic", "err.bic");
    bic = r.bic.replace(/\s+/g, "").toUpperCase();
  }

  const billingName = str(r.billingName);
  if (!billingName || billingName.length > 120 || badLine(billingName)) return fail("billingName", "err.billingName");

  const addr = str(r.billingAddress).replace(/\r\n?/g, "\n");
  if (!addr || addr.length > 300 || badLine(addr.replace(/\n/g, " "))) return fail("billingAddress", "err.billingAddress");

  let vatId: string | null = null;
  if (r.vatId !== undefined && r.vatId !== null && str(r.vatId) !== "") {
    if (typeof r.vatId !== "string" || !vatIdValid(r.vatId)) return fail("vatId", "err.vatId");
    vatId = r.vatId.replace(/[\s.-]+/g, "").toUpperCase();
  }

  return { ok: true, data: { holder, iban, bic, billingName, billingAddress: addr, vatId } };
}

/** The moment "Paid out" becomes allowed again after an IBAN change (null = never blocked). */
export function payoutBlockedUntil(ibanChangedAt: Date | null): Date | null {
  if (!ibanChangedAt) return null;
  return new Date(ibanChangedAt.getTime() + PAYOUT_BLOCK_DAYS * 86_400_000);
}

export function isPayoutBlocked(blockedUntil: Date | null, now: Date): boolean {
  return blockedUntil != null && now.getTime() < blockedUntil.getTime();
}
