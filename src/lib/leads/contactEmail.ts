// Email check shared by every public lead form and /api/leads (2026-11-01).
// No imports on purpose: the homepage form loads it on first paint, and the
// phone check (contactPhone.ts) pulls in libphonenumber, which that form loads late.

const MAX = 254;
// local@label.label.tld — ASCII only (an umlaut domain arrives as xn-- punycode),
// a letters-only TLD of 2+ characters, no empty labels, no dot at either end of the local part.
const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;

export const normalizeLeadEmail = (raw: unknown): string => String(raw ?? "").trim().toLowerCase();

export function isValidLeadEmail(raw: unknown): boolean {
  const e = normalizeLeadEmail(raw);
  return e.length > 0 && e.length <= MAX && EMAIL_RE.test(e);
}

// Visitor-facing messages. Hebrew returns null on purpose (no new Hebrew copy
// without a native check): the form falls back to its own existing message.
export function phoneInvalidText(lang: string): string | null {
  switch (lang) {
    case "de": return "Bitte geben Sie eine vollständige Telefonnummer mit Ländervorwahl ein, z. B. +49 171 2345678.";
    case "pl": return "Podaj pełny numer telefonu z numerem kierunkowym kraju, np. +48 512 345 678.";
    case "ru": return "Укажите полный номер телефона с кодом страны, например +7 912 345 67 89.";
    case "he": return null;
    default: return "Please enter a complete phone number with the country code, e.g. +44 7911 123456.";
  }
}

export function emailInvalidText(lang: string): string | null {
  switch (lang) {
    case "de": return "Bitte geben Sie eine gültige E-Mail-Adresse ein, z. B. name@beispiel.de.";
    case "pl": return "Podaj prawidłowy adres e-mail, np. imie@przyklad.pl.";
    case "ru": return "Укажите корректный адрес электронной почты, например name@example.com.";
    case "he": return null;
    default: return "Please enter a valid email address, e.g. name@example.com.";
  }
}
