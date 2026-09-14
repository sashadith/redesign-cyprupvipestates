// Centralised SEO/URL helpers. English is the default locale and is served
// WITHOUT a URL prefix (`localePrefix: "as-needed"` in middleware.ts); de/pl/ru
// (/he when live) carry their prefix. So canonical/hreflang/og URLs are
// prefix-less for English (`/blog/x`) and `/{lang}/...` for the others. The
// production domain is hard-coded (NEXT_PUBLIC_SITE_URL is build-time inlined
// to :3000 on the VPS).

import { localizedHref, PUBLIC_LOCALES, BCP47 } from "./locale";
import { blogIndexInSitemap } from "./blogIndexMode";

export const SITE_URL = "https://cyprusvipestates.com";

// Site-wide fallback Open Graph image (branded 1200×630 banner). Used for pages
// that don't have their own preview image (homepage, listings, static pages).
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og/home-1200x630.jpg`;
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;

/** Turn a site-relative path (or asset path) into an absolute URL. */
export function abs(path?: string | null): string {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Build a localized path. English (default) is prefix-less; de/pl/ru are
 * prefixed. `/` (en home) · `/de` (de home) · `/blog/x` (en) · `/de/blog/x`.
 */
export function localizedPath(lang: string, segments: string | string[] = ""): string {
  return localizedHref(lang, segments);
}

type TranslationSlug = {
  slug?: Record<string, { current?: string } | undefined> | null;
};

/**
 * Build `alternates` (canonical + hreflang `languages`) for a localized page.
 * `pathFor(lang, slug)` maps a per-language slug to its site-relative path
 * (e.g. `/de/blog/x`). `translations` is the `_translations` array, shaped
 * `{ slug: { [lang]: { current } } }`. x-default points at English when present.
 */
export function languageAlternates(opts: {
  lang: string;
  slug: string;
  pathFor: (lang: string, slug: string) => string;
  translations?: TranslationSlug[] | null;
}): { canonical: string; languages: Record<string, string> } {
  const { lang, slug, pathFor, translations } = opts;
  const languages: Record<string, string> = {};
  languages[lang] = abs(pathFor(lang, slug));

  for (const t of translations ?? []) {
    if (!t?.slug) continue;
    for (const [l, v] of Object.entries(t.slug)) {
      const cur = v?.current;
      if (l && cur && !languages[l]) languages[l] = abs(pathFor(l, cur));
    }
  }

  const canonical = languages[lang];

  for (const l of Object.keys(languages)) if (!(PUBLIC_LOCALES as readonly string[]).includes(l)) delete languages[l];

  return {
    canonical,
    languages: { ...languages, "x-default": languages["en"] ?? canonical },
  };
}

/**
 * Canonical + hreflang for a FIXED path that exists in every locale at the same
 * sub-path (listing roots, static pages) — i.e. no per-language slug translation.
 * x-default points at English.
 */
export function staticAlternates(
  lang: string,
  segments: string | string[] = "",
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const l of PUBLIC_LOCALES) languages[l] = abs(localizedHref(l, segments));
  return { canonical: abs(localizedHref(lang, segments)), languages: { ...languages, "x-default": languages["en"] } };
}

/**
 * `og:locale` value for a page's locale. Every existing `openGraph.locale`
 * call site in the app today interpolates the raw locale code directly
 * (`locale: lang` → "en"/"de"/"pl"/"ru"/"he"), which is not the OG-spec
 * format (a language_TERRITORY tag, e.g. "en_GB"). Retrofitting the correct
 * format for en/de/pl/ru is out of this task's scope and would change
 * LTR-visible metadata with no coverage here, so this returns the SAME raw
 * code, byte-identical, for every locale except `he` — which gets the
 * correct `he_IL` (BCP47.he = "he-IL", "-" → "_"). `he` is therefore the
 * only locale whose `og:locale` output changes.
 */
export function ogLocale(lang: string): string {
  if (lang === "he") return BCP47.he.replace("-", "_");
  return lang;
}

/**
 * Which locales a sitemap listing type should emit rows for. Every type
 * simply follows the given `publicLocales` set (default: `PUBLIC_LOCALES`)
 * — a locale that isn't live never gets a sitemap row, full stop — except
 * "blog": while `/he/blog` is borrowing English content (Phase 6, fewer
 * than 5 own PUBLISHED Hebrew articles) its index and articles stay
 * noindex'd and out of the sitemap (see blogIndexInSitemap). Each listing
 * type's own row-builder query (projects/blog/case-studies: `status:
 * "PUBLISHED"` in sanity.utils.ts; pages: `getAllPathsForLang`, same filter)
 * already restricts rows to PUBLISHED — that filtering happens at the data
 * layer, not duplicated here; this only decides the locale axis.
 */
export type SitemapListingType =
  | "projects"
  | "developers"
  | "blog"
  | "case-studies"
  | "pages"
  | "developments";

export function sitemapLocalesForType(
  type: SitemapListingType,
  opts: { publicLocales?: readonly string[]; heBlogCount?: number } = {},
): string[] {
  const locales = opts.publicLocales ?? PUBLIC_LOCALES;
  if (type !== "blog") return [...locales];
  return locales.filter((l) => blogIndexInSitemap(l, opts.heBlogCount ?? 0));
}

/** Path builders for the localized content types. */
export const pathBuilders = {
  blog: (lang: string, slug: string) => localizedPath(lang, ["blog", slug]),
  project: (lang: string, slug: string) =>
    localizedPath(lang, ["projects", slug]),
  caseStudy: (lang: string, slug: string) =>
    localizedPath(lang, ["case-studies", slug]),
  topLevel: (lang: string, slug: string) => localizedPath(lang, [slug]),
};
