// Sibling copy module for ProjectsSectionSlider.tsx — lifted from a
// `lang === "en" ? … : …` ternary chain (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const PROJECTS_SECTION_SLIDER_EN = {
  viewProject: "View project",
};

export const PROJECTS_SECTION_SLIDER_COPY: Record<Locale, typeof PROJECTS_SECTION_SLIDER_EN> = {
  en: PROJECTS_SECTION_SLIDER_EN,
  de: { viewProject: "Projekt ansehen" },
  pl: { viewProject: "Zobacz projekt" },
  ru: { viewProject: "Посмотреть проект" },
  he: PROJECTS_SECTION_SLIDER_EN, // TODO(he)
};

export const projectsSectionSliderCopy = (lang: string) =>
  PROJECTS_SECTION_SLIDER_COPY[isLocale(lang) ? lang : "en"];
