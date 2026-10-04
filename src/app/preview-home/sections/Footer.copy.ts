// Sibling copy module for preview-home/sections/Footer.tsx — lifted from a
// `lang === "de" ? … : …` ternary chain (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const FOOTER_EN = {
  emailPlaceholder: "Your email",
};

export const FOOTER_COPY: Record<Locale, typeof FOOTER_EN> = {
  en: FOOTER_EN,
  de: { emailPlaceholder: "Ihre E-Mail Adresse" },
  pl: { emailPlaceholder: "Twój adres e-mail" },
  ru: { emailPlaceholder: "Ваш email" },
  he: { emailPlaceholder: "האימייל שלכם" }, // REVIEW(he)
};

export const footerCopy = (lang: string) => FOOTER_COPY[isLocale(lang) ? lang : "en"];
