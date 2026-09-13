// Sibling copy module for NoProjects.tsx — lifted from a
// `lang === "en" ? … : …` ternary chain (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const NO_PROJECTS_EN = {
  message: "No projects found. Please try searching with different parameters.",
};

export const NO_PROJECTS_COPY: Record<Locale, typeof NO_PROJECTS_EN> = {
  en: NO_PROJECTS_EN,
  de: { message: "Keine Projekte gefunden. Versuchen Sie, nach anderen Parametern zu suchen." },
  pl: { message: "Nie znaleziono projektów. Spróbuj wyszukać według innych parametrów." },
  ru: { message: "Проекты не найдены. Попробуйте поискать по другим параметрам." },
  he: NO_PROJECTS_EN, // TODO(he)
};

export const noProjectsCopy = (lang: string) => NO_PROJECTS_COPY[isLocale(lang) ? lang : "en"];
