import { zonedInputToUtc } from "@/lib/tz";
import { CRM_TZ } from "@/lib/crm/today";

// Form parsing for the partner pipeline's server actions (partner pipeline, 2026-11-05).
// Pure: no prisma. Dates are typed as Cyprus wall time (the portal shows Europe/Nicosia);
// the lead's own local time is shown next to them, never typed.

export const PORTAL_TZ = CRM_TZ;

type Get = (name: string) => FormDataEntryValue | null;

const text = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v.trim() : "");

/** "YYYY-MM-DDTHH:mm" in Cyprus time → instant; blank or malformed → null. */
export function portalDateTime(v: FormDataEntryValue | null): Date | null {
  const s = text(v);
  return s ? zonedInputToUtc(s, PORTAL_TZ) : null;
}

// Plain digits, or digits grouped in threes by one kind of separator (space, no-break space,
// ".", ",", apostrophe), with an optional euro sign. "350000.00", "1.5", "1,5" are refused, never guessed.
const GROUPED = /^(?:\d+|\d{1,3}([ \u00a0.,'\u2019])\d{3}(?:\1\d{3})*)$/;

/** Whole euros as typed ("350000", "350 000", "1.250.000", "350,000 €") → number, else null. */
export function parseWholeEuros(raw: string): number | null {
  const s = raw.trim().replace(/\s*\u20ac$/, "").replace(/^\u20ac\s*/, "");
  if (!GROUPED.test(s)) return null;
  const n = Number(s.replace(/\D/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

/** The deal price field → whole euros, or NaN, which the move refuses as "Enter a valid price in whole euros." */
export function wholeEuros(v: FormDataEntryValue | null): number {
  return parseWholeEuros(text(v)) ?? Number.NaN;
}

const DAY_MS = 86_400_000;
export const PARTNER_DATE_MAX_DAYS = 730;

/** A follow-up or viewing date the partner may set: not more than a day back (earlier today is fine), at most two years ahead. */
export function inPartnerDateWindow(at: Date, now: Date): boolean {
  return at.getTime() >= now.getTime() - DAY_MS && at.getTime() <= now.getTime() + PARTNER_DATE_MAX_DAYS * DAY_MS;
}

// The client fields the partner may edit, as editPartnerClient takes them. Notes are
// never part of it (staff's). A budget that is not a whole number is passed through
// as typed, so validateLeadEdit refuses it with its own message.
export const EDIT_FIELDS = [
  "salutation", "firstName", "lastName", "email", "phone", "languagePreference", "budgetMin", "budgetMax",
  "timeline", "financing", "nationality", "countryOfResidence", "message",
] as const;

export function editRawFromForm(get: Get): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const k of EDIT_FIELDS) {
    const s = text(get(k));
    if (k === "budgetMin" || k === "budgetMax") {
      raw[k] = !s ? null : parseWholeEuros(s) ?? s;
    } else if (k === "salutation") {
      raw[k] = s || "UNKNOWN";
    } else {
      raw[k] = s || null;
    }
  }
  return raw;
}
