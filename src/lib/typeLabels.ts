// Display labels for a property type ("Apartment", "Villa", …) in en/de/pl/ru/he.
//
// The stored value is the feed's English word (src/lib/unitType.ts keeps it to
// a canonical set) and it keeps driving filtering, sorting and matching —
// matchesPropertyTypeFilter in developmentCard.ts compares against the English
// resolveDevelopmentType() output. This module is DISPLAY-ONLY: call it at the
// render site, never on a value that is compared or stored.
//
// Scope, by decision: project cards, the project-page hero and facts panel,
// the /projects filter and the SEO/form/presentation labels. The unit cards and
// unit tables on a project page deliberately keep the raw word (conversion
// elements — left untouched). `he` still goes through heFeedLabel.
//
// An unknown value falls back to the raw string, never to a guess.
import { heFeedLabel } from "@/lib/heFeedVocab";

type L4 = { en: string; de: string; pl: string; ru: string };

const TYPES: Record<string, L4> = {
  apartment:  { en: "Apartment",  de: "Wohnung",    pl: "Apartament",    ru: "Квартира" },
  villa:      { en: "Villa",      de: "Villa",      pl: "Willa",         ru: "Вилла" },
  townhouse:  { en: "Townhouse",  de: "Reihenhaus", pl: "Dom szeregowy", ru: "Таунхаус" },
  penthouse:  { en: "Penthouse",  de: "Penthouse",  pl: "Penthouse",     ru: "Пентхаус" },
  studio:     { en: "Studio",     de: "Studio",     pl: "Studio",        ru: "Студия" },
  maisonette: { en: "Maisonette", de: "Maisonette", pl: "Maisonette",    ru: "Мезонет" },
  duplex:     { en: "Duplex",     de: "Duplex",     pl: "Dupleks",       ru: "Дуплекс" },
  office:     { en: "Office",     de: "Büro",       pl: "Biuro",         ru: "Офис" },
  shop:       { en: "Shop",       de: "Laden",      pl: "Sklep",         ru: "Магазин" },
  commercial: { en: "Commercial", de: "Gewerbe",    pl: "Komercyjne",    ru: "Коммерческая" },
  hotel:      { en: "Hotel",      de: "Hotel",      pl: "Hotel",         ru: "Отель" },
  restaurant: { en: "Restaurant", de: "Restaurant", pl: "Restauracja",   ru: "Ресторан" },
  house:      { en: "House",      de: "Haus",       pl: "Dom",           ru: "Дом" },
};

// Spellings the feeds and the category fallback produce → canonical key.
const ALIASES: Record<string, string> = {
  apartments: "apartment", flat: "apartment",
  villas: "villa", "detached villa": "villa",
  "town house": "townhouse", townhouses: "townhouse",
  penthouses: "penthouse", studios: "studio",
  maisonettes: "maisonette", duplexes: "duplex",
  offices: "office", shops: "shop",
  houses: "house", "detached house": "house",
};

const norm = (raw: string): string =>
  String(raw ?? "").toLowerCase().replace(/[\s _-]+/g, " ").trim();

/** Label for ONE property-type word in the page language. */
export function typeLabel(raw: string, lang: string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (lang === "he") return heFeedLabel(value);
  if (lang !== "de" && lang !== "pl" && lang !== "ru") return value;
  const n = norm(value);
  const row = TYPES[ALIASES[n] ?? n];
  return row ? row[lang] : value;
}

/** Label for a " · "-joined compound ("Apartment · Villa") — split, map, rejoin. */
export function typeLabelList(joined: string, lang: string, sep = " · "): string {
  return String(joined ?? "")
    .split(" · ")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => typeLabel(x, lang))
    .join(sep);
}
