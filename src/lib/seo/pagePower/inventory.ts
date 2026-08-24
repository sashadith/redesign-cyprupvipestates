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
  /** When this URL went live, or null when no field on the row means that.
   *
   *  Read `publishedAt` and nothing else. `createdAt` is on every one of these
   *  models and is NOT a publication date — measured 2026-08-23, the whole
   *  legacy corpus carries the SAME `createdAt` instant, 2026-06-16, because
   *  that is when the Sanity migration wrote the rows: 611 Projects, 207 Blogs,
   *  177 Singlepages, 88 Developers and 12 Case Studies, all of it. A
   *  Development's `createdAt` is when the feed sync first ingested it, which
   *  ran a median of 20 days and up to 49 days before the page was published.
   *  Judging page age on `createdAt` would report every page on the site as
   *  brand new and every Development as older than it is.
   *
   *  Null is returned rather than guessed for the three kinds with no usable
   *  field, and each null is a measured decision, not an oversight:
   *  - `singlepage`: 156 of 177 rows have `publishedAt` null and the other 21
   *    all carry one identical instant, 2026-07-07 — a backfill, not a
   *    publication. Using it would date 21 long-standing landing pages as
   *    published inside the window and quietly excuse them.
   *  - `developer`: the model has no `publishedAt` column at all, and no
   *    `status` either (every row is live).
   *  - `fixed`: hand-authored routes, no row to carry a date.
   *
   *  Consumers must treat null as "age unknown", never as "old" — see the
   *  publication-age guard in pageVerdicts.ts, which only ever uses this to
   *  WITHHOLD a claim, so an unknown date leaves the claim exactly as it was. */
  publishedAt: Date | null;
  /** The DB row Apply would write to — or null where no row exists (`fixed`
   *  pages are code-authored). Added 2026-08-24 for the Page Improver, which
   *  needs pageKey → row without re-deriving the path logic above (the nested
   *  Singlepage walk in particular must not exist twice). Page Power itself
   *  never reads this. */
  source: { table: "Development" | "Project" | "Blog" | "Singlepage" | "Developer" | "CaseStudy"; id: string } | null;
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
//
// This list has now been caught short THREE times, which is why it is no longer
// trusted to be right by reading it — see the sitemap cross-check below.
//
// "Projects listing" was the second, and it is the one that bit hardest:
// `/projects` is the ONLY fixed page with a TemplateClass of its own
// (`projects-listing`, templateClass.ts), so leaving it out did not just lose one
// page — it emptied a whole class. Measured 2026-08-23: not one of the 1,675
// inventory pages carried that class, while `getClassVerdicts` was counting 112
// sessions entering it and the sitemap was emitting it in all four locales at
// priority 0.8, the highest of any listing. The class-level report could call the
// catalogue repelling and the page-level report could not name a single page of it
// to act on. It also had a diagnosis waiting — though NOT the one this comment
// used to claim. Re-measured through this module on 2026-08-23, `/projects` draws
// 694 impressions and 6 clicks at average position 56.3, so the diagnosis waiting
// for it is `buried`. Citing MIN_IMPRESSIONS_CTR and a CTR figure implied a CTR
// verdict, and at position 56 that branch is unreachable: `getPageVerdicts`
// reaches it only at a position of BURIED_POSITION or better. A listing page
// ranking in the fifties is a content-and-authority problem, not a title one, and
// the two asks are the opposite of each other.
//
// The three listings below were the third, added 2026-08-23. `${prefix}/blog`
// (sitemap priority 0.8), `${prefix}/developers` (0.7) and
// `${prefix}/case-studies` (0.8), in all four locales — twelve indexable URLs,
// none of them noindexed, none of them in this list. Coverage barely moved
// because they draw 377 impressions and ZERO clicks between them, and coverage
// is a share of clicks. That is exactly why coverage could not have caught this:
// a page with no clicks is invisible to the instrument the join is trusted on.
// The cost was verdicts, not coverage — `/ru/developers` sits at 131 impressions
// and average position 41.3, a `buried` verdict this module could not emit at all
// while the URL was absent.
//
// DERIVING this list from the sitemap generator was considered and rejected.
// Those routes are emitted inline inside five different generator functions,
// each interleaved with its own Sanity calls and carrying its own priority,
// changefreq and hreflang set; hoisting them into a shared constant means
// editing the live sitemap route to serve a diagnostic, and the two consumers
// want different fields (the sitemap wants priority and alternates, this wants a
// title). CHECKING is the cheaper half of the same idea and catches strictly
// more: `scripts/verify-page-power.mjs` now fetches all six sitemaps and asserts
// that every `<loc>` it emits is an inventory path. That covers every kind, not
// just the fixed ones, and it fails loudly on the next omission instead of
// waiting for a fourth review. Measured 2026-08-23 with the twelve added: 1,691
// sitemap URLs, 1,691 inventory paths, nothing on either side alone.
const FIXED_PAGES: ReadonlyArray<{ title: string; path: (locale: Locale) => string }> = [
  { title: "Homepage", path: (locale) => (locale === ("en" as Locale) ? "/" : `/${locale}`) },
  { title: "Projects listing", path: (locale) => localised(locale, "/projects") },
  { title: "Blog listing", path: (locale) => localised(locale, "/blog") },
  { title: "Developers listing", path: (locale) => localised(locale, "/developers") },
  { title: "Case studies listing", path: (locale) => localised(locale, "/case-studies") },
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

type SinglepageRow = { id: string; slug: string; language: Locale; title: string; sanityId: string; parentSanityId: string | null };

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
          select: { id: true, slug: true, publicName: true, publishedAt: true },
        })
      : Promise.resolve([]),
    prisma.project.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { id: true, slug: true, language: true, title: true, publishedAt: true },
    }),
    prisma.blog.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { id: true, slug: true, language: true, title: true, publishedAt: true },
    }),
    prisma.singlepage.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { id: true, slug: true, language: true, title: true, sanityId: true, parentSanityId: true },
    }),
    // Developer has no status column — every row is live (see src/app/sitemaps/[type]/route.ts).
    prisma.developer.findMany({
      where: { slug: { not: "" } },
      select: { id: true, slug: true, language: true, title: true },
    }),
    prisma.caseStudy.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { id: true, slug: true, language: true, title: true, publishedAt: true },
    }),
  ]);

  const out: InventoryPage[] = [];

  for (const d of devs) {
    for (const locale of LOCALES) {
      const path = localised(locale, `/projects/${d.slug}`);
      out.push({ key: pageKey(locale, path), locale, path, kind: "development", title: d.publicName, publishedAt: d.publishedAt, source: { table: "Development", id: d.id } });
    }
  }
  for (const p of projects) {
    const path = localised(p.language, `/projects/${p.slug}`);
    out.push({ key: pageKey(p.language, path), locale: p.language, path, kind: "project", title: p.title, publishedAt: p.publishedAt, source: { table: "Project", id: p.id } });
  }
  for (const b of blogs) {
    const path = localised(b.language, `/blog/${b.slug}`);
    out.push({ key: pageKey(b.language, path), locale: b.language, path, kind: "blog", title: b.title, publishedAt: b.publishedAt, source: { table: "Blog", id: b.id } });
  }
  const singlesById = new Map(singles.map((s) => [s.sanityId, s]));
  for (const s of singles) {
    // Singlepage.slug is only the LEAF segment for a nested page — reconstruct
    // the full served path by walking parentSanityId (see nestedSlugPath above).
    const nested = nestedSlugPath(s, singlesById);
    const path = localised(s.language, `/${nested}`);
    out.push({ key: pageKey(s.language, path), locale: s.language, path, kind: "singlepage", title: s.title, publishedAt: null, source: { table: "Singlepage", id: s.id } });
  }
  for (const dev of developers) {
    const path = localised(dev.language, `/developers/${dev.slug}`);
    out.push({ key: pageKey(dev.language, path), locale: dev.language, path, kind: "developer", title: dev.title, publishedAt: null, source: { table: "Developer", id: dev.id } });
  }
  for (const c of caseStudies) {
    const path = localised(c.language, `/case-studies/${c.slug}`);
    out.push({ key: pageKey(c.language, path), locale: c.language, path, kind: "caseStudy", title: c.title, publishedAt: c.publishedAt, source: { table: "CaseStudy", id: c.id } });
  }
  for (const locale of LOCALES) {
    for (const fixed of FIXED_PAGES) {
      const path = fixed.path(locale);
      out.push({ key: pageKey(locale, path), locale, path, kind: "fixed", title: fixed.title, publishedAt: null, source: null });
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
