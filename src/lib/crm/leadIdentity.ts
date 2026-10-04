// Pure helpers for "is this the same person" and "is this the lead you mean"
// — shared by the MCP create/delete tools and their tests. Email identity
// follows the inbound poller's Gmail-aware canonicalisation; phone identity
// compares digits only, tolerating a missing/extra country code by matching
// on the last PHONE_SUFFIX_DIGITS digits when both sides are long enough.
import { canonicalizeEmail } from "@/lib/emailInbound/matchLead";

export const PHONE_SUFFIX_DIGITS = 8;
export const MIN_PHONE_DIGITS = 6;

export const phoneDigits = (s: string | null | undefined): string => (s ?? "").replace(/\D/g, "");

export function emailKey(e: string | null | undefined): string | null {
  const k = canonicalizeEmail(e);
  return k ? k : null;
}

/** Same number in different formatting or with/without a country code. */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  if (da.length < MIN_PHONE_DIGITS || db.length < MIN_PHONE_DIGITS) return false;
  if (da === db) return true;
  if (da.length >= PHONE_SUFFIX_DIGITS && db.length >= PHONE_SUFFIX_DIGITS) {
    return da.slice(-PHONE_SUFFIX_DIGITS) === db.slice(-PHONE_SUFFIX_DIGITS);
  }
  return false;
}

export function fullName(first: string | null | undefined, last: string | null | undefined): string {
  return `${first ?? ""} ${last ?? ""}`.replace(/\s+/g, " ").trim();
}

/** Case- and whitespace-insensitive comparison of what the operator typed
 *  against the stored name — the delete tool's "you mean THIS lead" check. */
export function nameMatches(confirm: string, first: string | null | undefined, last: string | null | undefined): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const c = norm(confirm);
  return c.length > 0 && c === norm(fullName(first, last));
}
