import type { BenefitsBlock } from "@/types/homepage";

/* The homepage "track record" band, moved out of Sanity and into code
   (2026-09-29). It used to be CMS content carrying a hand-maintained 195 and a
   "100% satisfied clients" tile, while the Partners and About bands — the same
   claim, same design — had already been switched to live database figures. The
   three surfaces disagreed with each other and with /projects.

   Wording below is the CMS text exactly as it was live, per language, so
   nothing reads differently after the move; only the numbers changed hands and
   the "Satisfied clients" tile was dropped on the operator's instruction.
   Hebrew: the strings below are copied VERBATIM, none of them translated here.
   Three come off the live he homepage's own CMS text; the units tile's title is
   "יחידות זמינות", the site's own established term for it — the same string
   already sits in developmentSeo.ts, developmentCopy.ts and the client-portal
   copy, so it is approved wording in production, not something invented on this
   side. Its DESCRIPTION is the one string here that is new — written on request
   after the tile shipped without one, and carrying a REVIEW(he) marker for that
   reason, the same convention ScarcityBanner uses. Of its three categories only
   "commercial" had any Hebrew precedent in this codebase (נכס מסחרי,
   heFeedVocab.ts); the other two are not traceable to approved copy, so a
   Hebrew reader should confirm the line before it is treated as final.

   (A first pass claimed he had no band at all. That was measured on localhost,
   where he is gated off by NEXT_PUBLIC_LIVE_LOCALES and every /he URL 404s —
   the band is live in production and always was.) */

export type TrackRecordStat = {
  number: number;
  sign?: string;
  live?: "projects" | "units";
  title: string;
  description: string;
};

type Lang = "en" | "de" | "pl" | "ru" | "he";

export const TRACK_RECORD: Record<Lang, TrackRecordStat[]> = {
  en: [
    { number: 195, live: "projects", title: "Real Estate Projects", description: "In Southern Cyprus. From Studio Apartments to High-Class Villas" },
    { number: 0, live: "units", title: "Available units", description: "Residential, investment and commercial properties" },
    { number: 10, title: "Years of experience", description: "as a full-service real estate marketing agency" },
    { number: 360, sign: "°", title: "Service for our clients", description: "We accompany you from the first contact to the handover of the keys" },
  ],
  de: [
    { number: 195, live: "projects", title: "Immobilienprojekte", description: "Auf Süd-Zypern. Von Studio Apartments bis High Class Villas" },
    { number: 0, live: "units", title: "Verfügbare Einheiten", description: "Wohn-, Anlage- und Gewerbeimmobilien" },
    { number: 10, title: "Jahre Erfahrung", description: "als Full-Service Immobilien Marketing Agentur" },
    { number: 360, sign: "°", title: "Service für unsere Kunden", description: "Wir begleiten Sie vom ersten Kontakt bis zur Schlüsselübergabe" },
  ],
  pl: [
    { number: 195, live: "projects", title: "Projektów nieruchomości", description: "Na południu Cypru. Od apartamentów typu studio po luksusowe wille" },
    { number: 0, live: "units", title: "Dostępne nieruchomości", description: "Mieszkaniowe, inwestycyjne i komercyjne" },
    { number: 10, title: "Lat doświadczenia", description: "jako agencja zajmująca się kompleksowym marketingiem nieruchomości" },
    { number: 360, sign: "°", title: "Obsługa dla naszych klientów", description: "Towarzyszymy Państwu od pierwszego kontaktu aż do przekazania kluczy" },
  ],
  ru: [
    { number: 195, live: "projects", title: "Проектов в сфере недвижимости", description: "На юге Кипра. От студийных квартир до вилл высокого класса" },
    { number: 0, live: "units", title: "Доступных объектов", description: "Жилая, инвестиционная и коммерческая недвижимость" },
    { number: 10, title: "Лет опыта", description: "как агентство полного цикла маркетинга недвижимости" },
    { number: 360, sign: "°", title: "Спектр услуг для наших клиентов", description: "Мы сопровождаем вас от первого контакта до передачи ключей." },
  ],

  he: [
    { number: 195, live: "projects", title: "פרויקטים", description: "בדרום קפריסין. מדירות סטודיו ועד וילות יוקרה" },
    { number: 0, live: "units", title: "יחידות זמינות", description: "נכסי מגורים, השקעה ומסחר" }, // REVIEW(he) — description only; the title is existing site copy
    { number: 10, title: "שנות ניסיון", description: 'כסוכנות שיווק נדל"ן בשירות מלא' },
    { number: 360, sign: "°", title: "שירות ללקוחות שלנו", description: "מלווים אתכם מהפנייה הראשונה ועד מסירת המפתחות" },
  ],
};

export function hasTrackRecord(lang: string): lang is Lang {
  return lang === "en" || lang === "de" || lang === "pl" || lang === "ru" || lang === "he";
}

/** Shaped like the CMS block so the unchanged Benefits component renders it. */
export function buildTrackRecordBlock(
  lang: Lang,
  projectCount: number,
  availableUnits: number,
  title: string,
): BenefitsBlock {
  return {
    _key: "home-track-record",
    _type: "benefitsBlock",
    title,
    benefits: TRACK_RECORD[lang].map((s, i) => ({
      _key: `stat-${i}`,
      _type: "benefits",
      counting: {
        _key: `c-${i}`,
        _type: "counting",
        conuntNumber: s.live === "projects" ? projectCount : s.live === "units" ? availableUnits : s.number,
        sign: s.sign ?? "",
      },
      title: s.title,
      description: s.description,
    })),
  } as BenefitsBlock;
}
