// "Guides" section vs "Blog" for articles.
//
// Both sections are served from the same `Blog` table: there is no extra column and no
// migration. An article belongs to the Guides section when its category is one of the guide
// categories below, and to the Blog otherwise. A category is identified by its
// `translationGroupId` (the same id on the en/de/pl/ru/he rows of one category), so a new
// language never needs another entry here.
//
// Public URLs use the guides slug each language already has for the free-PDF guides page
// (src/lib/guidesPage.ts): /guides, /de/ratgeber, /pl/poradniki, /ru/gajdy. An article is
// /guides/<slug>, /de/ratgeber/<slug>, /pl/poradniki/<slug>, /ru/gajdy/<slug>. The section's
// index IS the free-guides page, which also lists every guide article.
//
// Moving a category between sections is a one-line change below and re-homes every article of
// it, in every language. The old URL keeps working: /blog/<slug> of a guide answers with a
// permanent redirect to its guides URL, and a guides URL of a blog article redirects back
// (see [lang]/blog/[slug]/page.tsx and the [lang]/<guides slug>/[slug] routes).
//
// Hebrew stays out on purpose: /he/blog shows the English articles (blogIndexMode.ts), so there
// is nothing for a Hebrew guides section to list.
import { localizedHref } from "@/lib/locale";
import { GUIDES_PAGE_SLUG } from "@/lib/guidesPage";
import { GUIDE_LANGS } from "@/lib/guides/types";

export type ArticleSection = "blog" | "guides";

/** Locales that have a guides section. */
export const GUIDE_SECTION_LOCALES: readonly string[] = GUIDE_LANGS;

/** Categories (by translationGroupId) whose articles live in the guides section. Their slugs,
 *  for reference: life-in-cyprus, buying-property-in-cyprus, legal-and-tax-insights,
 *  locations-and-area-guides, lifestyle-and-expat-tips. Everything else (investment & market
 *  trends, featured properties, developer projects) stays in the blog. Order = display order. */
export const GUIDE_CATEGORY_GROUPS: readonly string[] = [
  "678f40ba-004f-48d1-95e9-8be5b03566cf", // buying-property-in-cyprus
  "a90f42e8-a9e4-4a61-8639-29fa6df09654", // legal-and-tax-insights
  "0cb25ffc-8e3f-4e89-b663-b6d73d949ec0", // life-in-cyprus
  "a3e8946e-8857-4c0f-a2bc-ab20c0abacd2", // locations-and-area-guides
  "696a0e69-d198-4af3-a296-e61776d6c56a", // lifestyle-and-expat-tips
];

const GROUPS = new Set(GUIDE_CATEGORY_GROUPS);

export const hasGuidesSection = (lang: string): boolean => GUIDE_SECTION_LOCALES.includes(lang);

/** The public URL segment of the guides section in a language ("guides", "ratgeber", "poradniki", "gajdy"). */
export function guidesSectionSlug(lang: string): string {
  return GUIDES_PAGE_SLUG[(hasGuidesSection(lang) ? lang : "en") as keyof typeof GUIDES_PAGE_SLUG];
}

/** Every guides slug of every language: the first path segment that marks a guide article URL. */
export const ALL_GUIDES_SLUGS: readonly string[] = Object.values(GUIDES_PAGE_SLUG);

/** Which section an article lives in, from its language and its category's translationGroupId. */
export function articleSection(lang: string, categoryGroupId?: string | null): ArticleSection {
  return hasGuidesSection(lang) && !!categoryGroupId && GROUPS.has(categoryGroupId) ? "guides" : "blog";
}

/** Path segments of an article page: [<section slug>, slug]. */
export const articleSegments = (lang: string, slug: string, categoryGroupId?: string | null): string[] => [
  articleSection(lang, categoryGroupId) === "guides" ? guidesSectionSlug(lang) : "blog",
  slug,
];

/** Same, from an already-known section. */
export const sectionSegments = (lang: string, slug: string, section?: string | null): string[] => [
  section === "guides" && hasGuidesSection(lang) ? guidesSectionSlug(lang) : "blog",
  slug,
];

/** Site-relative href of an article page in its own section ("/ru/gajdy/x", "/blog/y"). */
export const articleHref = (lang: string, slug: string, categoryGroupId?: string | null): string =>
  localizedHref(lang, articleSegments(lang, slug, categoryGroupId));

/** Site-relative href of the section index ("/blog" or the guides page). */
export const sectionIndexHref = (lang: string, section: ArticleSection): string =>
  section === "guides" && hasGuidesSection(lang) ? localizedHref(lang, guidesSectionSlug(lang)) : localizedHref(lang, "blog");

/** Prisma `where` fragment: rows of `lang` that belong to the guides section / to the blog. */
export function sectionWhere(lang: string, section: ArticleSection): Record<string, unknown> {
  const inGuides = { category: { is: { translationGroupId: { in: [...GUIDE_CATEGORY_GROUPS] } } } };
  if (!hasGuidesSection(lang)) return section === "guides" ? { id: "__none__" } : {};
  return section === "guides" ? inGuides : { NOT: inGuides };
}
