// Pure mapping from a Meta Lead Ads instant-form answer set to Lead fields —
// no DB, no network, so every rule here is unit-tested directly
// (src/lib/__tests__/metaLeadgenMap.test.ts). Answers are matched by their
// TEXT, never by position: Meta returns each multiple-choice answer as the
// option's value (its label, or a slug of it), and the option order differs
// between the DE and EN forms.
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { LeadPreferredChannel } from "@prisma/client";

export type MetaFieldDatum = { name: string; values?: string[] };

export type BudgetKey = "2-3" | "3-5" | "5+" | "<2";

export const BUDGETS: Record<BudgetKey, { min: number | null; max: number | null; label: string }> = {
  "<2": { min: null, max: 2_000_000, label: "Under €2M" },
  "2-3": { min: 2_000_000, max: 3_000_000, label: "€2–3M" },
  "3-5": { min: 3_000_000, max: 5_000_000, label: "€3–5M" },
  "5+": { min: 5_000_000, max: null, label: "Over €5M" },
};

export const CHANNEL_LABEL: Record<LeadPreferredChannel, string> = { WHATSAPP: "WhatsApp", PHONE: "Phone", EMAIL: "Email" };

// "2_bis_3_millionen_euro" / "€2 to 3 million" / "Über 5 Millionen Euro" → one
// comparable shape: lower-case, underscores and dashes as spaces, no currency
// or punctuation, umlauts kept (handled in the patterns).
export function normalizeAnswer(v: string): string {
  return v
    .toLowerCase()
    .replace(/[_\-–—]/g, " ")
    .replace(/[€$£.,:;!?()"'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchBudget(raw: string): BudgetKey | null {
  const v = normalizeAnswer(raw);
  // (^|\s), not \b: JS's \b is ASCII-only, so it never matches before "ü".
  if (/(^|\s)(unter|under|less than|below)\s*2\b/.test(v)) return "<2";
  if (/(^|\s)(über|uber|ueber|over|more than|above)\s*5\b/.test(v)) return "5+";
  if (/\b2\s*(bis|to)?\s*3\b/.test(v)) return "2-3";
  if (/\b3\s*(bis|to)?\s*5\b/.test(v)) return "3-5";
  return null;
}

export function matchChannel(raw: string): LeadPreferredChannel | null {
  const v = normalizeAnswer(raw);
  if (/whats\s*app/.test(v)) return "WHATSAPP";
  if (/\b(e\s?mail)\b/.test(v)) return "EMAIL";
  if (/\b(telefon|phone|call|anruf)/.test(v)) return "PHONE";
  return null;
}

// Contact-field keys are NOT fixed: Meta derives them from the question label
// in the form's language. Seen live 2026-10-12: EN "email_address", DE
// "e-mail-adresse" / "vollständiger_name" — never the documented "email" /
// "full_name". So keys are compared normalised (lower-case, accents and
// punctuation stripped), and email/phone fall back to recognising the VALUE.
export type ContactRole = "email" | "fullName" | "firstName" | "lastName" | "phone";
const ROLE_KEYS: Record<ContactRole, string[]> = {
  email: ["email", "emailaddress", "emailadresse", "mail", "eaddress"],
  fullName: ["fullname", "vollstandigername", "name", "vollername", "nameundvorname", "vornameundnachname", "imieinazwisko", "imie", "fio"],
  firstName: ["firstname", "vorname", "givenname"],
  lastName: ["lastname", "nachname", "surname", "familienname", "nazwisko"],
  phone: ["phonenumber", "phone", "telefon", "telefonnummer", "handynummer", "mobilnummer", "mobile", "mobilephone", "numertelefonu"],
};
export const normalizeKey = (k: string) =>
  k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s().-]{7,}$/;

/** Which contact field each answer is (by key, then by value shape); custom
 *  questions get no role. */
export function classifyContactFields(fd: MetaFieldDatum[]): Map<string, ContactRole> {
  const roles = new Map<string, ContactRole>();
  const taken = new Set<ContactRole>();
  for (const f of fd) {
    const k = normalizeKey(f.name);
    for (const role of Object.keys(ROLE_KEYS) as ContactRole[]) {
      if (!taken.has(role) && ROLE_KEYS[role].includes(k)) {
        roles.set(f.name, role);
        taken.add(role);
        break;
      }
    }
  }
  for (const f of fd) {
    if (roles.has(f.name)) continue;
    const v = (f.values?.[0] ?? "").trim();
    if (!taken.has("email") && EMAIL_RE.test(v)) { roles.set(f.name, "email"); taken.add("email"); }
    else if (!taken.has("phone") && PHONE_RE.test(v)) { roles.set(f.name, "phone"); taken.add("phone"); }
  }
  return roles;
}

function valueFor(fd: MetaFieldDatum[], roles: Map<string, ContactRole>, role: ContactRole): string | null {
  const f = fd.find((x) => roles.get(x.name) === role);
  const v = f?.values?.[0];
  return v && v.trim() ? v.trim() : null;
}

/** "Richard Benjamin" → Richard / Benjamin; "Madonna" → Madonna / "" (no
 *  trailing space anywhere); "Anna Maria von Berg" → Anna / Maria von Berg. */
export function splitFullName(full: string | null): { firstName: string; lastName: string } {
  const parts = (full ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export type PhoneCheck = { e164: string | null; country: string | null; placeholderReason: string | null };

/** Country only when libphonenumber says the number is valid AND resolves it
 *  to exactly one country (+1 without an area-code match, for instance, stays
 *  empty). Placeholder numbers are kept, only flagged. */
export function checkPhone(raw: string | null): PhoneCheck {
  if (!raw) return { e164: null, country: null, placeholderReason: null };
  const digits = raw.replace(/\D/g, "");
  const parsed = parsePhoneNumberFromString(raw.startsWith("+") ? raw : `+${digits}`);
  const valid = !!parsed && parsed.isValid();
  let placeholderReason: string | null = null;
  const national = parsed?.nationalNumber ?? digits;
  if (/^\d0+$/.test(national) || /0{6,}/.test(digits)) placeholderReason = "a digit followed by a run of zeros";
  else if (/^(\d)\1{6,}$/.test(national)) placeholderReason = "one repeated digit";
  else if (!valid) placeholderReason = "not a valid number for its country code (libphonenumber)";
  return {
    e164: parsed ? parsed.number : raw.trim(),
    country: valid && parsed?.country ? parsed.country : null,
    placeholderReason,
  };
}

/** DE forms → de, EN forms → en. The form name is the source of truth
 *  ("CVE PC Briefing DE v3"); Meta's own form locale is the fallback. */
export function formLanguage(formName: string | null, formLocale?: string | null): "de" | "en" | null {
  const n = ` ${(formName ?? "").toUpperCase()} `;
  if (/\sDE(\s|$)/.test(n)) return "de";
  if (/\sEN(\s|$)/.test(n)) return "en";
  const l = (formLocale ?? "").toLowerCase();
  if (l.startsWith("de")) return "de";
  if (l.startsWith("en")) return "en";
  return null;
}

// The notification's "(UK)" / "(ZA)" tag. The campaign name carries the
// targeted market ("CVE Private Collection — ZA Leads (Instant Form)"); the
// form language does not — the one EN form runs in the UK, ZA, AE and LB
// campaigns, which all used to be announced as "(UK)" (fixed 2026-10-25).
// Language is only a fallback for DE, the one form that is DACH-only.
const REGION_BY_CAMPAIGN_CODE: Record<string, string> = { DE: "DACH" };

export function leadRegion(campaignName: string | null, language: "de" | "en" | null): string | null {
  const code = /\b([A-Z]{2,4}) Leads\b/.exec(campaignName ?? "")?.[1];
  if (code) return REGION_BY_CAMPAIGN_CODE[code] ?? code;
  return language === "de" ? "DACH" : null;
}

export type MappedLead = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  countryOfResidence: string | null;
  languagePreference: "de" | "en" | null;
  budget: BudgetKey | null;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredChannel: LeadPreferredChannel | null;
  placeholderReason: string | null;
  // Custom answers that matched neither question — kept verbatim and flagged
  // in the timeline instead of guessed.
  unmatched: { name: string; value: string }[];
  answers: { name: string; value: string }[];
};

export function mapFieldData(fd: MetaFieldDatum[], formName: string | null, formLocale?: string | null): MappedLead {
  const roles = classifyContactFields(fd);
  const first = (role: ContactRole) => valueFor(fd, roles, role);
  const fullName = first("fullName") ?? [first("firstName"), first("lastName")].filter(Boolean).join(" ");
  const { firstName, lastName } = splitFullName(fullName);
  const phone = checkPhone(first("phone"));
  let budget: BudgetKey | null = null;
  let preferredChannel: LeadPreferredChannel | null = null;
  const unmatched: { name: string; value: string }[] = [];
  const answers = fd.map((f) => ({ name: f.name, value: (f.values ?? []).join(", ") }));
  for (const f of fd) {
    if (roles.has(f.name)) continue;
    const value = (f.values ?? []).join(", ");
    const b = matchBudget(value);
    const c = b ? null : matchChannel(value);
    if (b && !budget) budget = b;
    else if (c && !preferredChannel) preferredChannel = c;
    else unmatched.push({ name: f.name, value });
  }
  return {
    firstName,
    lastName,
    email: first("email"),
    phone: phone.e164,
    countryOfResidence: phone.country,
    languagePreference: formLanguage(formName, formLocale),
    budget,
    budgetMin: budget ? BUDGETS[budget].min : null,
    budgetMax: budget ? BUDGETS[budget].max : null,
    preferredChannel,
    placeholderReason: phone.placeholderReason,
    unmatched,
    answers,
  };
}
