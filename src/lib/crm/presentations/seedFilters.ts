// Starting filters for the property picker: from the lead's profile (and the
// last search saved on the lead), or from the projects a client favorited.
import type { MatchFilters } from "@/lib/crm/matching";

type LeadSeed = { budgetMin: number | null; budgetMax: number | null; propertyTypeInterest: string[]; lastMatchFilters: unknown };

/** Same init as the old matching panel: the last saved search wins over the lead profile. Lead has no bedroom or location fields. */
export function initialFilters(lead: LeadSeed): MatchFilters {
  const saved = lead.lastMatchFilters;
  const overlay = saved && typeof saved === "object" && !Array.isArray(saved) ? (saved as MatchFilters) : {};
  return {
    budgetMin: lead.budgetMin, budgetMax: lead.budgetMax,
    bedrooms: [], districts: [], areas: [], propertyTypes: lead.propertyTypeInterest ?? [],
    includeReady: false, onlyAvailable: true,
    ...overlay,
  };
}

export type FavoriteSeed = { district: string | null; area: string | null; prices: number[]; beds: (number | null)[]; types: string[] };

const distinct = <T,>(xs: T[]) => xs.filter((x, i) => xs.indexOf(x) === i);

/** Filters that would find more of what the client hearted: a band around their prices, their places, sizes and types. */
export function filtersFromFavorites(favs: FavoriteSeed[]): MatchFilters {
  const prices = favs.flatMap((f) => f.prices).filter((p) => Number.isFinite(p));
  return {
    budgetMin: prices.length ? Math.round(Math.min(...prices) * 0.85) : null,
    budgetMax: prices.length ? Math.round(Math.max(...prices) * 1.15) : null,
    bedrooms: distinct(favs.flatMap((f) => f.beds).filter((b): b is number => b != null).map((b) => (b >= 5 ? 5 : b))),
    districts: distinct(favs.map((f) => f.district).filter((x): x is string => !!x)),
    areas: distinct(favs.map((f) => f.area).filter((x): x is string => !!x)),
    propertyTypes: distinct(favs.flatMap((f) => f.types).filter((x) => !!x)),
    includeReady: false, onlyAvailable: true,
  };
}
