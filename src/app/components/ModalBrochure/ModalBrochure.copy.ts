// Sibling copy module for ModalBrochure.tsx (Hebrew Localization Phase 4,
// WP7 fix round 1). The table used to live inside the component as a
// `Record<string, …>` with no `he` row, so `COPY[lang] ?? COPY.en` silently
// served the Hebrew page an English headline and lead sentence — the modal's
// only translated string was its `aria-label` (Pass B, Must fix #15).
//
// `Record<Locale, …>` instead of `Record<string, …>`: the type now refuses to
// compile the day a locale is added without copy, which is the whole point of
// the repo's `.copy.ts` pattern. Every LTR value is byte-identical to what
// the component carried before.
import type { Locale } from "@/lib/locale";

export type BrochureCopy = {
  /** Headline, split so the LAST word can be set in gold (`accent`). */
  title: string;
  accent: string;
  lead: string;
};

export const MODAL_BROCHURE_COPY: Record<Locale, BrochureCopy> = {
  en: {
    title: "Speak to an",
    accent: "adviser",
    lead: "Leave your details and we will get back to you, usually the same day.",
  },
  de: {
    title: "Sprechen Sie mit einem",
    accent: "Berater",
    lead: "Hinterlassen Sie Ihre Daten, wir melden uns — meist noch am selben Tag.",
  },
  pl: {
    title: "Porozmawiaj z",
    accent: "doradcą",
    lead: "Zostaw swoje dane, odezwiemy się — zwykle jeszcze tego samego dnia.",
  },
  ru: {
    title: "Поговорите с",
    accent: "консультантом",
    lead: "Оставьте свои данные, мы свяжемся с вами — обычно в тот же день.",
  },
  // The gold accent is the LAST word of the headline in every locale, and in
  // Hebrew that word has to be `יועץ` — so the split is `לדבר עם` + `יועץ`
  // (styleguide §11.3). Infinitive headline, no gendered imperative (§2).
  // The em dash of the LTR leads is dropped for `he` (§3).
  he: {
    title: "לדבר עם",
    accent: "יועץ",
    lead: "אפשר להשאיר פרטים ונחזור אליכם, בדרך כלל עוד באותו יום.",
  }, // REVIEW(he)
};
