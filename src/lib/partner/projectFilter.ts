// Partner portal "Projects" (2026-11-11): filter and sort the published
// projects in the browser. Pure and client-safe (no prisma import chain): the
// server builds CatalogProject rows in projectCatalog.ts, this module only
// reads them. Filter semantics follow the CRM client selection
// (src/lib/crm/matching.ts): budget, bedrooms and type must hold for ONE
// available unit together.
import { placeKey } from "@/lib/crm/placeNames";

/** One available unit, compact: normalized type, bedrooms (studio = 0), price in EUR. */
export type CatalogUnit = { t: string | null; b: number | null; p: number | null };

export type CatalogProject = {
  id: string;
  name: string;
  town: string | null;
  district: string | null;
  area: string | null;
  url: string | null;
  /** Project price, else the cheapest available unit. */
  priceFrom: number | null;
  /** Delivery label as stored ("Q4 2027", "Ready"), relative forms resolved. */
  completion: string | null;
  /** Start of the stated period in ms (completionSortKey); null when unparseable. */
  completionKey: number | null;
  /** The stated period is over or the label says ready. */
  ready: boolean;
  /** When the project went live on the website (ISO). */
  addedAt: string | null;
  unitsFree: number;
  unitsTotal: number;
  bedsMin: number | null;
  bedsMax: number | null;
  /** Normalized types of the available units (apartment, villa, townhouse, penthouse, office). */
  types: string[];
  units: CatalogUnit[];
  handoverRate: number | null;
  fixRate: number | null;
  ourRate: number | null;
};

export type DeliveryBucket = "ready" | "thisYear" | "nextYear" | "later";
export const DELIVERY_BUCKETS: readonly DeliveryBucket[] = ["ready", "thisYear", "nextYear", "later"];
export const ADDED_WITHIN = [7, 30, 90] as const;
export type AddedWithin = (typeof ADDED_WITHIN)[number];
/** Bedroom chips; 0 = studio, 5 = five or more. */
export const BED_CHIPS = [0, 1, 2, 3, 4, 5] as const;
export const TYPE_CHIPS = ["apartment", "villa", "townhouse", "penthouse", "office"] as const;
/** A project counts as new for this many days after it went live. */
export const NEW_DAYS = 30;

export type CatalogFilters = {
  q: string;
  budgetMin: number | null;
  budgetMax: number | null;
  beds: number[];
  types: string[];
  districts: string[];
  areas: string[];
  delivery: DeliveryBucket[];
  addedWithin: AddedWithin | null;
  /** Minimum handover rate in %. */
  minRate: number | null;
  onlyFree: boolean;
};

export const EMPTY_FILTERS: CatalogFilters = {
  q: "", budgetMin: null, budgetMax: null, beds: [], types: [], districts: [], areas: [],
  delivery: [], addedWithin: null, minRate: null, onlyFree: false,
};

export type ShownProject = CatalogProject & {
  /** Cheapest available unit that meets budget, bedrooms and type; the project price when none of those is set. */
  shownFrom: number | null;
};

const DAY = 86_400_000;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The district a project is listed under: its district, else its town. */
export const districtOf = (p: Pick<CatalogProject, "district" | "town">): string | null => p.district?.trim() || p.town?.trim() || null;

export function deliveryBucket(p: Pick<CatalogProject, "ready" | "completionKey">, now: Date): DeliveryBucket | null {
  if (p.ready) return "ready";
  if (p.completionKey == null) return null;
  const year = new Date(p.completionKey).getUTCFullYear();
  const thisYear = now.getUTCFullYear();
  if (year <= thisYear) return "thisYear";
  if (year === thisYear + 1) return "nextYear";
  return "later";
}

export function isNew(p: Pick<CatalogProject, "addedAt">, now: Date): boolean {
  if (!p.addedAt) return false;
  const t = Date.parse(p.addedAt);
  return Number.isFinite(t) && now.getTime() - t <= NEW_DAYS * DAY;
}

const bedsMatch = (b: number | null, wanted: number[]) => b != null && wanted.some((w) => (w >= 5 ? b >= 5 : b === w));

export function activeFilterCount(f: CatalogFilters): number {
  return [
    f.q.trim() !== "", f.budgetMin != null || f.budgetMax != null, f.beds.length > 0, f.types.length > 0,
    f.districts.length > 0, f.areas.length > 0, f.delivery.length > 0, f.addedWithin != null, f.minRate != null, f.onlyFree,
  ].filter(Boolean).length;
}

