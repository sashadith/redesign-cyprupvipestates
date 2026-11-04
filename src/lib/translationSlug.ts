/* A slug belongs to the language of its page. Blog posts, landing pages and case studies carry one slug PER
   language (/de/blog/steuern-auf-immobilien-in-zypern, /pl/blog/podatki-od-nieruchomosci-na-cyprze); a translation
   that keeps the source language's slug creates a URL like /de/blog/<polish-slug>, which can only ever redirect.
   Search Console listed 144 such URLs under "Page with redirect" (2026-10-23).

   The leak was createTranslation (admin/actions.ts): it copied the SOURCE slug into the new translation. A new
   translation now gets a placeholder slug, and publishing (or scheduling) is refused while the slug is still a
   placeholder or identical to a sibling's in another language.

   Not covered on purpose: projects and developers (their slugs are Latin names shared by every locale, decision A),
   and the cases below where the same slug in two languages is correct.
   Pure and dependency-light so it can be asserted without a database. */
import { CORPORATE_SLUGS } from "@/lib/corporatePageSlugs";

export type SlugSibling = { language: string; slug: string };

/** Content types whose slug is written per language. */
export const PER_LANGUAGE_SLUG_TYPES = ["blog", "singlepage", "caseStudy", "category"] as const;
export type PerLanguageSlugType = (typeof PER_LANGUAGE_SLUG_TYPES)[number];

const LANGUAGE_NAME: Record<string, string> = { en: "English", de: "German", pl: "Polish", ru: "Russian", he: "Hebrew" };

export const PLACEHOLDER_SLUG_RE = /^draft-(?:en|de|pl|ru|he)-[a-z0-9]{6,}$/;

/** What a new translation gets instead of the source language's slug. Never public: it is a draft until the editor
 *  writes the slug from the translated title and the publish check below passes. */
export function placeholderSlug(language: string, random: () => string = () => Math.random().toString(36).slice(2, 10).padEnd(8, "0")): string {
  return `draft-${language}-${random()}`;
}

/** Same slug in two languages that is correct: "faq", the translated corporate pages whose words coincide
 *  (pl/ru "kontakty" and "o-nas"), and English <-> Hebrew, where Hebrew pages deliberately use the English slug. */
const SHARED_OK = new Set<string>(["faq", ...Object.values(CORPORATE_SLUGS).flatMap((m) => Object.values(m))]);

function sharedSlugIsFine(slug: string, a: string, b: string): boolean {
  if (SHARED_OK.has(slug)) return true;
  return (a === "he" && b === "en") || (a === "en" && b === "he");
}

/** null when the slug may go public, otherwise the message the editor sees. */
export function slugProblem(opts: { type: string; language: string; slug: string; siblings: SlugSibling[] }): string | null {
  const { type, language, slug, siblings } = opts;
  if (!(PER_LANGUAGE_SLUG_TYPES as readonly string[]).includes(type)) return null;
  const lang = LANGUAGE_NAME[language] ?? language;
  if (PLACEHOLDER_SLUG_RE.test(slug)) {
    return `The slug "${slug}" is a placeholder. Write the ${lang} slug from the ${lang} title before publishing.`;
  }
  for (const s of siblings) {
    if (s.language === language || s.slug !== slug) continue;
    if (sharedSlugIsFine(slug, language, s.language)) continue;
    return `The slug "${slug}" is the same as the ${LANGUAGE_NAME[s.language] ?? s.language} version's. Each language needs its own slug, written in ${lang} (the ${lang} URL would otherwise only redirect).`;
  }
  return null;
}
