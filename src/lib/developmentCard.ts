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

type UnitLike = { status?: string | null; price?: number | null; beds?: string | null; type?: string | null; areaBuilt?: string | null };

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

// Built-area range shown on the /projects listing card ("58-105", or a single
// "58" when every available unit is the same size) — same available-only
// population as resolveBedRange/resolveDevelopmentPrice, so a sold-out
// building's largest resale unit can't quietly widen the range a buyer would
// actually be offered. "" when no available unit has a parseable area (the
// card omits the row entirely, same as an empty bedrooms/price). Values
// aren't always suffixed "m²" at the source (feed data) — extract the
// leading number rather than trusting the raw string, and round for a
// compact card figure (the detail page's own unit-by-unit facts keep full
// precision; this is a summary).
function unitAreaNumber(area: string | null | undefined): number | null {
  const m = String(area ?? "").replace(",", ".").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}
export function resolveBuildAreaRange(units: UnitLike[]): string {
  const nums = units
    .filter((u) => u.status === "available")
    .map((u) => unitAreaNumber(u.areaBuilt))
    .filter((n): n is number => n != null && n > 0);
  if (!nums.length) return "";
  const lo = Math.round(Math.min(...nums));
  const hi = Math.round(Math.max(...nums));
  return lo === hi ? String(lo) : `${lo}-${hi}`;
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
//
// Raw unit.type is feed-sourced and NOT normalized (confirmed against real
// data 2026-08-04: "Villa"/"villa"/"Villas" and "Apartment"/"apartment"/
// "Apartments" all occur as distinct literal strings). A plain Set on the raw
// string therefore doesn't dedupe them, and a development carrying more than
// one casing/plural of the same real type showed every variant side by side
// (e.g. "Villa · villa · Villas"). Grouped here case- and simple-plural-
// insensitively instead; the display value per group is whichever raw
// casing is most common among this development's own units (ties keep the
// first-seen form), so the output stays grounded in the real feed data
// rather than an invented canonical spelling.
export function resolveDevelopmentType(category: string | null | undefined, units: UnitLike[]): string {
  const order: string[] = [];
  const variantCounts: Record<string, Record<string, number>> = {};
  for (const u of units) {
    const raw = (u.type ?? "").trim();
    if (!raw) continue;
    const dedupKey = raw.toLowerCase().replace(/s$/, "");
    if (!variantCounts[dedupKey]) {
      variantCounts[dedupKey] = {};
      order.push(dedupKey);
    }
    variantCounts[dedupKey][raw] = (variantCounts[dedupKey][raw] ?? 0) + 1;
  }
  const types = order.map((dedupKey) => {
    let best = "";
    let bestCount = -1;
    for (const [raw, count] of Object.entries(variantCounts[dedupKey])) {
      if (count > bestCount) { best = raw; bestCount = count; }
    }
    return best;
  });
  if (types.length) return types.join(" · ");
  return (category ?? "").trim();
}

// Catalogue/landing-page propertyType filter match. Every other filter value
// still does a plain substring check against the resolveDevelopmentType()
// output — unchanged, see the final return. "Commercial" and "Semi-detached
// villa" are the two exceptions:
// - "Commercial": no unit in this codebase is literally typed "Commercial"
//   today (they're typed "Office"/"Shop", the feed's own vocabulary — see the
//   Commercial-catalogue-tagging investigation, 2026-07-29), so a plain
//   substring match against "Commercial" would never match any of them.
// - "Semi-detached villa": the admin's filter *label* is "Semi-detached
//   villa", but the raw feed vocabulary (confirmed against real data
//   2026-08-04) only ever produces "Semi-detached" — never with "villa"
//   appended — so `resolved.includes("semi-detached villa")` could never
//   match anything; the filter was silently dead for every development that
//   actually has this unit type (verified: exactly one, Zephyros Village 3).
// Broadening ONLY these two filter values keeps the change additive — every
// other filter value's matching behavior, and every existing city+type
// landing page, is untouched.
export function matchesPropertyTypeFilter(resolvedType: string, filterValue: string): boolean {
  const resolved = resolvedType.toLowerCase();
  const filter = filterValue.toLowerCase();
  if (filter === "commercial") return resolved.includes("commercial") || resolved.includes("office") || resolved.includes("shop");
  if (filter === "semi-detached villa") return resolved.includes("semi-detached");
  return resolved.includes(filter);
}

// The merged /projects listing card reuses the LEGACY compact-4-footer
// renderer (cardDistances/CARD_DIST_ORDER in ProjectsExplorer.tsx — Beach ·
// School · Golf · Airport) verbatim, so a Development's stored distances
// (numbers, key "golf" — see src/lib/developmentDistances.ts) need adapting
// to that renderer's expected shape (numeric strings, key "golfCourt") at the
// card-DTO boundary only. The DB storage shape and the new DistancesStrip
// component both keep the "golf"/number shape — only this one adapter exists,
// so the two shapes can't silently drift back together wrong.
export function toCardDistances(distances: Record<string, number> | null | undefined): Record<string, string> | null {
  if (!distances) return null;
  const out: Record<string, string> = {};
  for (const [key, minutes] of Object.entries(distances)) {
    const cardKey = key === "golf" ? "golfCourt" : key;
    out[cardKey] = String(minutes);
  }
  return Object.keys(out).length ? out : null;
}
