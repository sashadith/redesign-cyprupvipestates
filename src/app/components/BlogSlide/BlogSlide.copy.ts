// Sibling copy module for BlogSlide.tsx — lifted from
// `lang === "en" ? … : …` ternary chains (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const BLOG_SLIDE_EN = {
  priceOnRequest: "Price on request",
  priceFrom: "Price from",
};

export const BLOG_SLIDE_COPY: Record<Locale, typeof BLOG_SLIDE_EN> = {
  en: BLOG_SLIDE_EN,
  de: { priceOnRequest: "Preis auf Anfrage", priceFrom: "Preis ab" },
  pl: { priceOnRequest: "Cena na życzenie", priceFrom: "Cena od" },
  ru: { priceOnRequest: "Цена по запросу", priceFrom: "Цена от" },
  he: BLOG_SLIDE_EN, // TODO(he)
};

export const blogSlideCopy = (lang: string) => BLOG_SLIDE_COPY[isLocale(lang) ? lang : "en"];
