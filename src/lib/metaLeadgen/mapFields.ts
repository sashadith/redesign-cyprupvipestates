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

const STANDARD_FIELDS = new Set(["email", "full_name", "first_name", "last_name", "phone_number"]);

function first(fd: MetaFieldDatum[], name: string): string | null {
  const v = fd.find((f) => f.name === name)?.values?.[0];
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

export const REGION_BY_LANGUAGE: Record<"de" | "en", string> = { de: "DACH", en: "UK" };

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
  const fullName = first(fd, "full_name") ?? [first(fd, "first_name"), first(fd, "last_name")].filter(Boolean).join(" ");
  const { firstName, lastName } = splitFullName(fullName);
  const phone = checkPhone(first(fd, "phone_number"));
  let budget: BudgetKey | null = null;
  let preferredChannel: LeadPreferredChannel | null = null;
  const unmatched: { name: string; value: string }[] = [];
  const answers = fd.map((f) => ({ name: f.name, value: (f.values ?? []).join(", ") }));
  for (const f of fd) {
    if (STANDARD_FIELDS.has(f.name)) continue;
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
    email: first(fd, "email"),
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
