import type { Locale } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NEW_PROJECTS_INDEXABLE } from "@/lib/developmentSeo";
import { pageKey, type PageKey } from "./types";

export type InventoryPage = {
  key: PageKey;
  locale: Locale;
  /** canonical path, English without a locale prefix */
  path: string;
  kind: "development" | "project" | "blog" | "singlepage" | "developer" | "caseStudy" | "fixed";
  title: string;
};

const LOCALES: Locale[] = ["en", "de", "pl", "ru"] as Locale[];

/** English is served prefix-less; every other locale carries its prefix. */
function localised(locale: Locale, path: string): string {
  return locale === ("en" as Locale) ? path : `/${locale}${path}`;
}

// Explicit, order-independent tie-break for a key collision (below): higher
// number wins regardless of which loop happened to run first. Only
// development-over-project is a real, documented case today; everything
// else defaults to the same tier because no other kind is known to collide.
const KIND_PRIORITY: Record<InventoryPage["kind"], number> = {
  development: 2,
  project: 1,
  blog: 0,
  singlepage: 0,
  developer: 0,
  caseStudy: 0,
  fixed: 0,
};

// Fixed, hand-authored pages the sitemap also emits by hand (src/app/sitemaps/[type]/route.ts):
// not CMS rows, but real indexable URLs with real GSC volume, so they must be in the
// inventory or the coverage metric would treat their clicks as unmatched.
const FIXED_PAGES: ReadonlyArray<{ title: string; path: (locale: Locale) => string }> = [
  { title: "Homepage", path: (locale) => (locale === ("en" as Locale) ? "/" : `/${locale}`) },
  { title: "FAQ", path: (locale) => localised(locale, "/faq") },
  { title: "Partners", path: (locale) => localised(locale, "/partners") },
];

// A nested Singlepage's real, served URL is its full parent chain (see
// nestedPageRedirects.json), not its own leaf slug — the catch-all route
// resolves it there and GSC indexes it there. Capped walk, same shape as
// getAllPathsForLang in src/sanity/sanity.utils.ts (map sanityId -> row,
// resolve parents iteratively) but done per-row so a broken/unpublished
// ancestor degrades gracefully instead of dropping the page outright.
const MAX_PARENT_DEPTH = 20;

type SinglepageRow = { slug: string; language: Locale; title: string; sanityId: string; parentSanityId: string | null };

function nestedSlugPath(row: SinglepageRow, byId: Map<string, SinglepageRow>): string {
  const segments: string[] = [row.slug];
  const visited = new Set<string>([row.sanityId]);
  let parentId = row.parentSanityId;
  let depth = 0;
  while (parentId && depth < MAX_PARENT_DEPTH) {
    if (visited.has(parentId)) return row.slug; // cycle in the parent chain — bail to the leaf slug rather than loop forever
    const parent = byId.get(parentId);
    if (!parent) break; // dangling/unpublished ancestor — use the chain resolved so far
    segments.unshift(parent.slug);
    visited.add(parentId);
    parentId = parent.parentSanityId;
    depth++;
  }
  if (parentId && depth >= MAX_PARENT_DEPTH) return row.slug; // chain never terminated within the cap — treat as pathological, fall back to the leaf
  return segments.join("/");
}

/**
 * Every publicly reachable, indexable page, as canonical `locale::path` keys.
 *
 * Developments carry ONE language-agnostic slug (see developmentSeo.ts) and are
 * therefore reachable in all four locales. Projects, Blogs, Singlepages,
 * Developers and CaseStudies are per-locale rows and exist only in the locale
 * they were authored in.
 */
export async function getInventory(): Promise<InventoryPage[]> {
  const [devs, projects, blogs, singles, developers, caseStudies] = await Promise.all([
    NEW_PROJECTS_INDEXABLE
      ? prisma.development.findMany({
          where: { publishStatus: "published", slug: { not: null } },
          select: { slug: true, publicName: true },
        })
      : Promise.resolve([]),
    prisma.project.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, language: true, title: true },
    }),
    prisma.blog.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, language: true, title: true },
    }),
    prisma.singlepage.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, language: true, title: true, sanityId: true, parentSanityId: true },
    }),
    // Developer has no status column — every row is live (see src/app/sitemaps/[type]/route.ts).
    prisma.developer.findMany({
      where: { slug: { not: "" } },
      select: { slug: true, language: true, title: true },
    }),
    prisma.caseStudy.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, language: true, title: true },
    }),
  ]);

  const out: InventoryPage[] = [];

  for (const d of devs) {
    for (const locale of LOCALES) {
      const path = localised(locale, `/projects/${d.slug}`);
      out.push({ key: pageKey(locale, path), locale, path, kind: "development", title: d.publicName });
    }
  }
  for (const p of projects) {
    const path = localised(p.language, `/projects/${p.slug}`);
    out.push({ key: pageKey(p.language, path), locale: p.language, path, kind: "project", title: p.title });
  }
  for (const b of blogs) {
    const path = localised(b.language, `/blog/${b.slug}`);
    out.push({ key: pageKey(b.language, path), locale: b.language, path, kind: "blog", title: b.title });
  }
  const singlesById = new Map(singles.map((s) => [s.sanityId, s]));
  for (const s of singles) {
    // Singlepage.slug is only the LEAF segment for a nested page — reconstruct
    // the full served path by walking parentSanityId (see nestedSlugPath above).
    const nested = nestedSlugPath(s, singlesById);
    const path = localised(s.language, `/${nested}`);
    out.push({ key: pageKey(s.language, path), locale: s.language, path, kind: "singlepage", title: s.title });
  }
  for (const dev of developers) {
    const path = localised(dev.language, `/developers/${dev.slug}`);
    out.push({ key: pageKey(dev.language, path), locale: dev.language, path, kind: "developer", title: dev.title });
  }
  for (const c of caseStudies) {
    const path = localised(c.language, `/case-studies/${c.slug}`);
    out.push({ key: pageKey(c.language, path), locale: c.language, path, kind: "caseStudy", title: c.title });
  }
  for (const locale of LOCALES) {
    for (const fixed of FIXED_PAGES) {
      const path = fixed.path(locale);
      out.push({ key: pageKey(locale, path), locale, path, kind: "fixed", title: fixed.title });
    }
  }

  // A Development slug can collide with a legacy Project slug during the
  // supersede window; the Development wins because it is what the dispatcher
  // serves (see src/app/[lang]/projects/[slug]/page.tsx). The priority is
  // explicit (KIND_PRIORITY above), not incidental to loop order, so a future
  // reordering of the loops above cannot silently flip the winner.
  const byKey = new Map<PageKey, InventoryPage>();
  for (const page of out) {
    const existing = byKey.get(page.key);
    if (!existing || KIND_PRIORITY[page.kind] > KIND_PRIORITY[existing.kind]) byKey.set(page.key, page);
  }
  return Array.from(byKey.values());
}
