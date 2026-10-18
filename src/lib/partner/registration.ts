import { PartnerType } from "@prisma/client";
import { passwordProblem } from "./password";

import { PARTNER_LOCALES, type PartnerLocale } from "./i18n";

export const PARTNER_LANGUAGES = PARTNER_LOCALES;
export type PartnerLanguage = PartnerLocale;

export interface RegistrationInput {
  firstName: string;
  lastName: string;
  company: string | null;
  country: string;
  phone: string;
  email: string;
  language: PartnerLanguage;
  type: PartnerType;
  password: string;
}

export type RegistrationResult =
  | { ok: true; data: RegistrationInput }
  | { ok: false; field: string; code: string };

/** Every `code` validateRegistration can return (dotted keys into the partner dictionary). */
export const REGISTRATION_ERROR_CODES = [
  "err.invalid", "err.unknownField", "err.firstName", "err.lastName", "err.company",
  "err.country", "err.phone", "err.email", "err.language", "err.type",
  "err.passwordShort", "err.passwordLong", "err.passwordDigits", "err.agreement",
] as const;

const ALLOWED = new Set([
  "firstName", "lastName", "company", "country", "phone", "email", "language", "type", "password", "acceptAgreement",
]);
const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const HEBREW_RE = /[֐-׿]/;
const TYPES = Object.values(PartnerType) as string[];

const fail = (field: string, code: string): RegistrationResult => ({ ok: false, field, code });
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const badText = (s: string) => CONTROL_RE.test(s) || HEBREW_RE.test(s);

export function validateRegistration(raw: unknown): RegistrationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("_", "err.invalid");
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!ALLOWED.has(k)) return fail(k, "err.unknownField");

  const firstName = str(r.firstName);
  if (!firstName || firstName.length > 80 || badText(firstName)) return fail("firstName", "err.firstName");
  const lastName = str(r.lastName);
  if (!lastName || lastName.length > 80 || badText(lastName)) return fail("lastName", "err.lastName");

  let company: string | null = null;
  if (r.company !== undefined && r.company !== null && r.company !== "") {
    const c = str(r.company);
    if (typeof r.company !== "string" || c.length > 120 || badText(c)) return fail("company", "err.company");
    company = c || null;
  }

  const country = str(r.country);
  if (!/^[A-Z]{2}$/.test(country)) return fail("country", "err.country");

  if (typeof r.phone === "string" && r.phone.length > 40) return fail("phone", "err.phone");
  const phoneRaw = str(r.phone);
  if (!/^\+?[\d\s().-]+$/.test(phoneRaw)) return fail("phone", "err.phone");
  const digits = phoneRaw.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 20) return fail("phone", "err.phone");
  const phone = (phoneRaw.startsWith("+") ? "+" : "") + digits;

  const email = str(r.email).toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return fail("email", "err.email");

  const language = str(r.language);
  if (!(PARTNER_LANGUAGES as readonly string[]).includes(language)) return fail("language", "err.language");

  const type = str(r.type);
  if (!TYPES.includes(type)) return fail("type", "err.type");

  const password = typeof r.password === "string" ? r.password : "";
  const pp = passwordProblem(password);
  if (pp) {
    return fail("password", pp === "too_short" ? "err.passwordShort" : pp === "too_long" ? "err.passwordLong" : "err.passwordDigits");
  }

  if (r.acceptAgreement !== true) return fail("acceptAgreement", "err.agreement");

  return {
    ok: true,
    data: {
      firstName, lastName, company, country, phone, email,
      language: language as PartnerLanguage, type: type as PartnerType, password,
    },
  };
}
