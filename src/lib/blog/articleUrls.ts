// Article identity + per-locale URLs for the blog MCP tools (2026-10-03).
// Prisma-free so the pure test can cover it. One "article" is a translation
// group (Blog.translationGroupId); its public URLs come from EXACTLY the
// helper the article page's hreflang/language switcher uses —
// languageAlternates({ pathFor: pathBuilders.blog, translations }) — never
// from a hand-built pattern, so a locale that is gated (he) or a sibling
// that is not PUBLISHED can never be advertised here either.
import { languageAlternates, pathBuilders } from "@/lib/seo";
import { LOCALES, LAUNCH_GATED_LOCALES, type Locale } from "@/lib/locale";

// The locales the blog is written in: every known locale that is not launch-
// gated (Hebrew is a product decision — /he/blog lists the English articles,
// see blogI18n.ts). Derived, not listed, so the locale plumbing guard
// (src/lib/__tests__/seoLocalePlumbing.test.ts) keeps this in one place.
export type BlogLocale = Exclude<Locale, "he">;
export const BLOG_LOCALES = LOCALES.filter((l): l is BlogLocale => !LAUNCH_GATED_LOCALES.includes(l)) as readonly BlogLocale[];

export type ArticleRow = {
  id: string;
  language: string;
  slug: string;
  title: string;
  status: string;
  seo: unknown;
  publishedAt: Date | null;
  updatedAt: Date;
  translationGroupId: string | null;
  category?: { slug: string; title: string } | null;
};

export type ArticleGroup = { key: string; rows: ArticleRow[] };

export type LocaleEntry = { title: string | null; metaDescription: string | null; url: string; slug: string; publishedAt: Date | null; updatedAt: Date };

export type ArticleListEntry = {
  slug: string;
  category: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  locales: Record<BlogLocale, LocaleEntry | "missing">;
};

export function isBlogLocale(l: string): l is BlogLocale {
  return (BLOG_LOCALES as readonly string[]).includes(l);
}

/** One group per translationGroupId; a row without a group is its own article. */
export function groupArticles(rows: ArticleRow[]): ArticleGroup[] {
  const map = new Map<string, ArticleRow[]>();
  for (const r of rows) {
    if (r.status !== "PUBLISHED" || !isBlogLocale(r.language)) continue;
    const key = r.translationGroupId ?? `solo:${r.id}`;
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return Array.from(map.entries()).map(([key, groupRows]) => ({ key, rows: groupRows }));
}

/** The row the group is named after: English when it exists, else the first. */
export function anchorRow(group: ArticleGroup): ArticleRow {
  return group.rows.find((r) => r.language === "en") ?? group.rows[0];
}

/** Absolute public URL per locale, via the language switcher's own helper. Null = no published translation. */
export function localeUrls(group: ArticleGroup): Record<BlogLocale, string | null> {
  const anchor = anchorRow(group);
  const translations = group.rows.map((r) => ({ slug: { [r.language]: { current: r.slug } } }));
  const { languages } = languageAlternates({ lang: anchor.language, slug: anchor.slug, pathFor: pathBuilders.blog, translations });
  const out = {} as Record<BlogLocale, string | null>;
  for (const l of BLOG_LOCALES) out[l] = languages[l] ?? null;
  return out;
}

export function metaDescriptionOf(seo: unknown): string | null {
  const d = (seo as { metaDescription?: unknown } | null)?.metaDescription;
  return typeof d === "string" && d.trim() ? d.trim() : null;
}

export function listEntry(group: ArticleGroup): ArticleListEntry {
  const anchor = anchorRow(group);
  const urls = localeUrls(group);
  const locales = {} as ArticleListEntry["locales"];
  for (const l of BLOG_LOCALES) {
    const row = group.rows.find((r) => r.language === l);
    const url = urls[l];
    locales[l] =
      row && url
        ? { title: row.title.trim() || null, metaDescription: metaDescriptionOf(row.seo), url, slug: row.slug, publishedAt: row.publishedAt, updatedAt: row.updatedAt }
        : "missing";
  }
  const published = group.rows.map((r) => r.publishedAt).filter((d): d is Date => !!d);
  return {
    slug: anchor.slug,
    category: anchor.category?.slug ?? group.rows.find((r) => r.category)?.category?.slug ?? null,
    publishedAt: published.length ? new Date(Math.min(...published.map((d) => d.getTime()))) : null,
    updatedAt: new Date(Math.max(...group.rows.map((r) => r.updatedAt.getTime()))),
    locales,
  };
}
