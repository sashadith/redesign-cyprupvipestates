// Partner portal "Projects" (2026-11-11): the published projects with
// everything the filter strip and table need — place, price, units, delivery,
// date added and the partner's rates. Rates come from myProjects (one source
// for the rates the portal shows); this adds the facts. Never the developer.
import { prisma } from "@/lib/prisma";
import { normalizeType, parseBeds } from "@/lib/crm/matching";
import { completionSortKey, isCompletionPast, resolveRelativeCompletion } from "@/lib/completionDate";
import { myProjects, type MyProject } from "./scope";
import type { CatalogProject } from "./projectFilter";

export type CatalogRow = {
  id: string;
  town: string | null;
  district: string | null;
  area: string | null;
  completion: string | null;
  priceFrom: number | null;
  publishedAt: Date | null;
  override: { town: string | null; district: string | null; area: string | null; completion: string | null } | null;
  units: { type: string | null; beds: string | null; price: number | null; status: string | null }[];
};

const clean = (v: string | null | undefined) => v?.trim() || null;

/** Pure: one development row + the partner's rates → a catalog row (url filled in by the page). */
export function toCatalogProject(row: CatalogRow, rated: MyProject, now: Date = new Date()): CatalogProject {
  const ov = row.override;
  const available = row.units.filter((u) => (u.status ?? "available") === "available");
  const units = available.map((u) => ({ t: normalizeType(u.type), b: parseBeds(u.beds), p: u.price ?? null }));
  const prices = units.map((u) => u.p).filter((p): p is number => p != null);
  const beds = units.map((u) => u.b).filter((b): b is number => b != null);
  const rawCompletion = clean(ov?.completion) ?? clean(row.completion);
  const completion = rawCompletion ? resolveRelativeCompletion(rawCompletion, now) || null : null;
  return {
    id: row.id,
    name: rated.name,
    town: clean(ov?.town) ?? clean(row.town),
    district: clean(ov?.district) ?? clean(row.district),
    area: clean(ov?.area) ?? clean(row.area),
    url: null,
    priceFrom: row.priceFrom ?? (prices.length ? Math.min(...prices) : null),
    completion,
    completionKey: completion ? completionSortKey(completion) : null,
    ready: completion ? isCompletionPast(completion, now) : false,
    addedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    unitsFree: available.length,
    unitsTotal: row.units.length,
    bedsMin: beds.length ? Math.min(...beds) : null,
    bedsMax: beds.length ? Math.max(...beds) : null,
    types: Array.from(new Set(units.map((u) => u.t).filter((t): t is string => !!t))).sort(),
    units,
    handoverRate: rated.handoverRate,
    fixRate: rated.fixRate,
    ourRate: rated.ourRate,
  };
}

export async function projectCatalog(partnerId: string): Promise<{ trustMode: boolean; projects: (CatalogProject & { slug: string | null })[] }> {
  const mine = await myProjects(partnerId);
  if (!mine.projects.length) return { trustMode: mine.trustMode, projects: [] };
  // Only the columns the page reads (the testbed DB lags the schema; whole-relation includes break there).
  const rows = await prisma.development.findMany({
    where: { id: { in: mine.projects.map((p) => p.id) }, publishStatus: "published" },
    select: {
      id: true, town: true, district: true, area: true, completion: true, priceFrom: true, publishedAt: true,
      override: { select: { town: true, district: true, area: true, completion: true } },
      units: { select: { type: true, beds: true, price: true, status: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = new Date();
  const projects = mine.projects.flatMap((p) => {
    const row = byId.get(p.id);
    return row ? [{ ...toCatalogProject(row, p, now), slug: p.slug }] : [];
  });
  return { trustMode: mine.trustMode, projects };
}
