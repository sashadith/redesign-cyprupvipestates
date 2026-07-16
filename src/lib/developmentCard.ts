// Shared field-resolution for a Development, used by BOTH the detail page
// (ProjectPageBody.tsx via developmentRender.ts) and the merged /projects
// listing's card query (queryFilteredDevelopmentRows in sanity.utils.ts).
// Extracted after the two surfaces drifted apart: the listing card was
// re-deriving price/beds/location/type with weaker inline logic instead of
// reusing what the detail page already got right — one Development
// ("Luma Genesis") showed "Price on request" and "2-2 bed" on the card while
// its own detail page correctly showed "from €270,000" and per-unit beds.
// Keep every one of these as the single source of truth; do not
// re-implement any of this inline again on either surface.

type UnitLike = { status?: string | null; price?: number | null; beds?: string | null; type?: string | null };

// Development.priceFrom/priceTo can be null even when real unit prices exist
// (unit-driven feeds, and manually-created developments never get a
// project-level price set by any adapter) — fall back to the available
// units' own price range rather than showing "Price on request" when real
// prices are one join away.
export function resolveDevelopmentPrice(
  devPriceFrom: number | null,
  devPriceTo: number | null,
  units: UnitLike[],
): { priceFrom: number | null; priceTo: number | null } {
  const availablePrices = units
    .filter((u) => u.status === "available" && u.price != null)
    .map((u) => u.price as number);
  const priceFrom = devPriceFrom ?? (availablePrices.length ? Math.min(...availablePrices) : null);
  const priceTo = devPriceTo ?? (availablePrices.length ? Math.max(...availablePrices) : priceFrom);
  return { priceFrom, priceTo };
}

// Beds are stored as a free string per unit ("2", "3+1" — bedrooms + maid's
// room, "ST"/"Studio", or occasionally empty). Reduce to a single
// representative number per unit — the FIRST number in the string, not every
// number matched (a naive /\d+/g match on "3+1" would wrongly treat the "+1"
// as a second bedroom count and corrupt the range) — and treat any
// studio-style unit as 0 bedrooms.
function unitBedNumber(beds: string | null | undefined): number | null {
  const s = String(beds ?? "").trim();
  if (!s) return null;
  if (/^st(udio)?$/i.test(s)) return 0;
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : null;
}

// Only available units count — same population resolveDevelopmentPrice uses,
// so "how many bedrooms can I actually buy here" stays consistent with
// "from what price". Returns "" (nothing to show), "Studio", a single number
// as a string ("2" — never "2-2"), or a "lo-hi" range ("1-3").
export function resolveBedRange(units: UnitLike[]): string {
  const nums = units
    .filter((u) => u.status === "available")
    .map((u) => unitBedNumber(u.beds))
    .filter((n): n is number => n != null);
  if (!nums.length) return "";
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  if (lo === hi) return lo === 0 ? "Studio" : String(lo);
  return `${lo}-${hi}`;
}

// Dedupe + join district/town/area (whichever are set, in that display
// order) with the same " · " separator used everywhere else location text
// is composed. Case-insensitive dedupe: a feed that repeats the same name in
// two of the three fields (e.g. town === area) shouldn't show it twice.
export function resolveDevelopmentLocation(...parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const p = (raw ?? "").trim();
    if (p && !seen.has(p.toLowerCase())) { seen.add(p.toLowerCase()); out.push(p); }
  }
  return out.join(" · ");
}

// The detail page's own "type" stat is derived from the actual unit types,
// not the Development's own (often unset, or feed-vocabulary-mismatched)
// `category` scalar — e.g. Luma Genesis has category=null but every unit is
// type="Apartment". Only fall back to category when no unit has a type at
// all (a development with no synced units yet).
export function resolveDevelopmentType(category: string | null | undefined, units: UnitLike[]): string {
  const types = Array.from(new Set(units.map((u) => (u.type ?? "").trim()).filter(Boolean)));
  if (types.length) return types.join(" · ");
  return (category ?? "").trim();
}
