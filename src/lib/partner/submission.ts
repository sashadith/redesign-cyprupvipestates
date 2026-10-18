// Strict validator for partner client submissions. Pure; codes are dotted dictionary keys.
import { PARTNER_LOCALES, type PartnerLocale } from "./i18n";

export const CONTACT_MODES = ["DIRECT", "VIA_PARTNER", "VIA_PARTNER_REP", "VIA_CLIENT_REP"] as const;
export type ContactMode = (typeof CONTACT_MODES)[number];
export const SUBMISSION_MODES = ["HANDOVER", "FIX"] as const;
export type SubmissionMode = (typeof SUBMISSION_MODES)[number];

export interface SubmissionInput {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  language: PartnerLocale | null;
  budgetMin: number | null;
  budgetMax: number | null;
  mode: SubmissionMode;
  projectIds: string[];
  projectsText: string | null;
  contactMode: ContactMode;
  repName: string | null;
  repPhone: string | null;
  comment: string | null;
  consent: true;
}

export type SubmissionResult = { ok: true; data: SubmissionInput } | { ok: false; field: string; code: string };

export const SUBMISSION_ERROR_CODES = [
  "err.invalid", "err.unknownField", "err.firstName", "err.lastName", "err.email", "err.phone",
  "err.contactRequired", "err.language", "err.budget", "err.mode", "err.projects", "err.fixOneProject",
  "err.projectsText", "err.contactMode", "err.rep", "err.comment", "err.consent",
] as const;

const ALLOWED = new Set([
  "firstName", "lastName", "email", "phone", "language", "budgetMin", "budgetMax", "mode", "projectIds",
  "projectsText", "contactMode", "repName", "repPhone", "comment", "consent",
]);
const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const MAX_BUDGET = 100_000_000;

const fail = (field: string, code: string): SubmissionResult => ({ ok: false, field, code });
const absent = (v: unknown) => v === undefined || v === null || v === "";
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const badText = (s: string) => CONTROL_RE.test(s);
/** Single-line fields additionally reject line breaks. */
const badLine = (s: string) => badText(s) || /[\r\n]/.test(s);

/** Returns normalised phone (+digits) or undefined when invalid. */
function normPhone(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > 40 || /[\r\n]/.test(v)) return undefined;
  const raw = v.trim();
  if (!/^\+?[\d\s().-]+$/.test(raw)) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 20) return undefined;
  return (raw.startsWith("+") ? "+" : "") + digits;
}

export function validateSubmission(raw: unknown): SubmissionResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("_", "err.invalid");
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!ALLOWED.has(k)) return fail(k, "err.unknownField");

  const firstName = str(r.firstName);
  if (!firstName || firstName.length > 80 || badLine(firstName)) return fail("firstName", "err.firstName");
  let lastName: string | null = null;
  if (!absent(r.lastName)) {
    const l = str(r.lastName);
    if (typeof r.lastName !== "string" || !l || l.length > 80 || badLine(l)) return fail("lastName", "err.lastName");
    lastName = l;
  }

  let email: string | null = null;
  if (!absent(r.email)) {
    const e = str(r.email).toLowerCase();
    if (typeof r.email !== "string" || e.length > 254 || !EMAIL_RE.test(e)) return fail("email", "err.email");
    email = e;
  }
  let phone: string | null = null;
  if (!absent(r.phone)) {
    const p = normPhone(r.phone);
    if (!p) return fail("phone", "err.phone");
    phone = p;
  }
  if (!email && !phone) return fail("email", "err.contactRequired");

  let language: PartnerLocale | null = null;
  if (!absent(r.language)) {
    const l = str(r.language);
    if (!(PARTNER_LOCALES as readonly string[]).includes(l)) return fail("language", "err.language");
    language = l as PartnerLocale;
  }

  const money = (v: unknown): number | null | undefined => {
    if (absent(v)) return null;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX_BUDGET) return undefined;
    return v;
  };
  const budgetMin = money(r.budgetMin);
  if (budgetMin === undefined) return fail("budgetMin", "err.budget");
  const budgetMax = money(r.budgetMax);
  if (budgetMax === undefined) return fail("budgetMax", "err.budget");
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) return fail("budgetMax", "err.budget");

  const mode = str(r.mode);
  if (!(SUBMISSION_MODES as readonly string[]).includes(mode)) return fail("mode", "err.mode");

  let projectIds: string[] = [];
  if (!absent(r.projectIds)) {
    if (!Array.isArray(r.projectIds) || r.projectIds.length > 10) return fail("projectIds", "err.projects");
    for (const id of r.projectIds) if (typeof id !== "string" || !UUID_RE.test(id)) return fail("projectIds", "err.projects");
    projectIds = (r.projectIds as string[]).map((s) => s.toLowerCase());
    if (new Set(projectIds).size !== projectIds.length) return fail("projectIds", "err.projects");
  }
  if (mode === "FIX" && projectIds.length !== 1) return fail("projectIds", "err.fixOneProject");

  let projectsText: string | null = null;
  if (!absent(r.projectsText)) {
    const t = str(r.projectsText);
    if (typeof r.projectsText !== "string" || t.length > 300 || badLine(t)) return fail("projectsText", "err.projectsText");
    projectsText = t || null;
  }

  const contactMode = str(r.contactMode);
  if (!(CONTACT_MODES as readonly string[]).includes(contactMode)) return fail("contactMode", "err.contactMode");
  let repName: string | null = null;
  let repPhone: string | null = null;
  if (contactMode === "VIA_PARTNER_REP" || contactMode === "VIA_CLIENT_REP") {
    const n = str(r.repName);
    if (!n || n.length > 80 || badLine(n)) return fail("repName", "err.rep");
    const p = normPhone(r.repPhone);
    if (!p) return fail("repPhone", "err.rep");
    repName = n;
    repPhone = p;
  }

  let comment: string | null = null;
  if (!absent(r.comment)) {
    const c = typeof r.comment === "string" ? r.comment.trim() : "";
    if (typeof r.comment !== "string" || c.length > 2000 || badText(c)) return fail("comment", "err.comment");
    comment = c || null;
  }

  if (r.consent !== true) return fail("consent", "err.consent");

  return {
    ok: true,
    data: {
      firstName, lastName, email, phone, language, budgetMin, budgetMax, mode: mode as SubmissionMode,
      projectIds, projectsText, contactMode: contactMode as ContactMode, repName, repPhone, comment, consent: true,
    },
  };
}
