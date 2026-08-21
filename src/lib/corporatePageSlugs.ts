/* Slug maps for the four "corporate" pages (About / Contacts / Privacy /
   Terms). Unlike /partners, /faq or /case-studies — whose paths are identical
   in every locale and therefore use staticAlternates() — these four have a
   TRANSLATED slug per language, exactly as stored in the singlepages table
   (verified against the DB, 2026-08-21). Both middleware.ts (to rewrite the
   public URL onto the redesigned route tree) and each page's
   generateMetadata (to build canonical + hreflang via languageAlternates)
   read the same map here, so the two can never drift apart.

   Keep in sync with the DB: if an editor ever renames one of these slugs in
   the admin, the rewrite below stops matching and the page falls back to the
   OLD block-rendered singlepage route — visibly the pre-redesign design,
   not a 404, so it fails soft rather than hard. */

export const CORPORATE_LOCALES = ["en", "de", "pl", "ru"] as const;
export type CorporateLocale = (typeof CORPORATE_LOCALES)[number];

export type CorporatePage = "about" | "contacts" | "privacy" | "terms";

export const CORPORATE_SLUGS: Record<CorporatePage, Record<CorporateLocale, string>> = {
  about: { en: "about-us", de: "ueber-uns", pl: "o-nas", ru: "o-nas" },
  contacts: { en: "contacts", de: "kontakt", pl: "kontakty", ru: "kontakty" },
  privacy: {
    en: "privacy-policy",
    de: "datenschutzrichtlinie",
    pl: "polityka-prywatnosci",
    ru: "politika-privatnosti",
  },
  terms: {
    en: "terms-and-conditions",
    de: "geschaftsbedingungen",
    pl: "warunki",
    ru: "uslovija-i-polozhenija",
  },
};

/** Public path for a corporate page in one locale ("/ueber-uns", "/about-us"). */
export function corporatePath(page: CorporatePage, lang: string): string {
  const l = (CORPORATE_LOCALES as readonly string[]).includes(lang) ? (lang as CorporateLocale) : "en";
  const slug = CORPORATE_SLUGS[page][l];
  return l === "en" ? `/${slug}` : `/${l}/${slug}`;
}

/** Shape languageAlternates() expects: one entry per locale carrying its own slug. */
export function corporateTranslations(page: CorporatePage) {
  return CORPORATE_LOCALES.map((l) => ({
    slug: { [l]: { current: CORPORATE_SLUGS[page][l] } },
  }));
}
