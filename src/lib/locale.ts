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

/**
 * Parses a locale OUT OF a path, against the full known set (`LOCALES`), not
 * `PUBLIC_LOCALES` — a `/he/...` URL is Hebrew whether or not `he` is
 * currently gated by `NEXT_PUBLIC_LIVE_LOCALES` (e.g. GSC/analytics data
 * recorded before or during the gate, or a direct hit on a not-yet-routed
 * path). Recognises a prefixed path (`/xx/...`) or a bare prefix root
 * (`/xx`); anything else — including the unprefixed default locale's own
 * paths — is "en". Pure: no env access, so it is safe to call at parse time
 * from both server and client code.
 *
 *   localeFromPath("/de/projects/x") -> "de"
 *   localeFromPath("/de")            -> "de"
 *   localeFromPath("/he")            -> "he" (even while he is gated)
 *   localeFromPath("/x")             -> "en"
 */
export function localeFromPath(path: string): Locale {
  for (const l of LOCALES) {
    if (l === DEFAULT_LOCALE) continue;
    if (path === `/${l}` || path.startsWith(`/${l}/`)) return l;
  }
  return DEFAULT_LOCALE as Locale;
}

/** Prices use Western digits in every locale (Israeli convention too).
 *  EUR renders as "€1,234"; any other currency as "USD 1,234" (ISO code +
 *  space + grouped number) — there's no per-currency symbol table here, just
 *  the one non-EUR case the feeds actually carry. `_lang` is unused today
 *  (digits/grouping don't vary by locale) but kept so call sites don't need
 *  to change if that ever does. */
export function fmtPrice(n: number, _lang: string, currency: string = "EUR"): string {
  const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  return currency === "EUR" ? `€${grouped}` : `${currency} ${grouped}`;
}

/** Wrap a plain string (phone/e-mail/price inside otherwise-Hebrew copy) in
 *  LRI…PDI (U+2066…U+2069) so it renders left-to-right and doesn't get
 *  visually reordered by the surrounding RTL paragraph. For JSX values,
 *  prefer <Bdi ltr> (src/app/components/Bdi.tsx) instead. */
export function ltrIsolate(s: string): string {
  return `⁦${s}⁩`;
}

/** Wrap a plain string (a Latin name inside an otherwise-Hebrew generated
 *  sentence) in FSI…PDI (U+2068…U+2069) so it isolates from the surrounding
 *  bidi context without forcing a direction — the run keeps its own natural
 *  (LTR) direction, unlike ltrIsolate's LRI which pins direction too. For
 *  JSX values, prefer <Bdi> (src/app/components/Bdi.tsx) instead. */
export function bidiIsolate(s: string): string {
  return `⁨${s}⁩`;
}

/** The one sentence Entscheidung E prescribes (he-glossary.md §5): nobody on
 *  the team speaks Hebrew, and every automated Hebrew surface that offers a
 *  call, a meeting or a reply has to say so before the lead finds out on the
 *  phone. Exported as a constant so the four independent carriers (auto-reply
 *  mail, ROI mail, booking page, presentation page) can never drift apart
 *  (styleguide §11.6) — Pass B "Systemic" S-C. */
export const HE_LANGUAGE_NOTE =
  "הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.";

/**
 * Attaches a one-letter Hebrew preposition (`ב` "on/in", `ל` "for/to") to an
 * already-formatted date or time string.
 *
 * Hebrew writes the prefix **glued, without a hyphen** before a Hebrew word,
 * and **with a hyphen** before a numeral or a Latin word (styleguide §3). An
 * `he-IL` Intl date starts with a Hebrew weekday (`יום ד׳, 14 באוק׳, 15:00`),
 * so the naive `ב-${dt}` produced `ב-יום ד׳` — a hyphen before a Hebrew word,
 * which does not exist in Hebrew (Pass B, Must fix #6/#7).
 *
 *   hePrefixDate("ב", "יום ד׳, 14 באוק׳, 15:00")  → "ביום ד׳, 14 באוק׳, 15:00"
 *   hePrefixDate("ל", "14/10/2026, 15:00")        → "ל-⁦14/10/2026, 15:00⁩"
 *
 * The non-Hebrew branch is LRI-isolated so the digits cannot be visually
 * reordered by the surrounding RTL sentence (same treatment as heBedrooms()).
 * `he`-only — every LTR locale keeps its own plain interpolation.
 */
export function hePrefixDate(prefix: string, formatted: string): string {
  const value = String(formatted ?? "");
  const first = value.trimStart().charAt(0);
  return /[\u0590-\u05FF]/.test(first) ? `${prefix}${value}` : `${prefix}-${ltrIsolate(value)}`;
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
