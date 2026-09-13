// Sibling copy module for TeamBlockComponent.tsx — lifted from a
// `lang === "en" ? … : …` ternary chain (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const TEAM_BLOCK_EN = {
  contact: "Contact",
};

export const TEAM_BLOCK_COPY: Record<Locale, typeof TEAM_BLOCK_EN> = {
  en: TEAM_BLOCK_EN,
  de: { contact: "Kontaktieren" },
  pl: { contact: "Kontakt" },
  ru: { contact: "Связаться" },
  he: TEAM_BLOCK_EN, // TODO(he)
};

export const teamBlockCopy = (lang: string) => TEAM_BLOCK_COPY[isLocale(lang) ? lang : "en"];
