import { GUIDE_LANGS, type GuideLang } from "./guides/types";

/** The free-guides page has a translated slug per language, like the corporate pages (about, contacts ...).
 *  Hebrew has no guides, so it has no page. Middleware rewrites each of these to /preview-guides/<lang>. */
export const GUIDES_PAGE_SLUG: Record<GuideLang, string> = {
  en: "guides",
  de: "ratgeber",
  pl: "poradniki",
  ru: "gajdy",
};

/** Site-relative path of the guides page in one language (unknown languages, e.g. Hebrew, get the English page). */
export function guidesPagePath(lang: string): string {
  const l = (GUIDE_LANGS as readonly string[]).includes(lang) ? (lang as GuideLang) : "en";
  return l === "en" ? `/${GUIDES_PAGE_SLUG.en}` : `/${l}/${GUIDES_PAGE_SLUG[l]}`;
}

/** `/guides`, `/de/ratgeber`, `/pl/poradniki`, `/ru/gajdy` (a trailing slash is tolerated) -> its language, else null. */
export function guidesPageLang(pathname: string): GuideLang | null {
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 1 && segs[0] === GUIDES_PAGE_SLUG.en) return "en";
  if (segs.length === 2) {
    for (const l of GUIDE_LANGS) if (l !== "en" && segs[0] === l && segs[1] === GUIDES_PAGE_SLUG[l]) return l;
  }
  return null;
}

/** Shape languageAlternates() expects: one entry per language that has the page. */
export function guidesPageTranslations() {
  return GUIDE_LANGS.map((l) => ({ slug: { [l]: { current: GUIDES_PAGE_SLUG[l] } } }));
}

export type HreflangAlt = { hreflang: string; href: string };

/** hreflang alternates for the sitemap: every language that has the page, plus x-default (English). */
export function guidesPageAlternates(buildUrl: (path: string) => string): HreflangAlt[] {
  const alts: HreflangAlt[] = GUIDE_LANGS.map((l) => ({ hreflang: l, href: buildUrl(guidesPagePath(l)) }));
  alts.push({ hreflang: "x-default", href: buildUrl(guidesPagePath("en")) });
  return alts;
}
