// Sibling copy module for PropertyIntro.tsx — lifted from a
// `lang === "en" ? … : …` ternary chain (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const PROPERTY_INTRO_EN = {
  requestOffer: "Request Personal Offer",
};

export const PROPERTY_INTRO_COPY: Record<Locale, typeof PROPERTY_INTRO_EN> = {
  en: PROPERTY_INTRO_EN,
  de: { requestOffer: "Persönliches Angebot anfordern" },
  pl: { requestOffer: "Poproś o indywidualną ofertę" },
  ru: { requestOffer: "Запросить персональное предложение" },
  he: { requestOffer: "לקבלת הצעה אישית" }, // REVIEW(he)
};

export const propertyIntroCopy = (lang: string) => PROPERTY_INTRO_COPY[isLocale(lang) ? lang : "en"];
