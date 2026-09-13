// Sibling copy module for [lang]/case-studies/[slug]/page.tsx — lifted from a
// `lang === "de" ? … : …` ternary chain (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const CASE_STUDY_PAGE_EN = {
  relatedProperties: "Related Properties",
};

export const CASE_STUDY_PAGE_COPY: Record<Locale, typeof CASE_STUDY_PAGE_EN> = {
  en: CASE_STUDY_PAGE_EN,
  de: { relatedProperties: "Verwandte Immobilien" },
  pl: { relatedProperties: "Powiązane nieruchomości" },
  ru: { relatedProperties: "Похожие объекты" },
  he: CASE_STUDY_PAGE_EN, // TODO(he)
};

export const caseStudyPageCopy = (lang: string) =>
  CASE_STUDY_PAGE_COPY[isLocale(lang) ? lang : "en"];
