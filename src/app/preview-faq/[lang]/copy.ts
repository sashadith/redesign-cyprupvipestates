/* UI copy for the redesigned FAQ page, per language. The 60 Q&A pairs
   themselves live in the `faqPage` SiteDocument (see scripts/seed-faq-
   translations.mjs) — this file only covers the page CHROME: hero copy,
   toolbar labels, counters, form copy.

   DE/PL/RU translations here are a first pass (not run past a professional
   translator) — flagged when this went live, same as the Case Studies copy
   and the FAQ Q&A content itself; happy to swap in reviewed copy later. */

export type FaqCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  heroTitlePart1: string;
  heroTitlePart2: string;
  heroTitlePart3Italic: string;
  heroLead: string;
  heroMeta: (questions: number, topics: number) => string;
  allChipLabel: string;
  questionsCount: (n: number) => string;
  expandAll: string;
  collapseAll: string;
  categoriesAriaLabel: string;
  formTitlePlain: string;
  formTitleItalic: string;
  formSubtitle: string;
};

export const FAQ_COPY: Record<string, FaqCopy> = {
  en: {
    metaTitle: "FAQ",
    metaDescription: "Answers to the questions we hear most from international buyers — foreigner eligibility, costs & VAT, residency, financing, and buying off-plan in Cyprus.",
    eyebrow: "Support",
    heroTitlePart1: "Frequently ",
    heroTitlePart2: "Asked ",
    heroTitlePart3Italic: "Questions",
    heroLead: "Straight answers to what international buyers ask us most — before, during and after purchasing property in Cyprus.",
    heroMeta: (q, t) => `${q} questions across ${t} topics`,
    allChipLabel: "All",
    questionsCount: (n) => `${n} questions`,
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    categoriesAriaLabel: "FAQ categories",
    formTitlePlain: "Still ",
    formTitleItalic: "have a question",
    formSubtitle: "Every buyer's situation is a little different. Send us yours and we'll answer it directly.",
  },
  de: {
    metaTitle: "Häufig gestellte Fragen",
    metaDescription: "Antworten auf die Fragen, die uns internationale Käufer am häufigsten stellen — Berechtigung für Ausländer, Kosten & MwSt., Aufenthalt, Finanzierung und der Kauf von Off-Plan-Immobilien in Zypern.",
    eyebrow: "Support",
    heroTitlePart1: "Häufig ",
    heroTitlePart2: "gestellte ",
    heroTitlePart3Italic: "Fragen",
    heroLead: "Klare Antworten auf das, was uns internationale Käufer am häufigsten fragen — vor, während und nach dem Immobilienkauf in Zypern.",
    heroMeta: (q, t) => `${q} Fragen in ${t} Themenbereichen`,
    allChipLabel: "Alle",
    questionsCount: (n) => `${n} Fragen`,
    expandAll: "Alle aufklappen",
    collapseAll: "Alle zuklappen",
    categoriesAriaLabel: "FAQ-Kategorien",
    formTitlePlain: "Noch ",
    formTitleItalic: "eine Frage",
    formSubtitle: "Jede Situation ist ein wenig anders. Schicken Sie uns Ihre Frage und wir beantworten sie direkt.",
  },
  pl: {
    metaTitle: "Najczęściej zadawane pytania",
    metaDescription: "Odpowiedzi na pytania, które najczęściej zadają nam międzynarodowi kupujący — uprawnienia dla cudzoziemców, koszty i VAT, pobyt, finansowanie oraz zakup nieruchomości off-plan na Cyprze.",
    eyebrow: "Wsparcie",
    heroTitlePart1: "Najczęściej ",
    heroTitlePart2: "zadawane ",
    heroTitlePart3Italic: "pytania",
    heroLead: "Konkretne odpowiedzi na pytania, które najczęściej zadają nam międzynarodowi kupujący — przed, w trakcie i po zakupie nieruchomości na Cyprze.",
    heroMeta: (q, t) => `${q} pytań w ${t} kategoriach`,
    allChipLabel: "Wszystkie",
    questionsCount: (n) => `${n} pytań`,
    expandAll: "Rozwiń wszystkie",
    collapseAll: "Zwiń wszystkie",
    categoriesAriaLabel: "Kategorie FAQ",
    formTitlePlain: "Masz ",
    formTitleItalic: "jeszcze pytanie",
    formSubtitle: "Sytuacja każdego kupującego jest inna. Napisz do nas, a odpowiemy bezpośrednio.",
  },
  ru: {
    metaTitle: "Часто задаваемые вопросы",
    metaDescription: "Ответы на вопросы, которые чаще всего задают нам иностранные покупатели — право на покупку для иностранцев, расходы и НДС, вид на жительство, финансирование и покупка недвижимости на этапе строительства на Кипре.",
    eyebrow: "Поддержка",
    heroTitlePart1: "Часто ",
    heroTitlePart2: "задаваемые ",
    heroTitlePart3Italic: "вопросы",
    heroLead: "Прямые ответы на вопросы, которые чаще всего задают нам иностранные покупатели — до, во время и после покупки недвижимости на Кипре.",
    heroMeta: (q, t) => `${q} вопросов в ${t} разделах`,
    allChipLabel: "Все",
    questionsCount: (n) => `${n} вопросов`,
    expandAll: "Развернуть все",
    collapseAll: "Свернуть все",
    categoriesAriaLabel: "Категории FAQ",
    formTitlePlain: "Остался ",
    formTitleItalic: "вопрос",
    formSubtitle: "Ситуация каждого покупателя немного отличается. Напишите нам, и мы ответим лично вам.",
  },
};

export function faqCopy(lang: string): FaqCopy {
  return FAQ_COPY[lang] ?? FAQ_COPY.en;
}
