// Pure, client-safe locale URL helpers — the single source of truth for building
// localized hrefs across server + client components, canonical/hreflang URLs, and
// sitemaps. en/de/pl/ru/he; `he` is RTL; see PUBLIC_LOCALES for what is live.
// English is the default locale and has NO URL prefix; others are prefixed.
// (Do NOT import i18n.config here — it pulls next-intl/server, which is server-only
// and would break client components.)

export const DEFAULT_LOCALE = "en";
/** Every locale the code and the DB know. Adding here = Prisma enum + admin + validation. */
export const LOCALES = ["en", "de", "pl", "ru", "he"] as const;
export type Locale = (typeof LOCALES)[number];

/** Locales that exist but are NOT routed/advertised until the operator flips
 *  NEXT_PUBLIC_LIVE_LOCALES. Keeps a forgotten env var from launching a locale. */
export const LAUNCH_GATED_LOCALES: readonly Locale[] = ["he"];
export const RTL_LOCALES: readonly Locale[] = ["he"];

export function parsePublicLocales(raw: string | undefined): Locale[] {
  const known = LOCALES as readonly string[];
  const listed = raw
    ? raw.split(",").map((s) => s.trim()).filter((s): s is Locale => known.includes(s))
    : LOCALES.filter((l) => !LAUNCH_GATED_LOCALES.includes(l));
  // The default locale is never gated away, whatever the env var says.
  const out = listed.includes(DEFAULT_LOCALE as Locale) ? listed : [DEFAULT_LOCALE as Locale, ...listed];
  // canonical LOCALES order, deduplicated
  return LOCALES.filter((l) => out.includes(l));
}

/** Locales visible to visitors and search engines: routing, hreflang, sitemaps,
 *  language switcher, static params, IndexNow. Build-time inlined (NEXT_PUBLIC_). */
export const PUBLIC_LOCALES: readonly Locale[] = parsePublicLocales(process.env.NEXT_PUBLIC_LIVE_LOCALES);

export function isLocale(lang: string): lang is Locale {
  return (LOCALES as readonly string[]).includes(lang);
}
export function isPublicLocale(lang: string): lang is Locale {
  return (PUBLIC_LOCALES as readonly string[]).includes(lang);
}
export function localeDir(lang: string): "rtl" | "ltr" {
  return (RTL_LOCALES as readonly string[]).includes(lang) ? "rtl" : "ltr";
}

export const BCP47: Record<Locale, string> = {
  en: "en-GB", de: "de-DE", pl: "pl-PL", ru: "ru-RU", he: "he-IL",
};

export const LOCALE_LABELS: Record<Locale, { code: string; name: string }> = {
  en: { code: "EN", name: "English" },
  de: { code: "DE", name: "Deutsch" },
  pl: { code: "PL", name: "Polski" },
  ru: { code: "RU", name: "Русский" },
  he: { code: "HE", name: "עברית" },
};

/** "de|pl|ru|he" — for the middleware/SEO regexes that used to hard-code (de|pl|ru). */
export function nonDefaultLocalePattern(locales: readonly string[] = LOCALES): string {
  return locales.filter((l) => l !== DEFAULT_LOCALE).join("|");
}

/** Prices are EUR with Western digits in every locale (Israeli convention too). */
export function fmtPrice(n: number, _lang: string): string {
  return `€${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)}`;
}

export function fmtDate(value: string | Date, lang: string, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const tag = isLocale(lang) ? BCP47[lang] : BCP47.en;
  return new Intl.DateTimeFormat(tag, opts).format(d);
}

/** URL prefix for a locale: "" for the default (en), "/de" | "/pl" | "/ru" | "/he" otherwise. */
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
