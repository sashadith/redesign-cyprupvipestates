import { countryOf } from "./countryInfo";

// Soft warnings about a lead's data (2026-11-04), computed on every read rather than stored, so they
// follow edits to the lead. Shown in the cockpit, in the new-lead Telegram and in the MCP lead rows.
// Pure and import-free apart from countryInfo (the cockpit is server-rendered, but keep it light).

export type HintLead = {
  source: string;
  countryOfResidence: string | null;
  lastName?: string | null;
  email?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
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

export type LeadHints = { budgetCurrencyUnverified: boolean; nameEmailMismatch: string | null; messages: string[] };

export function leadHints(l: HintLead): LeadHints {
  const messages: string[] = [];
  const budget = budgetCurrencyUnverified(l);
  if (budget) messages.push(`Budget possibly in local currency (${countryOf(l.countryOfResidence)!.name}), not euros`);
  const mismatch = nameEmailMismatch(l.lastName, l.email);
  if (mismatch) messages.push(`Name and email differ: last name "${l.lastName!.trim()}", address has "${mismatch}" — check the spelling`);
  return { budgetCurrencyUnverified: budget, nameEmailMismatch: mismatch, messages };
}
