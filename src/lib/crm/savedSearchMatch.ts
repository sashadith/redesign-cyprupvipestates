import { locationMatch, parseBeds, normalizeType, rangesOverlap, widen } from "@/lib/crm/matching";

/* "Which leads were looking for something like this?" — answered from the one
   piece of stored evidence there is.
 *
 * Matching results are not persisted anywhere. `matchDevelopmentsForLead()`
 * loads EVERY published development and scores it, so asking it per lead would
 * be one full-catalogue scan per lead on every page load. What IS stored is
 * `Lead.lastMatchFilters`: the filter state the advisor actually had on screen
 * the last time they searched for this client. So this inverts the question —
 * given one development, does it fall inside that saved search — which is a
 * containment test over data we already hold.
 *
 * It deliberately reuses the matcher's own primitives (locationMatch,
 * parseBeds, normalizeType, rangesOverlap, widen) rather than restating the
 * rules. A second, hand-rolled copy of "does this bedroom count fit" is how
 * two surfaces start disagreeing about the same lead, and the whole column
 * would then quietly contradict the matching panel next to it.
 *
 * What it is NOT: the matcher's tiered score. This answers "inside the search"
 * — a weaker, honest claim — and the column is labelled to say exactly that.
 */

export type SavedSearch = {
  districts?: unknown; areas?: unknown; bedrooms?: unknown; propertyTypes?: unknown;
  budgetMin?: unknown; budgetMax?: unknown;
};

export type DevFacts = {
  district: string | null; town: string | null; area: string | null;
  units: { status: string | null; beds: string | null; type: string | null; price: number | null }[];
};

const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
const nums = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((x): x is number => typeof x === "number" && Number.isFinite(x)) : [];
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** True when this development satisfies every criterion the saved search set.
 *  A criterion the advisor left empty is not a filter and is skipped — an
 *  empty search would otherwise match nothing, which reads as "no interest"
 *  when it means "no filter". */
export function matchesSavedSearch(
  dev: DevFacts,
  search: SavedSearch | null,
  lead: { budgetMin: number | null; budgetMax: number | null; propertyTypeInterest: string[] },
): boolean {
  const available = dev.units.filter((u) => u.status === "available");
  if (!available.length) return false; // a sold-out project is nobody's live search result

  const districts = strs(search?.districts).map((s) => s.toLowerCase());
  const areas = strs(search?.areas).map((s) => s.toLowerCase());
  if (districts.length) {
    const { districtMatches } = locationMatch(dev, districts, areas);
    if (!districtMatches) return false;
  }

  const beds = nums(search?.bedrooms);
  if (beds.length) {
    const devBeds = available.map((u) => parseBeds(u.beds)).filter((n): n is number => n != null);
    if (!devBeds.some((b) => beds.includes(b))) return false;
  }

  // The panel's own type list wins; the lead's standing interest is the
  // fallback, exactly as matchDevelopmentsForLead resolves it.
  const types = (strs(search?.propertyTypes).length ? strs(search?.propertyTypes) : lead.propertyTypeInterest)
    .map(normalizeType).filter((t): t is string => !!t);
  if (types.length) {
    const devTypes = available.map((u) => normalizeType(u.type)).filter((t): t is string => !!t);
    if (!devTypes.some((t) => types.includes(t))) return false;
  }

  // Budget uses the matcher's full-match band (±10%), not a bare comparison,
  // so a project 5% over a stated ceiling is treated here the way the matching
  // panel treats it: still in.
  const bMin = num(search?.budgetMin) ?? lead.budgetMin;
  const bMax = num(search?.budgetMax) ?? lead.budgetMax;
  if (bMin != null || bMax != null) {
    const prices = available.map((u) => u.price).filter((p): p is number => typeof p === "number" && p > 0);
    if (!prices.length) return false;
    const { lo, hi } = widen(bMin, bMax, 0.10);
    if (!rangesOverlap(Math.min(...prices), Math.max(...prices), lo, hi)) return false;
  }

  // Nothing was filtered on at all — that is not a search, so it is not a hit.
  return districts.length > 0 || beds.length > 0 || types.length > 0 || bMin != null || bMax != null;
}
