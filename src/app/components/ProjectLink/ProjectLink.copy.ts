// Sibling copy module for ProjectLink.tsx — lifted from the residual
// `lang === "en" ? … : lang === "de" ? … : …` ternary chains that Task 3 left
// behind (Hebrew Localization Phase 4, WP2). The en/de/pl/ru wording is copied
// verbatim from those chains, including the PL "Cena na życzenie" (which
// deliberately differs from the "Cena na zapytanie" other modules use) — this
// is a lift, not a retranslation.
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const PROJECT_LINK_EN = {
  priceOnRequest: "Price on request",
  priceFrom: "Price from",
  bedrooms: "Bedrooms",
  coveredArea: "Covered area",
  plotSize: "Plot size",
  // Area unit — was hardcoded Latin "m²" in ProjectLink.tsx for every
  // locale. Hebrew writes מ"ר (glossary §2) and Russian writes the Cyrillic
  // м², the same symbol DEVELOPMENT_STRINGS.ru.unitM2 already uses on the
  // neighbouring surface (Pass B, Should fix #26).
  areaUnit: "m²",
};

export const PROJECT_LINK_COPY: Record<Locale, typeof PROJECT_LINK_EN> = {
  en: PROJECT_LINK_EN,
  de: {
    priceOnRequest: "Preis auf Anfrage",
    priceFrom: "Preis ab",
    bedrooms: "Schlafzimmer",
    coveredArea: "Überdachte Fläche",
    plotSize: "Grundstück",
    areaUnit: "m²",
  },
  pl: {
    priceOnRequest: "Cena na życzenie",
    priceFrom: "Cena od",
    bedrooms: "Sypialnie",
    coveredArea: "Powierzchnia zabudowy",
    plotSize: "Powierzchnia działki",
    areaUnit: "m²",
  },
  ru: {
    priceOnRequest: "Цена по запросу",
    priceFrom: "Цена от",
    bedrooms: "Спальни",
    coveredArea: "Площадь",
    plotSize: "Площадь участка",
    areaUnit: "м²",
  },
  // priceFrom is followed by a non-breaking space and the <Bdi ltr> price
  // (ProjectLink.tsx), so the glossary's bound-prefix form "החל מ-" would sit
  // a space away from the figure — a hyphen with nothing against it is a
  // typesetting error in Hebrew, not a prefix. The free-word caption needs no
  // hyphen and matches the Development hero's own price caption (Pass B,
  // Should fix #25 / Must fix #3).
  he: {
    priceOnRequest: "מחיר לפי פנייה",
    priceFrom: "מחיר התחלתי",
    bedrooms: "חדרי שינה",
    coveredArea: "שטח מקורה",
    plotSize: "שטח מגרש",
    areaUnit: 'מ"ר',
  }, // REVIEW(he)
};

export const projectLinkCopy = (lang: string) => PROJECT_LINK_COPY[isLocale(lang) ? lang : "en"];
