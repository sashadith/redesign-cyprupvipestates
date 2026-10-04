// Sibling copy module for NavWrapper.tsx — lifted from a
// `lang === "de" ? … : …` ternary chain (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const NAV_WRAPPER_EN = {
  consultation: "Get Consultation",
};

export const NAV_WRAPPER_COPY: Record<Locale, typeof NAV_WRAPPER_EN> = {
  en: NAV_WRAPPER_EN,
  de: { consultation: "Beratung anfragen" },
  pl: { consultation: "Umów konsultację" },
  ru: { consultation: "Получить консультацию" },
  he: { consultation: "לקבלת ייעוץ" }, // REVIEW(he)
};

export const navWrapperCopy = (lang: string) => NAV_WRAPPER_COPY[isLocale(lang) ? lang : "en"];
