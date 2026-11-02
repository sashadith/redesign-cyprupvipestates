// UI strings of the guides section (the article listing on the guides page and the crumb on a guide
// article). The free-PDF part of that page has its own copy (src/app/preview-guides/copy.ts).
// Hebrew has no guides section (src/lib/articleSections.ts), so it has no entry.

import type { GuideLang } from "@/lib/guides/types";

export type GuidesSectionStrings = {
  /** Breadcrumb name and the kicker link on a guide article. */
  breadcrumb: string;
  /** The listing block on the guides page. */
  allEyebrow: string;
  allTitle: string;
  allLead: string;
  read: string;
  /** "{n} guides" for a category heading; {n} is replaced by the count. */
  countOne: string;
  countMany: string;
  dateLocale: string;
};

const STRINGS: Record<GuideLang, GuidesSectionStrings> = {
  en: {
    breadcrumb: "Guides",
    allEyebrow: "All guides",
    allTitle: "Guides to buying property, taxes and life in Cyprus",
    allLead: "Step-by-step guides with worked examples and dated figures, grouped by topic.",
    read: "Read",
    countOne: "{n} guide",
    countMany: "{n} guides",
    dateLocale: "en-GB",
  },
  de: {
    breadcrumb: "Ratgeber",
    allEyebrow: "Alle Ratgeber",
    allTitle: "Ratgeber zu Immobilienkauf, Steuern und Leben auf Zypern",
    allLead: "Ratgeber Schritt für Schritt, mit Rechenbeispielen und datierten Zahlen, nach Themen geordnet.",
    read: "Lesen",
    countOne: "{n} Ratgeber",
    countMany: "{n} Ratgeber",
    dateLocale: "de-DE",
  },
  pl: {
    breadcrumb: "Przewodniki",
    allEyebrow: "Wszystkie przewodniki",
    allTitle: "Przewodniki o zakupie nieruchomości, podatkach i życiu na Cyprze",
    allLead: "Przewodniki krok po kroku z przykładami obliczeń i datowanymi liczbami, uporządkowane tematycznie.",
    read: "Czytaj",
    countOne: "{n} przewodnik",
    countMany: "{n} przewodników",
    dateLocale: "pl-PL",
  },
  ru: {
    breadcrumb: "Гиды",
    allEyebrow: "Все гиды",
    allTitle: "Гиды по покупке недвижимости, налогам и жизни на Кипре",
    allLead: "Пошаговые гиды с расчётами на примерах и датированными цифрами, по темам.",
    read: "Читать",
    countOne: "{n} гид",
    countMany: "{n} гидов",
    dateLocale: "ru-RU",
  },
};

export function guidesSectionStrings(lang: string): GuidesSectionStrings {
  return STRINGS[(lang in STRINGS ? lang : "en") as keyof typeof STRINGS];
}

/** "{n} guides" with the right noun form (Polish and Russian have a few/many split). */
export function guidesCountLabel(lang: string, n: number): string {
  const s = guidesSectionStrings(lang);
  if (lang === "ru" || lang === "pl") {
    const one = n === 1;
    const lastTwo = n % 100;
    const last = n % 10;
    const few = !one && last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
    if (lang === "ru") {
      const word = n % 10 === 1 && n % 100 !== 11 ? "гид" : few ? "гида" : "гидов";
      return `${n} ${word}`;
    }
    const word = one ? "przewodnik" : few ? "przewodniki" : "przewodników";
    return `${n} ${word}`;
  }
  return (n === 1 ? s.countOne : s.countMany).replace("{n}", String(n));
}
