// Sibling copy module for SliderReviewsFull.tsx — lifted from a
// `lang === "de" ? … : …` ternary chain (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const SLIDER_REVIEWS_FULL_EN = {
  readFullReview: "Read full review",
};

export const SLIDER_REVIEWS_FULL_COPY: Record<Locale, typeof SLIDER_REVIEWS_FULL_EN> = {
  en: SLIDER_REVIEWS_FULL_EN,
  de: { readFullReview: "Ganze Bewertung lesen" },
  pl: { readFullReview: "Przeczytaj całą recenzję" },
  ru: { readFullReview: "Читать полный отзыв" },
  he: { readFullReview: "לקריאת חוות הדעת המלאה" }, // REVIEW(he)
};

export const sliderReviewsFullCopy = (lang: string) =>
  SLIDER_REVIEWS_FULL_COPY[isLocale(lang) ? lang : "en"];
