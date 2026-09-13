// Sibling copy module for [lang]/projects/[slug]/page.tsx — lifted from
// `lang === "en" ? … : …` / `lang === "ru" ? … : …` ternary chains
// (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const PROJECT_PAGE_EN = {
  enquireNow: "Enquire this amazing project now!",
  developer: "Developer",
  calculateRoi: "Calculate ROI",
  faq: "FAQ",
};

export const PROJECT_PAGE_COPY: Record<Locale, typeof PROJECT_PAGE_EN> = {
  en: PROJECT_PAGE_EN,
  de: {
    enquireNow: "Fragen Sie dieses erstaunliche Projekt jetzt an!",
    developer: "Bauträger",
    calculateRoi: "ROI berechnen",
    faq: "Häufig gestellte Fragen",
  },
  pl: {
    enquireNow: "Zapytaj o ten niesamowity projekt teraz!",
    developer: "Deweloper",
    calculateRoi: "Oblicz ROI",
    faq: "Najczęściej zadawane pytania",
  },
  ru: {
    enquireNow: "Узнайте об этом проекте!",
    developer: "Застройщик",
    calculateRoi: "Рассчитать ROI",
    faq: "Часто задаваемые вопросы",
  },
  // "Enquire this amazing project now!" loses the exclamation mark (styleguide
  // §1: no exclamation marks in UI) and the adjective; the Hebrew is a nominal
  // CTA. FAQ / developer follow the glossary.
  he: {
    enquireNow: "לקבלת פרטים על הפרויקט",
    developer: "יזם",
    calculateRoi: "חישוב תשואה",
    faq: "שאלות ותשובות",
  }, // REVIEW(he)
};

export const projectPageCopy = (lang: string) =>
  PROJECT_PAGE_COPY[isLocale(lang) ? lang : "en"];
