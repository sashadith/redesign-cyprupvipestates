// Sibling copy module for ModalRoiCalculator.tsx — lifted from
// `lang === "ru" ? … : …` ternary chains (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const MODAL_ROI_CALCULATOR_EN = {
  title: "ROI Calculator",
  subtitle: "Estimate the potential return of this property.",
};

export const MODAL_ROI_CALCULATOR_COPY: Record<Locale, typeof MODAL_ROI_CALCULATOR_EN> = {
  en: MODAL_ROI_CALCULATOR_EN,
  de: {
    title: "ROI-Rechner",
    subtitle: "Schätzen Sie die potenzielle Rendite dieser Immobilie.",
  },
  pl: {
    title: "Kalkulator ROI",
    subtitle: "Oszacuj potencjalną rentowność tej nieruchomości.",
  },
  ru: {
    title: "Калькулятор ROI",
    subtitle: "Оцените потенциальную доходность этого объекта.",
  },
  he: MODAL_ROI_CALCULATOR_EN, // TODO(he)
};

export const modalRoiCalculatorCopy = (lang: string) =>
  MODAL_ROI_CALCULATOR_COPY[isLocale(lang) ? lang : "en"];
