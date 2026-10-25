import { LAUNCH_GATED_LOCALES, LOCALES, type Locale } from "@/lib/locale";

// Validation for "New lead" in the new CRM (CRM v2 Phase 2c, 2026-10-18). Pure:
// the form and createLeadAction share it. Mirrors the shape createLeadRecord takes.

export const TIMELINES = ["IMMEDIATE", "THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR", "TWO_YEARS", "JUST_LOOKING"] as const;
export const FINANCINGS = ["CASH", "MORTGAGE", "UNDECIDED"] as const;
// No launch-gated locale (he): nobody on the team verifies Hebrew.
export const NEW_LEAD_LANGUAGES = LOCALES.filter((l) => !LAUNCH_GATED_LOCALES.includes(l));

export type NewLeadInput = {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  languagePreference: Locale | null;
  budgetMin: number | null;
  budgetMax: number | null;
  timeline: (typeof TIMELINES)[number] | null;
  financing: (typeof FINANCINGS)[number] | null;
  message: string | null;
  notes: string | null;
  ownerId: string | null;
};

type Result = { ok: true; data: NewLeadInput } | { ok: false; error: string; field?: string };

const KEYS = ["firstName", "lastName", "email", "phone", "languagePreference", "budgetMin", "budgetMax", "timeline", "financing", "message", "notes", "ownerId"];
export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
// 6 to 20 digits, only the usual separators. Shared with the Claude intake parser.
export const isValidPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "").length;
  return digits >= 6 && digits <= 20 && /^[+\d\s().\-/]+$/.test(phone);
};
const fail = (error: string, field?: string): Result => ({ ok: false, error, field });

export function validateNewLead(raw: unknown): Result {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("Invalid entry.");
  const r = raw as Record<string, unknown>;
  const unknown = Object.keys(r).find((k) => !KEYS.includes(k));
  if (unknown) return fail(`Unknown field: ${unknown}`, unknown);

  // Blank/absent -> null; anything but a string is an error.
  const text = (k: string): string | null | undefined => {
    const v = r[k];
    if (v === undefined || v === null) return null;
    if (typeof v !== "string") return undefined;
    return v.trim() || null;
  };
  const bad = (k: string, msg: string) => fail(msg, k);

  const firstName = text("firstName");
  if (firstName === undefined) return bad("firstName", "Enter a valid first name.");
  if (!firstName) return bad("firstName", "First name is required.");
  if (firstName.length > 80) return bad("firstName", "First name is too long (80 characters max).");
  const lastName = text("lastName");
  if (lastName === undefined) return bad("lastName", "Enter a valid last name.");
  if (lastName && lastName.length > 80) return bad("lastName", "Last name is too long (80 characters max).");

  const email = text("email");
  if (email === undefined) return bad("email", "Enter a valid email address.");
  if (email && (email.length > 200 || !EMAIL_RE.test(email))) return bad("email", "Enter a valid email address.");
  const phone = text("phone");
  if (phone === undefined) return bad("phone", "Enter a valid phone number.");
  if (phone && !isValidPhone(phone)) return bad("phone", "Phone needs 6 to 20 digits.");
  if (!email && !phone) return bad("email", "Add an email or a phone number");

  const lang = text("languagePreference");
  if (lang === undefined || (lang && !(NEW_LEAD_LANGUAGES as readonly string[]).includes(lang))) return bad("languagePreference", "Pick a language from the list.");
  const timeline = text("timeline");
  if (timeline === undefined || (timeline && !(TIMELINES as readonly string[]).includes(timeline))) return bad("timeline", "Pick a timeline from the list.");
  const financing = text("financing");
  if (financing === undefined || (financing && !(FINANCINGS as readonly string[]).includes(financing))) return bad("financing", "Pick a financing option from the list.");

  const money = (k: string): number | null | undefined => {
    const v = r[k];
    if (v === undefined || v === null || v === "") return null;
    return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : undefined;
  };
  const budgetMin = money("budgetMin");
  if (budgetMin === undefined) return bad("budgetMin", "Budget must be a whole number, 0 or more.");
  const budgetMax = money("budgetMax");
  if (budgetMax === undefined) return bad("budgetMax", "Budget must be a whole number, 0 or more.");
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) return bad("budgetMax", "Maximum budget cannot be below the minimum.");

  const message = text("message");
  if (message === undefined || (message && message.length > 4000)) return bad("message", "Message is too long (4000 characters max).");
  const notes = text("notes");
  if (notes === undefined || (notes && notes.length > 4000)) return bad("notes", "Notes are too long (4000 characters max).");
  const ownerId = text("ownerId");
  if (ownerId === undefined) return bad("ownerId", "Invalid owner.");

  return {
    ok: true,
    data: {
      firstName, lastName, email, phone,
      languagePreference: lang as NewLeadInput["languagePreference"],
      budgetMin, budgetMax,
      timeline: timeline as NewLeadInput["timeline"],
      financing: financing as NewLeadInput["financing"],
      message, notes, ownerId,
    },
  };
}

// Who owns a new lead. Non-managers always own what they create. A manager may
// leave it unassigned (inbox), take it, or pick someone else: then the lead is
// created unassigned and handed over with assignLead, so the "Assigned to" row
// and the owner's notifications happen exactly as from the inbox.
// requestedOwnerId must already be checked as an active team member.
export function decideOwner({ isManager, creatorId, requestedOwnerId }: { isManager: boolean; creatorId: string; requestedOwnerId: string | null }): { createWith: string | null; assignTo: string | null } {
  if (!isManager) return { createWith: creatorId, assignTo: null };
  if (!requestedOwnerId) return { createWith: null, assignTo: null };
  if (requestedOwnerId === creatorId) return { createWith: creatorId, assignTo: null };
  return { createWith: null, assignTo: requestedOwnerId };
}
