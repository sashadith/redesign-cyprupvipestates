// Sibling copy module for developers/page.tsx — lifted from a
// `lang === "de" ? … : …` ternary chain (Hebrew Localization Phase 4, WP4).
//
// `sub` stays the short hero tagline; `metaDescription` and `intro` were added
// 2026-09-11 — this page previously had zero body copy (hero + card grid
// only) and reused `sub`'s single sentence as its metaDescription too. RU's
// GSC data specifically showed real, un-served demand for generic "developers
// in Limassol/Cyprus" queries (not brand-name searches) landing here and on
// individual /developers/[slug] pages, at weak positions — this index page
// had nothing on it to support that intent. `intro` is genuinely informative
// (what "vetted" means, direct-partner/no-markup positioning already
// established on the About page), not filler, and written for all locales
// together since this component is shared across them.
//
// `title` is both the <title> and the H1: withAccent() in page.tsx gold-accents
// its LAST word, which is the country in every locale, Hebrew included.
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const DEVELOPERS_PAGE_EN = {
  title: "Developers in Cyprus",
  sub: "We work with the best property developers in Cyprus.",
  metaDescription: "Every developer Cyprus VIP Estates partners with directly — from major international builders to boutique studios in Limassol and Paphos. Current projects, prices, and buying terms for each developer.",
  intro: [
    "We work directly with Cyprus's leading property developers — from major international builders to boutique studios specializing in premium homes in Limassol and Paphos. Every developer listed here has been vetted: clean legal title on their projects, a real delivery track record, and an active current portfolio.",
    "Below is the full list of developers we partner with directly, at no markup to the buyer. Each has its own page with current projects, prices, and buying terms.",
  ],
  projects: "projects",
};

export const DEVELOPERS_PAGE_COPY: Record<Locale, typeof DEVELOPERS_PAGE_EN> = {
  en: DEVELOPERS_PAGE_EN,
  de: {
    title: "Bauträger auf Zypern",
    sub: "Wir arbeiten mit den besten Bauträgern Zyperns zusammen.",
    metaDescription: "Alle Bauträger, mit denen Cyprus VIP Estates direkt zusammenarbeitet — von internationalen Entwicklern bis zu Boutique-Studios in Limassol und Paphos. Aktuelle Projekte, Preise und Kaufbedingungen je Bauträger.",
    intro: [
      "Wir arbeiten direkt mit den führenden Bauträgern Zyperns zusammen — von großen internationalen Entwicklern bis zu spezialisierten Studios für Premium-Wohnimmobilien in Limassol und Paphos. Jeder hier gelistete Bauträger wurde geprüft: einwandfreier rechtlicher Titel der Projekte, nachweisliche Erfahrung bei der Fertigstellung und ein aktuelles Portfolio.",
      "Unten finden Sie die vollständige Liste der Bauträger, mit denen wir direkt zusammenarbeiten — ohne Aufschlag für den Käufer. Jeder hat eine eigene Seite mit aktuellen Projekten, Preisen und Kaufbedingungen.",
    ],
    projects: "Projekte",
  },
  ru: {
    title: "Застройщики на Кипре",
    sub: "Мы работаем с лучшими застройщиками Кипра.",
    metaDescription: "Все застройщики, с которыми Cyprus VIP Estates работает напрямую — от крупных международных девелоперов до бутик-студий в Лимассоле и Пафосе. Актуальные проекты, цены и условия покупки по каждому застройщику.",
    intro: [
      "Мы напрямую сотрудничаем с ведущими застройщиками Кипра — от крупных международных девелоперов до локальных студий премиального жилья в Лимассоле и Пафосе. Каждый застройщик в этом каталоге проверен: юридическая чистота проектов, реальный опыт сдачи объектов и актуальный портфель.",
      "Ниже — полный список застройщиков, с которыми мы работаем напрямую, без наценки для покупателя. У каждого — отдельная страница с текущими проектами, ценами и условиями покупки.",
    ],
    projects: "проектов",
  },
  pl: {
    title: "Deweloperzy na Cyprze",
    sub: "Współpracujemy z najlepszymi deweloperami na Cyprze.",
    metaDescription: "Wszyscy deweloperzy, z którymi Cyprus VIP Estates współpracuje bezpośrednio — od dużych międzynarodowych firm po butikowe studia w Limassol i Pafos. Aktualne projekty, ceny i warunki zakupu przy każdym deweloperze.",
    intro: [
      "Współpracujemy bezpośrednio z czołowymi deweloperami na Cyprze — od dużych międzynarodowych firm po butikowe studia specjalizujące się w nieruchomościach premium w Limassol i Pafos. Każdy deweloper na tej liście został zweryfikowany: czysty tytuł prawny projektów, realne doświadczenie w oddawaniu inwestycji i aktualne portfolio.",
      "Poniżej pełna lista deweloperów, z którymi współpracujemy bezpośrednio, bez marży dla kupującego. Każdy ma własną stronę z aktualnymi projektami, cenami i warunkami zakupu.",
    ],
    projects: "projektów",
  },
  he: { // REVIEW(he)
    title: "יזמי נדל\"ן בקפריסין",
    sub: "אנחנו עובדים עם היזמים המובילים בקפריסין.",
    metaDescription: "כל היזמים שאנחנו עובדים איתם ישירות בקפריסין, מחברות בנייה בינלאומיות ועד סטודיו בוטיק בלימסול ובפאפוס. פרויקטים, מחירים ותנאי רכישה מעודכנים.",
    intro: [
      "אנחנו עובדים ישירות עם חברות הבנייה המובילות בקפריסין, מגופים בינלאומיים גדולים ועד סטודיו בוטיק שמתמחים בבתים ברמה גבוהה בלימסול ובפאפוס. כל יזם שמופיע כאן עבר אצלנו בדיקה: טאבו נקי לפרויקטים, היסטוריית מסירה אמיתית ותיק נכסים מעודכן.",
      "למטה הרשימה המלאה של היזמים שאנחנו עובדים איתם ישירות, בלי תוספת מחיר לרוכש. לכל אחד יש עמוד משלו עם הפרויקטים הזמינים, המחירים ותנאי הרכישה.",
    ],
    projects: "פרויקטים",
  },
};

export const developersPageCopy = (lang: string) =>
  DEVELOPERS_PAGE_COPY[isLocale(lang) ? lang : "en"];
