import { prisma } from "@/lib/prisma";
import { listedUnits, computeAvailability } from "@/lib/developmentAvailability";
import { resolveRelativeCompletion, completionSortKey } from "@/lib/completionDate";
import { parseBeds, normalizeType, rangesOverlap, locationMatch } from "@/lib/crm/matching";

/* Catalogue search without a lead (MCP connector Phase 3). Filter + sort,
   never a score — scores only mean something relative to a lead, and
   crm_match_properties already does that. Unit-level filters (budget, beds,
   type, amenity) use the same helpers as the admin matching panel so a
   "Villa, 3 beds, ≤ 500k" is the same set in both places. */

export type SearchSort = "price_asc" | "price_desc" | "availability_desc" | "updated_desc" | "name";

export type SearchFilters = {
  query?: string;
  districts?: string[];
  areas?: string[];
  propertyTypes?: string[];
  bedrooms?: number[];
  budgetMin?: number | null;
  budgetMax?: number | null;
  /** Default true — a development needs ≥1 available unit. */
  onlyAvailable?: boolean;
  /** "YYYY" (through the end of that year) or "YYYY-MM" (through the end of that month). */
  completionBefore?: string;
  stage?: string;
  amenity?: string;
  developer?: string;
  includeReady?: boolean;
  sort?: SearchSort;
  page?: number;
  pageSize?: number;
};

export type SearchUnit = { type: string | null; status: string | null; price: number | null; beds: string | null; amenities: unknown };

export type SearchDevelopment = {
  id: string; publicName: string; developerName: string; developer: string | null; category: string | null; stage: string | null; status: string | null;
  completion: string | null; district: string | null; town: string | null; area: string | null; priceFrom: number | null; priceTo: number | null;
  currency: string | null; amenities: unknown; slug: string | null; publishStatus: string; syncedAt: Date | null; updatedAt: Date; units: SearchUnit[];
  override: { alias: string | null; district: string | null; town: string | null; area: string | null; completion: string | null; stage: string | null; amenities: unknown } | null;
};

export type SearchRow = {
  developmentId: string; name: string; developer: string | null; publishStatus: string; slug: string | null;
  location: { area: string | null; district: string | null; town: string | null }; category: string | null; stage: string | null;
  completion: string | null; completionUnparsed?: true; priceFrom: number | null; priceTo: number | null; currency: string;
  availability: { total: number; available: number; soldOut: boolean };
  matchingUnits: { count: number; minPrice: number | null; maxPrice: number | null; types: string[]; priceFallback?: true };
  publicUrl: { en: string; de: string; pl: string; ru: string } | null;
  lastSyncedAt: Date | null;
};

export type SearchResult = {
  total: number; page: number; pageSize: number;
  summary: { byDistrict: Record<string, number>; byDeveloper: Record<string, number> };
  rows: SearchRow[];
};

export const MAX_PAGE_SIZE = 20;
export const DEFAULT_PAGE_SIZE = 10;

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const lc = (s: string | null | undefined) => (s || "").toLowerCase();

/** Exclusive upper bound in ms UTC: "2027" → 1 Jan 2028, "2027-06" → 1 Jul 2027. */
export function parseCompletionBefore(v: string | undefined): number | null | "invalid" {
  if (v == null || v === "") return null;
  const m = v.match(/^(\d{4})(?:-(\d{2}))?$/);
  if (!m) return "invalid";
  const y = Number(m[1]);
  if (!m[2]) return Date.UTC(y + 1, 0, 1);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return "invalid";
  return Date.UTC(y, mo, 1); // month index mo == first day of the following month
}

export function publicUrlFor(slug: string | null, publishStatus: string) {
  return slug && publishStatus === "published"
    ? { en: `/en/projects/${slug}`, de: `/de/projects/${slug}`, pl: `/pl/projects/${slug}`, ru: `/ru/projects/${slug}` }
    : null;
}

