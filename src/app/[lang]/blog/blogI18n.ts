// Fixed UI labels for the blog listing (insights design). The authored page
// title / description / SEO content still come from the per-language `blogPage`
// document — these are only the small UI strings the preview hardcoded in
// English (eyebrow, "articles", filter "All", "Read", pager a11y labels, the
// guide header) now localized for en/de/pl/ru.

import type { Locale } from "@/lib/locale";

export type BlogStrings = {
  // compact hero heading (visual H1, like the preview's "Cyprus Insights").
  // Last word is gold-accented. The SEO <title> still comes from the blogPage doc.
  heroTitle: string;
  eyebrow: string;
  articleOne: string; // singular noun, shown after the count
  articleMany: string; // plural noun
  filterAll: string;
  read: string; // card CTA
  readArticle: string; // featured CTA
  categoriesAria: string;
  pagerAria: string;
  firstPage: string;
  lastPage: string;
  pageWord: string; // "Page" → aria-label "Page {n}"
  empty: string;
  guideEyebrow: string;
  guideTitle: string;
  dateLocale: string; // Intl locale for the article date
  // single-article (insights) UI strings
  minRead: string; // "{n} min read"
  tocLabel: string; // sticky table-of-contents label
  writtenBy: string; // author card label
  relatedLead: string; // related section title, first part
  relatedAccent: string; // related section title, gold-accented word
  // Heading for the properties block an article falls back to when it carries
  // no editor-inserted Projects block of its own (see the blog route). The
  // {city} variant is used when the article's title/slug names one of the three
  // cities the projects filter knows.
  fallbackProperties: string;
  fallbackPropertiesInCity: string; // contains the literal placeholder {city}
  // Phase 6 cross-locale badge: shown on every card/featured item when /he/blog
  // is rendering EN articles (blogIndexMode's sourceLang !== the route locale).
  englishBadge: string;
};

const EN: BlogStrings = {
  heroTitle: "Cyprus Insights",
  eyebrow: "The Journal",
  articleOne: "article",
  articleMany: "articles",
  filterAll: "All",
  read: "Read",
  readArticle: "Read article",
  categoriesAria: "Categories",
  pagerAria: "Blog pagination",
  firstPage: "First page",
  lastPage: "Last page",
  pageWord: "Page",
  empty: "No articles yet.",
  guideEyebrow: "The Guide",
  guideTitle: "Inside the Journal",
  dateLocale: "en-GB",
  minRead: "min read",
  tocLabel: "On this page",
  writtenBy: "Written by",
  relatedLead: "Related",
  relatedAccent: "reading",
  fallbackProperties: "Recommended properties",
  fallbackPropertiesInCity: "Recommended properties in {city}",
  englishBadge: "In English",
};

