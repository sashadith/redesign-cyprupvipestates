// Sibling copy module for ProjectPdfButton.tsx — lifted from a
// `lang === "ru" ? … : …` ternary chain (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const PROJECT_PDF_BUTTON_EN = {
  downloadBrochure: "Download Brochure",
};

export const PROJECT_PDF_BUTTON_COPY: Record<Locale, typeof PROJECT_PDF_BUTTON_EN> = {
  en: PROJECT_PDF_BUTTON_EN,
  de: { downloadBrochure: "Broschüre herunterladen" },
  pl: { downloadBrochure: "Pobierz broszurę" },
  ru: { downloadBrochure: "Скачать Брошюру" },
  he: PROJECT_PDF_BUTTON_EN, // he: PDF not offered for he (spec Phase 1–4)
};

export const projectPdfButtonCopy = (lang: string) =>
  PROJECT_PDF_BUTTON_COPY[isLocale(lang) ? lang : "en"];
