// Centralised SEO/URL helpers. English is the default locale and is served
// WITHOUT a URL prefix (`localePrefix: "as-needed"` in middleware.ts); de/pl/ru
// carry their prefix. So canonical/hreflang/og URLs are prefix-less for English
// (`/blog/x`) and `/{lang}/...` for the others. The production domain is
// hard-coded (NEXT_PUBLIC_SITE_URL is build-time inlined to :3000 on the VPS).

import { localizedHref, LOCALES } from "./locale";

export const SITE_URL = "https://cyprusvipestates.com";

// Site-wide fallback Open Graph image (brand mark). Used for pages that don't have
// their own preview image (homepage, listings, static pages). TODO(owner): replace
// with a dedicated 1200×630 branded OG banner for richer social previews.
export const DEFAULT_OG_IMAGE = `${SITE_URL}/uploads/images/862e62ebddfc232ff9838efb63eb28685b515eb4-400x208.png`;

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
  for (const l of LOCALES) languages[l] = abs(localizedHref(l, segments));
  return { canonical: abs(localizedHref(lang, segments)), languages: { ...languages, "x-default": languages["en"] } };
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
