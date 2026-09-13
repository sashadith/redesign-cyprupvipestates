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
};

export const PROJECT_LINK_COPY: Record<Locale, typeof PROJECT_LINK_EN> = {
  en: PROJECT_LINK_EN,
  de: {
    priceOnRequest: "Preis auf Anfrage",
    priceFrom: "Preis ab",
    bedrooms: "Schlafzimmer",
    coveredArea: "Überdachte Fläche",
    plotSize: "Grundstück",
  },
  pl: {
    priceOnRequest: "Cena na życzenie",
    priceFrom: "Cena od",
    bedrooms: "Sypialnie",
    coveredArea: "Powierzchnia zabudowy",
    plotSize: "Powierzchnia działki",
  },
  ru: {
    priceOnRequest: "Цена по запросу",
    priceFrom: "Цена от",
    bedrooms: "Спальни",
    coveredArea: "Площадь",
    plotSize: "Площадь участка",
  },
  // priceFrom is followed by a non-breaking space and the <Bdi ltr> price, so
  // the glossary's bound-prefix form "החל מ-" ends up separated from the figure
  // ("מחיר החל מ- €450,000") rather than glued to it as in prose. Kept anyway
  // because it is the wording the whole site uses; flagged for Pass C.
  he: {
    priceOnRequest: "מחיר לפי פנייה",
    priceFrom: "מחיר החל מ-",
    bedrooms: "חדרי שינה",
    coveredArea: "שטח מקורה",
    plotSize: "שטח מגרש",
  }, // REVIEW(he)
};

export const projectLinkCopy = (lang: string) => PROJECT_LINK_COPY[isLocale(lang) ? lang : "en"];
