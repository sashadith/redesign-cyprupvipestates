// Pure, client-safe locale URL helpers — the single source of truth for building
// localized hrefs across server + client components, canonical/hreflang URLs, and
// sitemaps. English is the default locale and has NO URL prefix; de/pl/ru are
// prefixed. (Do NOT import i18n.config here — it pulls next-intl/server, which is
// server-only and would break client components.)

export const DEFAULT_LOCALE = "en";
export const LOCALES = ["en", "de", "pl", "ru"] as const;

/** URL prefix for a locale: "" for the default (en), "/de" | "/pl" | "/ru" otherwise. */
export function localePrefix(lang: string): string {
  return lang === DEFAULT_LOCALE ? "" : `/${lang}`;
}

/**
 * Build a localized, site-relative href. The default locale (en) is prefix-less.
 *   localizedHref("en")                 -> "/"
 *   localizedHref("de")                 -> "/de"
 *   localizedHref("en", "blog/x")       -> "/blog/x"
 *   localizedHref("de", ["blog", "x"])  -> "/de/blog/x"
 *   localizedHref("en", "/projects/y")  -> "/projects/y"
 */
export function localizedHref(lang: string, segments: string | string[] = ""): string {
  const tail = (Array.isArray(segments) ? segments : [segments])
    .flatMap((s) => String(s ?? "").split("/"))
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
  const prefix = localePrefix(lang);
  if (!tail) return prefix || "/";
  return `${prefix}/${tail}`;
}

/**
 * Is `lang` one of the four real locales?
 *
 * Next fills a `[lang]` route segment with whatever the URL contained, so any
 * unmatched multi-segment path (/api/x, /og/x, /admin/x — every prefix the
 * middleware matcher excludes) reaches the `[lang]/…` routes with a junk value.
 * Passing that to Prisma as a `Locale` throws a validation error rather than
 * returning no rows, which turned those URLs into 500s instead of 404s. Guard
 * with this before a `lang` is used as a locale.
 */
export function isLocale(lang: string): lang is (typeof LOCALES)[number] {
  return (LOCALES as readonly string[]).includes(lang);
}
