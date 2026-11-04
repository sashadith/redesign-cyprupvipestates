import { LOCALES } from "@/lib/locale";
import type { LocaleText } from "./localeTextGuards";

/* The public project description names neither the project nor its developer
   (operator rule, 2026-10-26 — the project name is the page heading already,
   and naming the developer sends buyers to them directly, see
   no-developer-directory). PR #56 (2026-09-17) had told the generator to name
   both; Zephyr Penthouse went live with "by Property Gallery" because of it.

   Matching is case-sensitive on purpose: names are proper nouns, and a
   case-insensitive test would forbid ordinary words that happen to be a name
   ("plus" for Plus Properties, "harbour" for the project Harbour). */

const GENERIC = /\b(Developers?|Development|Developments|Properties|Property|Homes|Group|Ltd|Limited|Estates?|Construction|Holdings|Real Estate)\b/g;

/** The names a description must not contain: each name as given, plus a developer's brand without
 *  "(SharePoint)"-style tags and generic company words ("Leptos Estates" → also "Leptos"). */
export function forbiddenNames(input: { projectNames: (string | null | undefined)[]; developer?: string | null }): string[] {
  const out = new Set<string>();
  for (const n of input.projectNames) {
    const t = (n ?? "").trim();
    if (t.length >= 3) out.add(t);
  }
  const dev = (input.developer ?? "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  if (dev.length >= 3) out.add(dev);
  const brand = dev.replace(GENERIC, "").replace(/\s+/g, " ").trim();
  if (brand.length >= 4) out.add(brand);
  return Array.from(out);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** First forbidden name found in any locale, as `{ locale, name }`, else null. */
export function descriptionNamesFound(out: LocaleText, names: string[]): { locale: string; name: string } | null {
  for (const name of names) {
    // A letter or digit right before/after means it is part of a longer word ("Pluses", "Plus38" excluded).
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc(name)}(?![\\p{L}\\p{N}])`, "u");
    for (const l of LOCALES) if (re.test(out[l] ?? "")) return { locale: l, name };
  }
  return null;
}
