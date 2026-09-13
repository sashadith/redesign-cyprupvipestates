// Sibling copy module for ProjectPdfDocument.tsx — lifted from
// `lang === "ru" ? … : …` ternary chains (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const PROJECT_PDF_DOCUMENT_EN = {
  keyFeatures: "Key Features",
  description: "Description",
};

export const PROJECT_PDF_DOCUMENT_COPY: Record<Locale, typeof PROJECT_PDF_DOCUMENT_EN> = {
  en: PROJECT_PDF_DOCUMENT_EN,
  de: { keyFeatures: "Wichtige Informationen", description: "Beschreibung" },
  pl: { keyFeatures: "Najważniejsze informacje", description: "Opis" },
  ru: { keyFeatures: "Основные характеристики", description: "Описание" },
  he: PROJECT_PDF_DOCUMENT_EN, // TODO(he)
};

export const projectPdfDocumentCopy = (lang: string) =>
  PROJECT_PDF_DOCUMENT_COPY[isLocale(lang) ? lang : "en"];
