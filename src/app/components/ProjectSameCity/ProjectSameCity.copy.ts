// Sibling copy module for ProjectSameCity.tsx — lifted from a
// `lang === "en" ? … : …` ternary chain (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const PROJECT_SAME_CITY_EN = {
  title: "Other projects in",
};

export const PROJECT_SAME_CITY_COPY: Record<Locale, typeof PROJECT_SAME_CITY_EN> = {
  en: PROJECT_SAME_CITY_EN,
  de: { title: "Andere Projekte in" },
  pl: { title: "Inne projekty w mieście" },
  ru: { title: "Другие проекты в городе" },
  he: PROJECT_SAME_CITY_EN, // TODO(he)
};

export const projectSameCityCopy = (lang: string) =>
  PROJECT_SAME_CITY_COPY[isLocale(lang) ? lang : "en"];
