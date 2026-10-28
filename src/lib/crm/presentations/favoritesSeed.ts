// "New from favorites": turns the developments a client hearted in a
// selection into starting filters for a new one, plus those projects
// pre-ticked. Pure (no Prisma) so the mapping is testable; the action in
// src/app/crm/leads/presentationActions.ts loads the rows.
import { normalizeType, parseBeds, type MatchFilters } from "@/lib/crm/matching";
import { filtersFromFavorites, type FavoriteSeed } from "./seedFilters";

type Loc = { district: string | null; town: string | null; area: string | null };

export type FavoriteDevRow = Loc & {
  id: string;
  publicName: string;
  override: Loc | null;
  units: { status: string | null; price: number | null; beds: string | null; type: string | null }[];
};

export type FavoritesSeed = { filters: MatchFilters; preselect: string[]; preselectNames: Record<string, string> };

// normalizeType's values ("apartment", "villa", …) as the filter's chip labels.
const typeLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** The one filter type a project stands for: the most common among its available units. */
function mainType(units: FavoriteDevRow["units"]): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;
  let bestCount = 0;
  for (let i = 0; i < units.length; i++) {
    const t = normalizeType(units[i].type);
    if (!t) continue;
    const n = (counts.get(t) ?? 0) + 1;
    counts.set(t, n);
    if (n > bestCount) { best = t; bestCount = n; }
  }
  return best ? typeLabel(best) : null;
}

/** Same location precedence as listPresentationLocationOptions: override, then the row; district falls back to town. */
export function favoriteSeeds(rows: FavoriteDevRow[]): FavoriteSeed[] {
  return rows.map((r) => {
    const town = r.override?.town || r.town;
    const available = r.units.filter((u) => u.status === "available");
    return {
      district: r.override?.district || r.district || town || null,
      area: r.override?.area || r.area || null,
      prices: available.map((u) => u.price).filter((p): p is number => typeof p === "number" && p > 0),
      beds: available.map((u) => parseBeds(u.beds)).filter((b) => b != null),
      type: mainType(available),
    };
  });
}

export function favoritesSeedFromRows(rows: FavoriteDevRow[]): FavoritesSeed {
  const preselectNames: Record<string, string> = {};
  rows.forEach((r) => { preselectNames[r.id] = r.publicName; });
  return { filters: filtersFromFavorites(favoriteSeeds(rows)), preselect: rows.map((r) => r.id), preselectNames };
}