export const BLOG_STRINGS: Record<Locale, BlogStrings> = {
  en: EN,
  // REVIEW(he)
  // /he/blog lists the ENGLISH articles (product decision: they are not
  // translated); `articleOne`/`articleMany` carry that fact in the hero count
  // line so the Hebrew chrome states it calmly instead of letting a reader
  // click into an unexpected language. `he` is excluded from the sitemap and
  // from hreflang (LAUNCH_GATED_LOCALES) but carries NO noindex meta today,
  // and the route still queries `language: "he"` rows — which posts /he/blog
  // lists, and whether it should be noindexed, is a Phase 6 route question,
  // not a copy one. The hero count line therefore has to read correctly at 0
  // articles too; BlogInsights.tsx carries the Hebrew-only branch for that.
  // See docs/i18n/reviews/wp4.md.
  he: {
    heroTitle: "תובנות מקפריסין",
    eyebrow: "הבלוג",
    articleOne: "מאמר אחד באנגלית", // rendered WITHOUT the numeral for he (see BlogInsights.tsx)
    articleMany: "מאמרים באנגלית",
    filterAll: "הכל",
    read: "לקריאה",
    readArticle: "לקריאת המאמר",
    categoriesAria: "קטגוריות",
    pagerAria: "ניווט בין עמודי הבלוג",
    firstPage: "מעבר לעמוד הראשון",
    lastPage: "מעבר לעמוד האחרון",
    pageWord: "עמוד",
    empty: "אין עדיין מאמרים.",
    guideEyebrow: "המדריך",
    guideTitle: "נדל\"ן בקפריסין, בקצרה",
    dateLocale: "he-IL",
    minRead: "דקות קריאה", // n >= 2 only — blog/[slug]/page.tsx renders the n = 1 form
    tocLabel: "תוכן העניינים",
    writtenBy: "מאת",
    relatedLead: "עוד",
    relatedAccent: "מאמרים",
    fallbackProperties: "נכסים מומלצים",
    // {city} is substituted with the LATIN city name (Paphos/Limassol/Larnaca)
    // by the blog route, so it is FSI/PDI isolated here (bidiIsolate) and the
    // preposition takes the hyphen form the style guide §3 prescribes.
    fallbackPropertiesInCity: "נכסים מומלצים ב-\u2068{city}\u2069",
    // REVIEW(he)
    englishBadge: "באנגלית",
  },
  de: {
    heroTitle: "Zypern Insights",
    eyebrow: "Das Journal",
    articleOne: "Artikel",
    articleMany: "Artikel",
    filterAll: "Alle",
    read: "Lesen",
    readArticle: "Artikel lesen",
    categoriesAria: "Kategorien",
    pagerAria: "Blog-Seitennummerierung",
    firstPage: "Erste Seite",
    lastPage: "Letzte Seite",
    pageWord: "Seite",
    empty: "Noch keine Artikel.",
    guideEyebrow: "Der Leitfaden",
    guideTitle: "Über das Journal",
    dateLocale: "de-DE",
    minRead: "Min. Lesezeit",
    tocLabel: "Auf dieser Seite",
    writtenBy: "Geschrieben von",
    relatedLead: "Ähnliche",
    relatedAccent: "Beiträge",
    fallbackProperties: "Empfohlene Objekte",
    fallbackPropertiesInCity: "Empfohlene Objekte in {city}",
    englishBadge: "Auf Englisch",
  },
  pl: {
    heroTitle: "Cypr Insights",
    eyebrow: "Dziennik",
    articleOne: "artykuł",
    articleMany: "artykuły",
    filterAll: "Wszystkie",
    read: "Czytaj",
    readArticle: "Czytaj artykuł",
    categoriesAria: "Kategorie",
    pagerAria: "Paginacja bloga",
    firstPage: "Pierwsza strona",
    lastPage: "Ostatnia strona",
    pageWord: "Strona",
    empty: "Brak artykułów.",
    guideEyebrow: "Przewodnik",
    guideTitle: "W dzienniku",
    dateLocale: "pl-PL",
    minRead: "min czytania",
    tocLabel: "Na tej stronie",
    writtenBy: "Autor",
    relatedLead: "Powiązane",
    relatedAccent: "artykuły",
    fallbackProperties: "Polecane nieruchomości",
    fallbackPropertiesInCity: "Polecane nieruchomości w {city}",
    englishBadge: "Po angielsku",
  },
  ru: {
    heroTitle: "Кипр Инсайты",
    eyebrow: "Журнал",
    articleOne: "статья",
    articleMany: "статей",
    filterAll: "Все",
    read: "Читать",
    readArticle: "Читать статью",
    categoriesAria: "Категории",
    pagerAria: "Навигация по страницам блога",
    firstPage: "Первая страница",
    lastPage: "Последняя страница",
    pageWord: "Страница",
    empty: "Пока нет статей.",
    guideEyebrow: "Гид",
    guideTitle: "О Журнале",
    dateLocale: "ru-RU",
    minRead: "мин чтения",
    tocLabel: "На этой странице",
    writtenBy: "Автор",
    relatedLead: "Похожие",
    relatedAccent: "статьи",
    fallbackProperties: "Рекомендуемые объекты",
    fallbackPropertiesInCity: "Рекомендуемые объекты в {city}",
    englishBadge: "На английском",
  },
};

export const blogStrings = (lang: string): BlogStrings => BLOG_STRINGS[lang as Locale] ?? EN;