export function filterAndRank(rows: SearchDevelopment[], filters: SearchFilters, now: Date = new Date()): SearchResult {
  const statuses = filters.includeReady ? ["published", "ready"] : ["published"];
  const onlyAvailable = filters.onlyAvailable ?? true;
  const query = lc(filters.query).trim();
  const developerQ = lc(filters.developer).trim();
  const stageQ = lc(filters.stage).trim();
  const amenityQ = lc(filters.amenity).trim();
  const districts = (filters.districts ?? []).map(lc).filter(Boolean);
  const areas = (filters.areas ?? []).map(lc).filter(Boolean);
  const types = (filters.propertyTypes ?? []).map(normalizeType).filter((t): t is string => !!t);
  const bedrooms = filters.bedrooms ?? [];
  const budgetMin = filters.budgetMin ?? null;
  const budgetMax = filters.budgetMax ?? null;
  const hasBudget = budgetMin != null || budgetMax != null;
  const completionBound = parseCompletionBefore(filters.completionBefore);
  const bound = completionBound === "invalid" ? null : completionBound;
  const unitFilters = hasBudget || bedrooms.length > 0 || types.length > 0 || amenityQ.length > 0;

  const out: SearchRow[] = [];
  for (const d of rows) {
    if (!statuses.includes(d.publishStatus)) continue;
    const ov = d.override;
    const name = ov?.alias || d.publicName;
    const district = ov?.district || d.district || null;
    const town = ov?.town || d.town || null;
    const area = ov?.area || d.area || null;
    const stage = ov?.stage || d.stage || null;
    const completion = resolveRelativeCompletion(ov?.completion || d.completion, now) || null;
    const devAmenities = strings(ov?.amenities).length ? strings(ov?.amenities) : strings(d.amenities);

    if (query && ![name, d.publicName, d.developerName, d.developer, town, area].some((s) => lc(s).includes(query))) continue;
    if (developerQ && ![d.developer, d.developerName].some((s) => lc(s).includes(developerQ))) continue;
    if (stageQ && ![stage, d.status].some((s) => lc(s).includes(stageQ))) continue;
    if (districts.length) {
      const { districtMatches, areaMatches } = locationMatch({ district, town, area }, districts, areas);
      if (!districtMatches) continue;
      if (areas.length && !areaMatches) continue;
    }

    let completionUnparsed: true | undefined;
    if (bound != null) {
      const key = completionSortKey(ov?.completion || d.completion);
      if (key == null) completionUnparsed = true;
      else if (key >= bound) continue;
    }

    const listed = listedUnits(d.units);
    const availability = computeAvailability(listed);
    const pool = onlyAvailable ? listed.filter((u) => u.status === "available") : listed;
    const devAmenityHit = amenityQ ? devAmenities.some((a) => lc(a).includes(amenityQ)) : true;

    let matching = pool.filter((u) => {
      if (hasBudget) {
        if (u.price == null) return false;
        if (budgetMin != null && u.price < budgetMin) return false;
        if (budgetMax != null && u.price > budgetMax) return false;
      }
      if (bedrooms.length) {
        const b = parseBeds(u.beds);
        if (b == null) return false;
        if (!bedrooms.includes(b) && !(bedrooms.includes(5) && b >= 5)) return false;
      }
      if (types.length) {
        const t = normalizeType(u.type);
        if (!t || !types.includes(t)) return false;
      }
      if (amenityQ && !devAmenityHit && !strings(u.amenities).some((a) => lc(a).includes(amenityQ))) return false;
      return true;
    });

    let priceFallback: true | undefined;
    if (matching.length === 0) {
      // Unit-driven feeds and manual developments often leave every unit
      // unpriced while the project-level range is real — same fallback the
      // matching engine uses for its budget score.
      const nothingPriced = pool.length > 0 && pool.every((u) => u.price == null);
      const onlyBudget = hasBudget && bedrooms.length === 0 && types.length === 0 && (!amenityQ || devAmenityHit);
      if (onlyBudget && nothingPriced && rangesOverlap(budgetMin, budgetMax, d.priceFrom, d.priceTo)) {
        matching = pool;
        priceFallback = true;
      } else if (unitFilters || onlyAvailable || pool.length > 0) {
        continue;
      }
    }

    const prices = matching.map((u) => u.price).filter((p): p is number => p != null);
    const unitPrices = pool.map((u) => u.price).filter((p): p is number => p != null);
    out.push({
      developmentId: d.id,
      name,
      developer: d.developer,
      publishStatus: d.publishStatus,
      slug: d.slug,
      location: { area, district, town },
      category: d.category,
      stage,
      completion,
      ...(completionUnparsed ? { completionUnparsed } : {}),
      priceFrom: d.priceFrom ?? (unitPrices.length ? Math.min(...unitPrices) : null),
      priceTo: d.priceTo,
      currency: d.currency || "EUR",
      availability,
      matchingUnits: {
        count: matching.length,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        types: Array.from(new Set(matching.map((u) => u.type).filter((t): t is string => !!t))),
        ...(priceFallback ? { priceFallback } : {}),
      },
      publicUrl: publicUrlFor(d.slug, d.publishStatus),
      lastSyncedAt: d.syncedAt,
    });
  }

  const sortKeyPrice = (r: SearchRow) => r.matchingUnits.minPrice ?? r.priceFrom ?? Number.POSITIVE_INFINITY;
  const updated = new Map(rows.map((d) => [d.id, d.updatedAt.getTime()]));
  const sort = filters.sort ?? "price_asc";
  out.sort((a, b) => {
    switch (sort) {
      case "price_desc": {
        const pa = a.matchingUnits.minPrice ?? a.priceFrom ?? Number.NEGATIVE_INFINITY;
        const pb = b.matchingUnits.minPrice ?? b.priceFrom ?? Number.NEGATIVE_INFINITY;
        return pb - pa || a.name.localeCompare(b.name);
      }
      case "availability_desc": return b.availability.available - a.availability.available || a.name.localeCompare(b.name);
      case "updated_desc": return (updated.get(b.developmentId) ?? 0) - (updated.get(a.developmentId) ?? 0) || a.name.localeCompare(b.name);
      case "name": return a.name.localeCompare(b.name);
      default: return sortKeyPrice(a) - sortKeyPrice(b) || a.name.localeCompare(b.name);
    }
  });

  const byDistrict: Record<string, number> = {};
  const byDeveloper: Record<string, number> = {};
  for (const r of out) {
    const dk = r.location.district || r.location.town || "—";
    byDistrict[dk] = (byDistrict[dk] ?? 0) + 1;
    const dv = r.developer || "—";
    byDeveloper[dv] = (byDeveloper[dv] ?? 0) + 1;
  }

  const pageSize = Math.min(Math.max(filters.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const page = Math.max(filters.page ?? 1, 1);
  return { total: out.length, page, pageSize, summary: { byDistrict, byDeveloper }, rows: out.slice((page - 1) * pageSize, page * pageSize) };
}

export const SEARCH_DEVELOPMENT_SELECT = {
  id: true, publicName: true, developerName: true, developer: true, category: true, stage: true, status: true, completion: true,
  district: true, town: true, area: true, priceFrom: true, priceTo: true, currency: true, amenities: true, slug: true, publishStatus: true,
  syncedAt: true, updatedAt: true,
  units: { select: { type: true, status: true, price: true, beds: true, amenities: true } },
  override: { select: { alias: true, district: true, town: true, area: true, completion: true, stage: true, amenities: true } },
} as const;

export async function searchDevelopments(filters: SearchFilters): Promise<SearchResult> {
  const statuses = filters.includeReady ? ["published", "ready"] : ["published"];
  const rows = await prisma.development.findMany({ where: { publishStatus: { in: statuses } }, select: SEARCH_DEVELOPMENT_SELECT });
  return filterAndRank(rows as SearchDevelopment[], filters);
}
