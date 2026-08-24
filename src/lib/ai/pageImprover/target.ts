import { prisma } from "@/lib/prisma";
import { getInventory, type InventoryPage } from "@/lib/seo/pagePower/inventory";
import type { CurrentSeo } from "./types";

// pageKey -> the inventory page (which carries `source`, the row Apply writes
// to). Resolved through getInventory() rather than by re-parsing the path:
// the nested-Singlepage walk and the development/legacy collision rule must
// not exist twice, and the inventory is already the single source of truth
// for "what page is this URL".
//
// `inventory` is an optional already-loaded copy, for callers resolving more
// than one key. getInventory() reads six tables and costs 1,965 ms cold /
// ~250 ms warm for 1,696 pages (measured against production 2026-08-24), so a
// caller resolving five keys pays it five times unless it threads one through
// — see gatherImprovementInput, which does, and which measured 775 ms against
// 246 ms for exactly that.
export async function resolveTarget(pageKey: string, inventory?: InventoryPage[]): Promise<InventoryPage | null> {
  const pages = inventory ?? (await getInventory());
  return pages.find((p) => p.key === pageKey) ?? null;
}

const SEO_TABLES = ["Blog", "Singlepage", "Developer", "CaseStudy", "Project"] as const;
export type SeoTable = (typeof SEO_TABLES)[number];
export const isSeoTable = (t: string): t is SeoTable => (SEO_TABLES as readonly string[]).includes(t);

const asSeo = (seo: unknown): CurrentSeo => {
  const s = seo && typeof seo === "object" ? (seo as Record<string, unknown>) : {};
  return {
    metaTitle: typeof s.metaTitle === "string" ? s.metaTitle : "",
    metaDescription: typeof s.metaDescription === "string" ? s.metaDescription : "",
  };
};

// One switch for reads and one for writes, so the set of tables Apply can
// touch is visible in one place. `Project` was the one shape the spec only
// ASSUMED; it holds. Measured across every row of all five tables on
// 2026-08-24: 887 Projects, 208 Blogs, 182 Singlepages, 88 Developers and 12
// Case Studies, 1,377 rows, every one of them a Json object carrying exactly
// `metaTitle` and `metaDescription` and nothing else — no nulls, no third key
// anywhere. The five admin editors read `seo.metaTitle ?? ""` identically.
// Developments are deliberately absent: they have their own generator and
// override editor, and two generators for the same fields drift apart.
export async function readTargetSeo(table: SeoTable, id: string): Promise<CurrentSeo | null> {
  switch (table) {
    case "Blog": {
      const r = await prisma.blog.findUnique({ where: { id }, select: { seo: true } });
      return r ? asSeo(r.seo) : null;
    }
    case "Singlepage": {
      const r = await prisma.singlepage.findUnique({ where: { id }, select: { seo: true } });
      return r ? asSeo(r.seo) : null;
    }
    case "Developer": {
      const r = await prisma.developer.findUnique({ where: { id }, select: { seo: true } });
      return r ? asSeo(r.seo) : null;
    }
    case "CaseStudy": {
      const r = await prisma.caseStudy.findUnique({ where: { id }, select: { seo: true } });
      return r ? asSeo(r.seo) : null;
    }
    case "Project": {
      const r = await prisma.project.findUnique({ where: { id }, select: { seo: true } });
      return r ? asSeo(r.seo) : null;
    }
  }
}

export async function writeTargetSeo(table: SeoTable, id: string, next: CurrentSeo): Promise<void> {
  // Merge, not replace. No row carries a third key today (the census above),
  // so this is not repairing a known case — it is the same shape the admin
  // editors already write through (`data.seo = { ...prev.seo, metaTitle,
  // metaDescription }`, src/app/admin/actions.ts). A replace would work now
  // and silently strip the first openGraph or legacy field anyone adds later,
  // and the loss would show up as a rendering change nobody connects to Apply.
  const current = await (async () => {
    switch (table) {
      case "Blog": return (await prisma.blog.findUnique({ where: { id }, select: { seo: true } }))?.seo;
      case "Singlepage": return (await prisma.singlepage.findUnique({ where: { id }, select: { seo: true } }))?.seo;
      case "Developer": return (await prisma.developer.findUnique({ where: { id }, select: { seo: true } }))?.seo;
      case "CaseStudy": return (await prisma.caseStudy.findUnique({ where: { id }, select: { seo: true } }))?.seo;
      case "Project": return (await prisma.project.findUnique({ where: { id }, select: { seo: true } }))?.seo;
    }
  })();
  const merged = { ...(current && typeof current === "object" ? (current as object) : {}), metaTitle: next.metaTitle, metaDescription: next.metaDescription };
  switch (table) {
    case "Blog": await prisma.blog.update({ where: { id }, data: { seo: merged } }); return;
    case "Singlepage": await prisma.singlepage.update({ where: { id }, data: { seo: merged } }); return;
    case "Developer": await prisma.developer.update({ where: { id }, data: { seo: merged } }); return;
    case "CaseStudy": await prisma.caseStudy.update({ where: { id }, data: { seo: merged } }); return;
    case "Project": await prisma.project.update({ where: { id }, data: { seo: merged } }); return;
  }
}