export function filterProjects(projects: CatalogProject[], f: CatalogFilters, now: Date): ShownProject[] {
  const words = norm(f.q).split(/\s+/).filter(Boolean);
  const dKeys = new Set(f.districts.map(placeKey));
  const aKeys = new Set(f.areas.map(placeKey));
  const hasBudget = f.budgetMin != null || f.budgetMax != null;
  const unitCriteria = hasBudget || f.beds.length > 0 || f.types.length > 0;
  // An area narrows only its own district: with Paphos + Limassol and the area
  // Peyia picked, Paphos shows Peyia and Limassol stays whole.
  const narrowed = new Set<string>();
  if (aKeys.size) for (const p of projects) if (aKeys.has(placeKey(p.area))) narrowed.add(placeKey(districtOf(p)));
  const out: ShownProject[] = [];
  for (const p of projects) {
    if (words.length) {
      const hay = norm([p.name, p.town, p.district, p.area].filter(Boolean).join(" "));
      if (!words.every((w) => hay.includes(w))) continue;
    }
    if (dKeys.size && !dKeys.has(placeKey(districtOf(p)))) continue;
    if (narrowed.has(placeKey(districtOf(p))) && !aKeys.has(placeKey(p.area))) continue;
    if (f.delivery.length) {
      const b = deliveryBucket(p, now);
      if (!b || !f.delivery.includes(b)) continue;
    }
    if (f.addedWithin != null) {
      const t = p.addedAt ? Date.parse(p.addedAt) : NaN;
      if (!Number.isFinite(t) || now.getTime() - t > f.addedWithin * DAY) continue;
    }
    if (f.minRate != null && (p.handoverRate == null || p.handoverRate < f.minRate)) continue;
    if (f.onlyFree && p.unitsTotal > 0 && p.unitsFree === 0) continue;

    let shownFrom = p.priceFrom;
    if (unitCriteria) {
      if (p.units.length) {
        const hits = p.units.filter((u) => {
          if (hasBudget) {
            if (u.p == null) return false;
            if (f.budgetMin != null && u.p < f.budgetMin) return false;
            if (f.budgetMax != null && u.p > f.budgetMax) return false;
          }
          if (f.beds.length && !bedsMatch(u.b, f.beds)) return false;
          if (f.types.length && (!u.t || !f.types.includes(u.t))) return false;
          return true;
        });
        if (!hits.length) continue;
        const prices = hits.map((u) => u.p).filter((x): x is number => x != null);
        shownFrom = prices.length ? Math.min(...prices) : p.priceFrom;
      } else {
        // No unit list: bedrooms and type cannot be confirmed; the budget is checked on the project price.
        if (f.beds.length || f.types.length) continue;
        if (p.priceFrom == null || (f.budgetMax != null && p.priceFrom > f.budgetMax)) continue;
      }
    }
    out.push({ ...p, shownFrom });
  }
  return out;
}

export type SortKey = "name" | "place" | "price" | "beds" | "free" | "delivery" | "added" | "handover" | "fix" | "our";
export type SortDir = "asc" | "desc";
/** The direction a column sorts in on its first click. */
export const FIRST_DIR: Record<SortKey, SortDir> = {
  name: "asc", place: "asc", price: "asc", beds: "asc", free: "desc", delivery: "asc", added: "desc", handover: "desc", fix: "desc", our: "desc",
};

const DELIVERY_ORDER: Record<DeliveryBucket, number> = { ready: 0, thisYear: 1, nextYear: 2, later: 3 };

function sortValue(p: ShownProject, key: SortKey): number | string | null {
  switch (key) {
    case "name": return norm(p.name);
    case "place": return norm([districtOf(p), p.area].filter(Boolean).join(" ")) || null;
    case "price": return p.shownFrom;
    case "beds": return p.bedsMin;
    case "free": return p.unitsTotal ? p.unitsFree : null;
    // Ready first, then by the stated period.
    case "delivery": return p.ready ? -Infinity : p.completionKey;
    case "added": return p.addedAt ? Date.parse(p.addedAt) : null;
    case "handover": return p.handoverRate;
    case "fix": return p.fixRate;
    case "our": return p.ourRate;
  }
}

/** Stable sort; missing values always last, ties by name. */
export function sortProjects(projects: ShownProject[], key: SortKey, dir: SortDir): ShownProject[] {
  const sign = dir === "asc" ? 1 : -1;
  return projects
    .map((p, i) => ({ p, i, v: sortValue(p, key) }))
    .sort((a, b) => {
      if (a.v == null && b.v != null) return 1;
      if (b.v == null && a.v != null) return -1;
      if (a.v != null && b.v != null && a.v !== b.v) {
        const c = typeof a.v === "string" ? a.v.localeCompare(b.v as string) : (a.v as number) - (b.v as number);
        if (c) return c * sign;
      }
      return norm(a.p.name).localeCompare(norm(b.p.name)) || a.i - b.i;
    })
    .map((x) => x.p);
}

/** District chips and, per district, its area chips — one label per place whatever the spelling. */
export function placeOptions(projects: CatalogProject[]): { districts: string[]; areasByDistrict: Record<string, string[]> } {
  const districts = new Map<string, string>();
  const areas = new Map<string, Map<string, string>>();
  for (const p of projects) {
    const d = districtOf(p);
    if (!d) continue;
    const dk = placeKey(d);
    if (!districts.has(dk)) districts.set(dk, d);
    const a = p.area?.trim();
    if (a && placeKey(a) !== dk) {
      const m = areas.get(dk) ?? new Map<string, string>();
      if (!m.has(placeKey(a))) m.set(placeKey(a), a);
      areas.set(dk, m);
    }
  }
  const byLabel = (a: string, b: string) => a.localeCompare(b);
  const areasByDistrict: Record<string, string[]> = {};
  districts.forEach((label, dk) => { areasByDistrict[label] = Array.from(areas.get(dk)?.values() ?? []).sort(byLabel); });
  return { districts: Array.from(districts.values()).sort(byLabel), areasByDistrict };
}
