import { countryOf, countryOfPhone, internationalDigits, type CountryInfo } from "./countryInfo";

// Soft warnings about a lead's data (2026-11-04), computed on every read rather than stored, so they
// follow edits to the lead. Shown in the cockpit, in the new-lead Telegram and in the MCP lead rows.
// Pure and import-free apart from countryInfo (the cockpit is server-rendered, but keep it light).

/** Lead fields to write with an email edit: a changed address drops the bounce mark of the old one. */
export function emailEditData(before: string | null, after: string | null): { emailInvalidAt?: null; emailInvalidReason?: null } {
  const norm = (e: string | null) => (e ?? "").trim().toLowerCase();
  return norm(before) === norm(after) ? {} : { emailInvalidAt: null, emailInvalidReason: null };
}

export type HintLead = {
  source: string;
  countryOfResidence: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  emailInvalidAt?: Date | null;
  emailInvalidReason?: string | null;
};

/* Meta lead forms ask for a budget in euros, but a buyer outside the euro area may have answered in
   their own currency (a "3 million" from South Africa is ~150,000 euros in rand). Flag it; never
   convert. Only with a budget on file and a known country. */
export function budgetCurrencyUnverified(l: HintLead): boolean {
  if (l.source !== "META_LEAD_AD") return false;
  if (l.budgetMin == null && l.budgetMax == null) return false;
  const c = countryOf(l.countryOfResidence);
  return !!c && !c.euro;
}

/* A last name that is almost, but not quite, in the email address ("Ashford" / ashworth@…) is often
   a typo in one of the two. Soft hint only, and only for a clear near-miss: the address must contain
   a stretch that starts like the name (first three letters) and differs by at most ~40%; an address
   without the name at all (info@, nicknames) says nothing. Returns the stretch found, or null. */
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
// German spelling in addresses: Müller → mueller, Strauß → strauss.
const foldDe = (s: string) => fold(s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss"));

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

export function nameEmailMismatch(lastName: string | null | undefined, email: string | null | undefined): string | null {
  const name = fold(lastName ?? "");
  const rawLocal = (email ?? "").split("@")[0] ?? "";
  const local = fold(rawLocal);
  if (name.length < 4 || local.length < 4 || local.includes(name) || local.includes(foldDe(lastName ?? ""))) return null;
  let best: { start: number; ratio: number } | null = null;
  for (let len = name.length - 1; len <= name.length + 2; len++) {
    for (let i = 0; i + len <= local.length; i++) {
      const part = local.slice(i, i + len);
      if (part.slice(0, 3) !== name.slice(0, 3)) continue;
      const ratio = distance(name, part) / Math.max(name.length, part.length);
      if (!best || ratio < best.ratio) best = { start: i, ratio };
    }
  }
  if (!best || best.ratio === 0 || best.ratio > 0.4) return null;
  // Name the whole word of the address the near-miss sits in ("ashworth", not "ashwor").
  let pos = 0;
  for (const word of rawLocal.split(/[^A-Za-z\u00C0-\u024F]+/).map(fold).filter(Boolean)) {
    if (best.start < pos + word.length) return word;
    pos += word.length;
  }
  return null;
}

/* Mobile or landline, from the number's national prefix (2026-11-04). A landline (UK 01/02/03, a
   German 0211…) cannot take WhatsApp. Only countries whose mobile ranges are clear-cut are judged;
   everything else — and +1, where mobile and landline share ranges — is "unknown". A number in
   national format ("07700 900123") is read with the lead's country of residence. */
export type PhoneKind = "mobile" | "landline" | "unknown";

// National significant number prefixes that are mobile; any other prefix in these countries is not.
const MOBILE_PREFIXES: Record<string, string[]> = {
  GB: ["71", "72", "73", "74", "75", "77", "78", "79"],
  DE: ["15", "16", "17"],
  AT: ["65", "66", "67", "68", "69"],
  CH: ["75", "76", "77", "78", "79"],
  CY: ["9"],
  GR: ["69"],
  NL: ["6"],
  BE: ["4"],
  FR: ["6", "7"],
  ES: ["6", "7"],
  IT: ["3"],
  IE: ["8"],
  PL: ["45", "5", "6", "7", "8"],
  SE: ["70", "72", "73", "76", "79"],
  NO: ["4", "9"],
  ZA: ["6", "7", "81", "82", "83", "84"],
  IL: ["5"],
  AE: ["5"],
  RU: ["9"],
  UA: ["39", "50", "63", "66", "67", "68", "73", "9"],
};

function nationalNumber(phone: string, home: CountryInfo | null): { country: CountryInfo; nsn: string } | null {
  const intl = internationalDigits(phone);
  if (intl) {
    const country = countryOfPhone(phone);
    return country ? { country, nsn: intl.slice(country.dial.length) } : null;
  }
  const digits = phone.replace(/\D/g, "");
  if (!home || !digits) return null;
  // "447700900123": the country code without "+" (some imports store it so).
  if (!digits.startsWith("0") && digits.startsWith(home.dial) && digits.length >= home.dial.length + 9) {
    return { country: home, nsn: digits.slice(home.dial.length) };
  }
  // Italy keeps its leading 0 in international format; everyone else drops the trunk 0.
  return { country: home, nsn: home.iso === "IT" ? digits : digits.replace(/^0/, "") };
}

export function phoneKind(phone: string | null | undefined, countryOfResidence?: string | null): { kind: PhoneKind; country: string | null } {
  const n = phone ? nationalNumber(phone, countryOf(countryOfResidence)) : null;
  if (!n) return { kind: "unknown", country: null };
  const prefixes = MOBILE_PREFIXES[n.country.iso];
  if (!prefixes || n.nsn.length < 6) return { kind: "unknown", country: n.country.name };
  return { kind: prefixes.some((p) => n.nsn.startsWith(p)) ? "mobile" : "landline", country: n.country.name };
}

export type LeadHints = { emailInvalid: boolean; budgetCurrencyUnverified: boolean; nameEmailMismatch: string | null; phoneType: PhoneKind; messages: string[] };

export function leadHints(l: HintLead): LeadHints {
  const messages: string[] = [];
  const emailInvalid = l.emailInvalidAt != null;
  if (emailInvalid) messages.push(`Email bounced on ${l.emailInvalidAt!.toISOString().slice(0, 10)}${l.emailInvalidReason ? ` (${l.emailInvalidReason})` : ""} — fix the address; nothing is sent to it`);
  const budget = budgetCurrencyUnverified(l);
  if (budget) messages.push(`Budget possibly in local currency (${countryOf(l.countryOfResidence)!.name}), not euros`);
  const mismatch = nameEmailMismatch(l.lastName, l.email);
  if (mismatch) messages.push(`Name and email differ: last name "${l.lastName!.trim()}", address has "${mismatch}" — check the spelling`);
  const phone = phoneKind(l.phone, l.countryOfResidence);
  if (phone.kind === "landline") messages.push(`Landline number (${phone.country}) — probably no WhatsApp; call instead`);
  return { emailInvalid, budgetCurrencyUnverified: budget, nameEmailMismatch: mismatch, phoneType: phone.kind, messages };
}
