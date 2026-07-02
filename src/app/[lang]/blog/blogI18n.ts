// Fixed UI labels for the blog listing (insights design). The authored page
// title / description / SEO content still come from the per-language `blogPage`
// document — these are only the small UI strings the preview hardcoded in
// English (eyebrow, "articles", filter "All", "Read", pager a11y labels, the
// guide header) now localized for en/de/pl/ru.

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
};

export const BLOG_STRINGS: Record<string, BlogStrings> = {
  en: EN,
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
  },
};

export const blogStrings = (lang: string): BlogStrings => BLOG_STRINGS[lang] ?? EN;
