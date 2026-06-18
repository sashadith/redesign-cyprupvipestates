// Centralised SEO/URL helpers. All locales use explicit URL prefixes
// (`localePrefix: "always"` in middleware.ts), so every canonical/hreflang/og
// URL is `/{lang}/...` for ALL four languages — including German, whose old
// prefix-less paths now 301-redirect to `/de/...`. The production domain is
// hard-coded (NEXT_PUBLIC_SITE_URL is build-time inlined to :3000 on the VPS).

export const SITE_URL = "https://cyprusvipestates.com";

/** Turn a site-relative path (or asset path) into an absolute URL. */
export function abs(path?: string | null): string {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Build a localized path: `/{lang}` or `/{lang}/seg/seg…`. */
export function localizedPath(lang: string, segments: string | string[] = ""): string {
  const tail = Array.isArray(segments)
    ? segments.filter(Boolean).join("/")
    : segments;
  return tail ? `/${lang}/${tail}` : `/${lang}`;
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

/** Path builders for the localized content types. */
export const pathBuilders = {
  blog: (lang: string, slug: string) => localizedPath(lang, ["blog", slug]),
  project: (lang: string, slug: string) =>
    localizedPath(lang, ["projects", slug]),
  caseStudy: (lang: string, slug: string) =>
    localizedPath(lang, ["case-studies", slug]),
  topLevel: (lang: string, slug: string) => localizedPath(lang, [slug]),
};
