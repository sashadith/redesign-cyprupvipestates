// Phone check shared by every public lead form and /api/leads (2026-11-01).
// A number counts only with its country code: "+357 99 123456" or "00357…".
// Forms use the strict test (isValidLeadPhone: the number fits the country's
// numbering plan) so the visitor can correct it on the spot. The server uses
// the looser isPossibleLeadPhone (right length for the country): a real number
// in a range the metadata does not know yet must never be thrown away there.
import { parsePhoneNumberFromString, type PhoneNumber } from "libphonenumber-js";

function parseIntl(raw: unknown): PhoneNumber | undefined {
  let s = String(raw ?? "").trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!/^\+\d{6,17}$/.test(s)) return undefined;
  return parsePhoneNumberFromString(s);
}

export function isValidLeadPhone(raw: unknown): boolean {
  return !!parseIntl(raw)?.isValid();
}

export function isPossibleLeadPhone(raw: unknown): boolean {
  return !!parseIntl(raw)?.isPossible();
}

/** E.164 ("+35799123456") for storage, or null when there is no usable number. */
export function e164LeadPhone(raw: unknown): string | null {
  const p = parseIntl(raw);
  return p && p.isPossible() ? p.number : null;
}
