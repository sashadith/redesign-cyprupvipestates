// Sibling copy module for DevelopersLogos.tsx — lifted from a
// `lang === "de" ? … : …` ternary chain that currently lives inside a
// commented-out <h2> (Hebrew Localization Phase 4, Task 3). Kept in table
// form so the copy is ready if that heading is ever re-enabled.
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const DEVELOPERS_LOGOS_EN = {
  trustedBy: "We work with the best developers in Cyprus",
};

export const DEVELOPERS_LOGOS_COPY: Record<Locale, typeof DEVELOPERS_LOGOS_EN> = {
  en: DEVELOPERS_LOGOS_EN,
  de: { trustedBy: "Die besten Entwickler Zyperns vertrauen uns" },
  pl: { trustedBy: "Współpracujemy z najlepszymi deweloperami na Cyprze" },
  ru: { trustedBy: "Мы работаем с ведущими застройщиками Кипра" },
  he: DEVELOPERS_LOGOS_EN, // TODO(he)
};

export const developersLogosCopy = (lang: string) =>
  DEVELOPERS_LOGOS_COPY[isLocale(lang) ? lang : "en"];
