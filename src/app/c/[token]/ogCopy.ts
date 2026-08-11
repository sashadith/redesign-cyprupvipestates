import { pluralForm, type PLocale } from "./copy";

// 2026-08-11 — copy for the link-preview surface (opengraph-image.tsx +
// page.tsx's generateMetadata), deliberately separate from COPY in copy.ts:
// "residences" is a more upscale word than the on-page "units" wording, and
// this file's sentences are shaped to avoid grammatical case agreement with
// the client's name — PL/RU both decline nouns after prepositions like
// "for" (dla/для), and there is no reliable way to auto-decline an
// arbitrary name into the right case. Every construction below keeps the
// name in its own clause/position so it never needs to agree with
// anything — same principle HeroGreeting.tsx already uses ("{greeting},
// {name}!", not a grammatically-integrated sentence).

const CYPRUS: Record<PLocale, string> = { en: "Cyprus", de: "Zypern", pl: "Cypr", ru: "Кипр" };
// "in {district}, Cyprus" uses the plain preposition ("w"/"в") since a
// district/city name is treated as an undeclined foreign proper noun here —
// same convention developmentSeo.ts's LABELS already uses ("w Paphos").
// But when there's NO district and Cyprus is the ONLY place named, PL/RU
// need the country's own case-correct standalone phrase: islands take
// "na"/"на" + locative/prepositional case ("na Cyprze"/"на Кипре"), not the
// generic "w"/"в" + nominative that's fine as an appositive after a district
// name but wrong as its own prepositional phrase.
const IN = { en: "in", de: "in", pl: "w", ru: "в" } as const;
const IN_CYPRUS_ONLY: Record<PLocale, string> = { en: "in Cyprus", de: "in Zypern", pl: "na Cyprze", ru: "на Кипре" };

const RESIDENCES: Record<PLocale, { one: string; few?: string; many: string }> = {
  en: { one: "residence", many: "residences" },
  de: { one: "Residenz", many: "Residenzen" },
  pl: { one: "rezydencja", few: "rezydencje", many: "rezydencji" },
  ru: { one: "резиденция", few: "резиденции", many: "резиденций" },
};

/** "6 residences" / "1 residence" — same counting rule as formatUnitsCount, different noun. */
export function formatResidenceCount(locale: PLocale, n: number): string {
  const r = RESIDENCES[locale];
  const form = pluralForm(locale, n);
  const word = (form === "few" ? r.few : undefined) ?? r.many;
  return `${n} ${form === "one" ? r.one : word}`;
}

/** "Paphos, Cyprus" (localized country name), or just "Cyprus" if no district/town is known. */
export function formatLocationLine(locale: PLocale, place: string | null): string {
  const cyprus = CYPRUS[locale];
  return place ? `${place} · ${cyprus}` : cyprus;
}

/** Headline for both the OG image and the <title>/og:title — name kept in
 *  its own clause (dash-attached for PL/RU) so it never needs grammatical
 *  case agreement. Falls back cleanly to the non-personal form when
 *  greetingName is empty — no dangling "for" / dash. */
export function ogHeadline(locale: PLocale, name: string | null): string {
  const n = name?.trim();
  switch (locale) {
    case "de":
      return n ? `Eine persönliche Auswahl für ${n}` : "Eine persönliche Auswahl";
    case "pl":
      return n ? `${n} — Twój osobisty wybór` : "Twój osobisty wybór";
    case "ru":
      return n ? `${n} — персональная подборка` : "Персональная подборка";
    default:
      return n ? `A personal selection for ${n}` : "A personal selection";
  }
}

/** og:description / meta description — count + place, never the client's
 *  name (case-safe on its own merits, but also keeps the description usable
 *  even when greetingName is empty). Two sentences for PL/RU rather than one
 *  participle-modified clause — a participle here would have to agree with
 *  whichever grammatical case the count puts the noun in (nominative for
 *  2-4, genitive for 5+, singular for 1), which turns into a real
 *  agreement bug for at least one of those three counts; a short, count-
 *  independent second sentence sidesteps that entirely. */
export function ogDescription(locale: PLocale, count: number, place: string | null): string {
  const residences = formatResidenceCount(locale, count);
  const where = place ? `${IN[locale]} ${place}, ${CYPRUS[locale]}` : IN_CYPRUS_ONLY[locale];
  switch (locale) {
    case "de":
      return `${residences} ${where} – persönlich für Sie ausgewählt.`;
    case "pl":
      return `${residences} ${where}. Wybór przygotowany specjalnie dla Ciebie.`;
    case "ru":
      return `${residences} ${where}. Подборка подготовлена специально для вас.`;
    default:
      return `${residences} ${where}, chosen for you.`;
  }
}
