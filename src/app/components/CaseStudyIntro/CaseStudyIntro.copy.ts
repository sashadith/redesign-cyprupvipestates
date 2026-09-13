// Sibling copy module for CaseStudyIntro.tsx — lifted from
// `lang === "en" ? … : …` ternary chains (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const CASE_STUDY_INTRO_EN = {
  requestOffer: "Request Personal Offer",
  disclaimer:
    "Client privacy comes first, which is why sensitive business information and identifying details are not disclosed in this case study.",
};

export const CASE_STUDY_INTRO_COPY: Record<Locale, typeof CASE_STUDY_INTRO_EN> = {
  en: CASE_STUDY_INTRO_EN,
  de: {
    requestOffer: "Persönliches Angebot anfordern",
    disclaimer:
      "Der Schutz der Privatsphäre unserer Kunden hat höchste Priorität. Daher werden in dieser Fallstudie keine vertraulichen Geschäftsinformationen oder identifizierenden Angaben offengelegt.",
  },
  pl: {
    requestOffer: "Poproś o indywidualną ofertę",
    disclaimer:
      "Prywatność klientów jest dla nas priorytetem, dlatego w tym studium przypadku nie ujawniamy poufnych informacji biznesowych ani danych umożliwiających identyfikację klienta.",
  },
  ru: {
    requestOffer: "Запросить персональное предложение",
    disclaimer:
      "Конфиденциальность клиентов для нас на первом месте, поэтому в данном кейсе не раскрываются чувствительные бизнес-данные и сведения, позволяющие идентифицировать клиента.",
  },
  he: CASE_STUDY_INTRO_EN, // TODO(he)
};

export const caseStudyIntroCopy = (lang: string) =>
  CASE_STUDY_INTRO_COPY[isLocale(lang) ? lang : "en"];
