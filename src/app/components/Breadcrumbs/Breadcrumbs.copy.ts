// Sibling copy module for Breadcrumbs.tsx — lifted from a
// `lang === "en" ? … : …` ternary chain (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const BREADCRUMBS_EN = {
  home: "Home",
};

export const BREADCRUMBS_COPY: Record<Locale, typeof BREADCRUMBS_EN> = {
  en: BREADCRUMBS_EN,
  de: { home: "Startseite" },
  pl: { home: "Strona główna" },
  ru: { home: "Главная" },
  he: BREADCRUMBS_EN, // TODO(he)
};

export const breadcrumbsCopy = (lang: string) => BREADCRUMBS_COPY[isLocale(lang) ? lang : "en"];
