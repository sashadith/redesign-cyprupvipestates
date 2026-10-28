import { validateNewLead, type NewLeadInput } from "./newLeadForm";

// "Edit" on the lead cockpit (2026-10-28). Pure and client-safe: the dialog and
// updateLeadDetailsAction share it. The shared fields reuse the "New lead"
// rules; the edit adds the three fields the new-lead form does not have.

export const SALUTATIONS = ["UNKNOWN", "MR", "MS"] as const;
export type Salutation = (typeof SALUTATIONS)[number];

export type LeadEditInput = Omit<NewLeadInput, "ownerId"> & {
  salutation: Salutation;
  nationality: string | null;
  countryOfResidence: string | null;
};

type Result = { ok: true; data: LeadEditInput } | { ok: false; error: string; field?: string };

const EXTRA_KEYS = ["salutation", "nationality", "countryOfResidence"];
const PLACE_MAX = 80;

// currentLanguage: a lead may already carry a language the form no longer
// offers (he); keeping it unchanged must not fail the whole edit.
export function validateLeadEdit(raw: unknown, currentLanguage: string | null): Result {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Invalid entry." };
  const r = { ...(raw as Record<string, unknown>) };
  if ("ownerId" in r) return { ok: false, error: "Unknown field: ownerId", field: "ownerId" };

  const extra: Record<string, unknown> = {};
  for (const k of EXTRA_KEYS) { extra[k] = r[k]; delete r[k]; }
  const keepLanguage = currentLanguage !== null && r.languagePreference === currentLanguage;
  if (keepLanguage) r.languagePreference = null;

  const base = validateNewLead(r);
  if (!base.ok) return base;
  const { ownerId: _ownerId, ...shared } = base.data;

  const sal = extra.salutation ?? "UNKNOWN";
  if (typeof sal !== "string" || !(SALUTATIONS as readonly string[]).includes(sal)) return { ok: false, error: "Pick a salutation from the list.", field: "salutation" };
  const place = (k: string, label: string): string | null | { error: string } => {
    const v = extra[k];
    if (v === undefined || v === null) return null;
    if (typeof v !== "string") return { error: `Enter a valid ${label}.` };
    const t = v.trim();
    if (t.length > PLACE_MAX) return { error: `${label[0].toUpperCase()}${label.slice(1)} is too long (${PLACE_MAX} characters max).` };
    return t || null;
  };
  const nationality = place("nationality", "nationality");
  if (nationality && typeof nationality === "object") return { ok: false, error: nationality.error, field: "nationality" };
  const countryOfResidence = place("countryOfResidence", "country of residence");
  if (countryOfResidence && typeof countryOfResidence === "object") return { ok: false, error: countryOfResidence.error, field: "countryOfResidence" };

  return {
    ok: true,
    data: {
      ...shared,
      languagePreference: keepLanguage ? (currentLanguage as LeadEditInput["languagePreference"]) : shared.languagePreference,
      salutation: sal as Salutation,
      nationality,
      countryOfResidence,
    },
  };
}

export const FIELD_LABEL: Record<keyof LeadEditInput, string> = {
  firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone", salutation: "Salutation",
  languagePreference: "Language", budgetMin: "Budget", budgetMax: "Budget", timeline: "Timeline", financing: "Financing",
  nationality: "Nationality", countryOfResidence: "Lives in", message: "Enquiry", notes: "Internal notes",
};

export type LeadEditBefore = { [K in keyof LeadEditInput]: LeadEditInput[K] | string | null };

const norm = (v: unknown) => (v === "" || v === undefined ? null : v);

// Which fields actually change. lastName is stored as "" when empty.
export function changedFields(before: LeadEditBefore, after: LeadEditInput): (keyof LeadEditInput)[] {
  return (Object.keys(FIELD_LABEL) as (keyof LeadEditInput)[]).filter((k) => norm(before[k]) !== norm(after[k]));
}

// Labels for the timeline line, budget min/max counted once.
export function changeSummary(fields: (keyof LeadEditInput)[]): string {
  return Array.from(new Set(fields.map((f) => FIELD_LABEL[f]))).join(", ");
}
