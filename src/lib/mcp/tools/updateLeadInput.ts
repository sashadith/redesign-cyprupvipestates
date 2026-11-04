import { z } from "zod";
import { LEAD_STATUSES, LOST_REASONS } from "@/lib/crm/leadStatus";
import { EMAIL_RE } from "@/lib/crm/newLeadForm";
import { LOCALES } from "@/lib/locale";
import { isTimeZone } from "@/lib/crm/leadLocalTime";

// Input contract of crm_update_lead, kept prisma-free so the pure test can import it.
//
// passthrough, not the default strip: a field the tool does not know used to vanish silently and
// the call answered "Nothing to change" (an email change, 2026-11-04). unknownFields() turns any
// such key into a validation error that names the fields the tool does take.

const isoOrNull = z.string().datetime({ offset: true }).nullable().optional().describe("ISO 8601, with or without a UTC offset");

export const UPDATABLE_BUCKETS = ["leads", "partner"] as const;

export const UpdateLeadInput = z
  .object({
    leadId: z.string().uuid(),
    status: z.enum([...LEAD_STATUSES]).optional(),
    lostReason: z.enum([...LOST_REASONS]).optional().describe("Why the lead was lost; only with status LOST"),
    viewingScheduledAt: isoOrNull.describe("Required when status becomes VIEWING_SCHEDULED; the appointment date/time"),
    nextFollowUpAt: isoOrNull,
    hot: z.boolean().optional(),
    preferredChannel: z.enum(["EMAIL", "WHATSAPP", "PHONE"]).nullable().optional(),
    languagePreference: z.enum(LOCALES).nullable().optional(),
    salutation: z.enum(["UNKNOWN", "MR", "MS"]).optional(),
    budgetMin: z.number().int().nonnegative().nullable().optional(),
    budgetMax: z.number().int().nonnegative().nullable().optional(),
    timeline: z.enum(["IMMEDIATE", "THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR", "TWO_YEARS", "JUST_LOOKING"]).nullable().optional(),
    financing: z.enum(["CASH", "MORTGAGE", "UNDECIDED"]).nullable().optional(),
    notes: z.string().max(4000).nullable().optional().describe("Replaces the admin notes field"),
    email: z
      .string().trim().max(200)
      .refine((v) => v === "" || EMAIL_RE.test(v), "Not a valid email address.")
      .nullable().optional()
      .describe("The lead's email address; null or \"\" removes it (only if a phone number stays on file)"),
    assignedTo: z.string().trim().min(1).max(120).nullable().optional()
      .describe("Owner: an active employee's full name (e.g. \"Sascha Dith\") or user id; null removes the owner. Admins only"),
    bucket: z.enum(UPDATABLE_BUCKETS).optional().describe("Move between the Leads and Partner buckets"),
    timeZone: z.string().trim().refine(isTimeZone, "Not an IANA time zone (e.g. Europe/London, America/Toronto).").nullable().optional()
      .describe("The lead's IANA time zone, for a country with several zones (\"zone unclear\") or to correct the derived one; null = derive from country/phone again"),
  })
  .passthrough();

export type UpdateLeadInputType = z.infer<typeof UpdateLeadInput>;

const FIELDS = Object.keys(UpdateLeadInput.shape);
const KNOWN = new Set(FIELDS);

/** Keys the caller sent that the tool does not support, sorted. */
export function unknownFields(input: Record<string, unknown>): string[] {
  return Object.keys(input).filter((k) => !KNOWN.has(k)).sort();
}

export function unknownFieldsMessage(keys: string[]): string {
  const allowed = FIELDS.filter((k) => k !== "leadId").join(", ");
  return `crm_update_lead cannot change ${keys.join(", ")}. Supported fields: ${allowed}.`;
}

/** "" and null both mean "remove the address"; anything else is stored trimmed, as typed (like the cockpit's Edit). */
export function normalizedEmail(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  return (v ?? "").trim() || null;
}
