import { zonedInputToUtc } from "@/lib/tz";

// Form parsing for the partner pipeline's server actions (partner pipeline, 2026-11-05).
// Pure: no prisma. Dates are typed as Cyprus wall time (the portal shows Europe/Nicosia);
// the lead's own local time is shown next to them, never typed.

export const PORTAL_TZ = "Europe/Nicosia";

type Get = (name: string) => FormDataEntryValue | null;

const text = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v.trim() : "");

/** "YYYY-MM-DDTHH:mm" in Cyprus time → instant; blank or malformed → null. */
export function portalDateTime(v: FormDataEntryValue | null): Date | null {
  const s = text(v);
  return s ? zonedInputToUtc(s, PORTAL_TZ) : null;
}

/** Whole euros as typed ("350 000", "350.000", "350,000") → number; anything else → NaN (the move refuses it). */
export function wholeEuros(v: FormDataEntryValue | null): number {
  const s = text(v).replace(/[\s.,'’ ]/g, "");
  return /^\d{1,12}$/.test(s) ? Number(s) : Number.NaN;
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
      const digits = s.replace(/[\s.,'’ ]/g, "");
      raw[k] = !s ? null : /^\d{1,15}$/.test(digits) ? Number(digits) : s;
    } else if (k === "salutation") {
      raw[k] = s || "UNKNOWN";
    } else {
      raw[k] = s || null;
    }
  }
  return raw;
}
