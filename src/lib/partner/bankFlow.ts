// Pure helpers for the portal's bank-details change flow (no DB, no crypto, no I/O).
import { normaliseIban, type BankDetails } from "./bank";
import { escapeHtml } from "./mail";

export type BankFormInput = {
  holder: string;
  iban: string;
  bic: string;
  billingName: string;
  billingAddress: string;
  vatId: string;
};

/**
 * The raw object handed to validateBankDetails. An empty IBAN keeps the stored one (the form never
 * pre-fills it); without a stored IBAN it stays empty and validation rejects it.
 */
export function mergeBankInput(prev: BankDetails | null, input: BankFormInput): Record<string, string> {
  const typed = input.iban.trim();
  return {
    holder: input.holder,
    iban: typed === "" && prev ? prev.iban : typed,
    bic: input.bic,
    billingName: input.billingName,
    billingAddress: input.billingAddress,
    vatId: input.vatId,
  };
}

/** True only when a previous IBAN existed and differs after normalisation (the first entry is not a change). */
export function ibanChanged(prev: BankDetails | null, next: BankDetails): boolean {
  if (!prev || !prev.iban) return false;
  return normaliseIban(prev.iban) !== normaliseIban(next.iban);
}

/** Last four characters of a normalised IBAN (the only part ever stored or shown in clear). */
export const ibanLast4 = (iban: string): string => normaliseIban(iban).slice(-4);

/** How a partner is named in office alerts and audit rows: company, else "First Last". */
export function partnerDisplayName(p: { company: string | null; firstName: string; lastName: string }): string {
  return p.company?.trim() || `${p.firstName} ${p.lastName}`.trim();
}

const officeDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/Nicosia" }).format(d);

/** Office Telegram notice (HTML parse mode → escaped). Only the last 4 of the IBAN, never other values. */
export function buildBankChangedNotice(i: { name: string; ibanLast4: string; blockedUntil: Date | null }): string {
  const base = `Partner ${escapeHtml(i.name)} changed bank details (IBAN •••• ${escapeHtml(i.ibanLast4.slice(-4))})`;
  return i.blockedUntil ? `${base} — payouts paused until ${escapeHtml(officeDate(i.blockedUntil))}` : base;
}
