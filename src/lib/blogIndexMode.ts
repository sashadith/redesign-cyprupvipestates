// Phase 6 — cross-locale Hebrew blog index. `he` has no Hebrew articles yet,
// so /he/blog shows the ENGLISH articles (with an "In English" badge) until
// the locale has at least MIN_OWN_ARTICLES articles of its own; while it
// borrows English content it is also noindex'd and excluded from the sitemap.
// Pure helpers — no I/O — so BlogInsights.tsx, page.tsx (+ pagination route)
// and the sitemap route all derive the same decision from the same published
// he-count. See docs/superpowers/plans/2026-09-13-hebrew-phase5-content.md
// Task 8 and docs/i18n/reviews/wp4.md "Offene Punkte" #1.

const MIN_OWN_ARTICLES = 5;

export type BlogIndexMode = {
  /** Which locale's articles the index actually renders. */
  sourceLang: string;
  /** True while the index is showing borrowed (non-own-locale) content. */
  noindex: boolean;
};

/**
 * `lang` is the route locale being rendered; `heCount` is the number of
 * PUBLISHED `he`-language blog rows (ignored for any `lang !== "he"`).
 */
export function blogIndexMode(lang: string, heCount: number): BlogIndexMode {
  if (lang === "he" && heCount < MIN_OWN_ARTICLES) {
    return { sourceLang: "en", noindex: true };
  }
  return { sourceLang: lang, noindex: false };
}

/** Whether the blog index for `lang` should be advertised in the sitemap. */
export function blogIndexInSitemap(lang: string, heCount: number): boolean {
  return !blogIndexMode(lang, heCount).noindex;
}
