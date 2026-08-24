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

import { isListedUnit } from "@/lib/developmentAvailability";
import { resolveRelativeCompletion } from "@/lib/completionDate";

type UnitLike = { status?: string | null; price?: number | null; beds?: string | null; type?: string | null; areaBuilt?: string | null };

// Development.priceFrom/priceTo can be null even when real unit prices exist
// (unit-driven feeds, and manually-created developments never get a
// project-level price set by any adapter) — fall back to the available
// units' own price range rather than showing "Price on request" when real
// prices are one join away. A fully sold-out development has zero
// "available" units by definition, so that fallback alone still leaves it
// priceless (found 2026-08-06: Celestia's own sold-out hero showed "—"
// instead of "sold from €170,000", the same gap as the alternatives funnel's
// currentPrice derivation — see developmentAlternatives.ts). Second
// fallback: the cheapest unit price of ANY status — the price it actually
// sold for, which every caller already labels as a past/sold price rather
// than a live offer (this page's own "sold from" caption, and
// DevelopmentSchema's Offer.availability: SoldOut on the JSON-LD side), so
// showing it here doesn't misrepresent it as current stock.
export function resolveDevelopmentPrice(
  devPriceFrom: number | null,
  devPriceTo: number | null,
  units: UnitLike[],
): { priceFrom: number | null; priceTo: number | null } {
  const availablePrices = units
    .filter((u) => u.status === "available" && u.price != null)
    .map((u) => u.price as number);
  const anyPrices = units.filter((u) => u.price != null).map((u) => u.price as number);
  const pricePool = availablePrices.length ? availablePrices : anyPrices;
  const priceFrom = devPriceFrom ?? (pricePool.length ? Math.min(...pricePool) : null);
  const priceTo = devPriceTo ?? (pricePool.length ? Math.max(...pricePool) : priceFrom);
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
// Polis Chrysochous and Kouklia are their own districts internally (see
// docs/DISTRICTS-POLIS-KOUKLIA.md), but administratively both sit INSIDE the
// Paphos district. The public projects filter only offers Paphos/Limassol/
// Larnaca, and matches a development by exact string against its location
// list — so without the parent, the 10 published Venus Rock / Polis projects
// would answer to neither "Paphos" nor "Limassol" and be reachable only via
// "All cities". Returning both keeps the public filter behaving exactly as it
// does today while the CRM gets the finer split.
//
// This is a PUBLIC-FILTER concern only. The CRM district list is built from
// Development.district directly and must NOT go through here, or Polis and
// Kouklia would collapse back into Paphos and the whole split would be undone.
const PARENT_DISTRICT: Record<string, string> = { polis: "Paphos", kouklia: "Paphos" };

/** A district plus its administrative parent, if it has one. Public filter use only. */
export function districtWithParent(district: string | null | undefined): string[] {
  const d = (district ?? "").trim();
  if (!d) return [];
  const parent = PARENT_DISTRICT[d.toLowerCase()];
  return parent && parent.toLowerCase() !== d.toLowerCase() ? [d, parent] : [d];
}

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
// Three-step resolution, in order:
//   1. LISTED units' types — the population a visitor can actually see. A type
//      carried only by units that vanished from the feed is not on offer:
//      Onero Residences advertised "Apartments · Maisonettes" on its page, its
//      listing card, and to the catalogue's Maisonette filter, while all three
//      of its maisonette units were unlisted (2026-08-20).
//   2. ALL units' types, when nothing is listed any more. A sold-out/withdrawn
//      development keeps the type it was actually built as — dropping to step 3
//      there would relabel Royal Residences and Ridge Residences from
//      "Villa"/"Villas" to the generic category "Residential", which is a
//      worse answer than the slightly stale one.
//   3. `category`, only when no unit anywhere carries a type.
//
// Step 1 also feeds matchesPropertyTypeFilter below, i.e. catalogue filter
// membership — measured 2026-08-20 over the full catalogue population (129
// published, slugged developments) against the four values the UI actually
// offers (projectsI18n.ts): Apartment 72, Villa 48, Townhouse 1, Commercial 8,
// all unchanged, and the alternatives commercial-gate unchanged too. No
// selectable filter moves: the types that drop out are only ever carried by
// unlisted units, and no development is reachable through such a type alone.
// Exactly two displayed type strings change — Onero ("Apartments · Maisonettes"
// -> "Apartments", the fix) and :salt, where only the ORDER shifts
// ("Apartment · Studio" -> "Studio · Apartment") because the order follows the
// unit rows and its unlisted rows happened to come first.
// Feed vocabularies disagree on case: Medousa ships "villa"/"studio"/
// "apartment" lower-case, others ship them capitalised. Uppercase the first
// letter for DISPLAY only — the stored value keeps the feed's own spelling, so
// matchesPropertyTypeFilter (which lower-cases both sides) and any debugging
// against the raw feed are unaffected.
// Only the first letter, deliberately: full title case would turn
// "semi-detached house" into "Semi-Detached House", which is not how the type
// reads in English.
export function capitalizeType(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

export function resolveDevelopmentType(category: string | null | undefined, units: UnitLike[]): string {
  const typesOf = (pool: UnitLike[]) =>
    Array.from(new Set(pool.map((u) => capitalizeType((u.type ?? "").trim())).filter(Boolean)));
  const listed = typesOf(units.filter(isListedUnit));
  if (listed.length) return listed.join(" · ");
  const all = typesOf(units);
  if (all.length) return all.join(" · ");
  return capitalizeType((category ?? "").trim());
}

// Catalogue/landing-page propertyType filter match. Every other filter value
// still does a plain substring check against the resolveDevelopmentType()
// output — unchanged, see the else branch. "Commercial" is the one
// exception: no unit in this codebase is literally typed "Commercial" today
// (they're typed "Office"/"Shop", the feed's own vocabulary — see the
// Commercial-catalogue-tagging investigation, 2026-07-29), so a plain
// substring match against "Commercial" would never match any of them.
// Broadening ONLY this one filter value to also accept office/shop keeps the
// change additive — every other filter value's matching behavior, and every
// existing city+type landing page, is untouched.
export function matchesPropertyTypeFilter(resolvedType: string, filterValue: string): boolean {
  const resolved = resolvedType.toLowerCase();
  const filter = filterValue.toLowerCase();
  if (filter === "commercial") return resolved.includes("commercial") || resolved.includes("office") || resolved.includes("shop");
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
// Development.completion is a free-text string (adapter-dependent — sampled
// real values include both "Q3 2028" already-quarter and "November 2028"
// month-name forms). Used by the Personal Selection card's delivery line
// (2026-08-13) — only ever shows a value it's confident about; anything it
// can't parse into a clean "QN YYYY" is treated the same as no date at all
// (omitted), never guessed or shown malformed.
export { resolveRelativeCompletion };

const MONTH_TO_QUARTER: Record<string, number> = {
  january: 1, february: 1, march: 1,
  april: 2, may: 2, june: 2,
  july: 3, august: 3, september: 3,
  october: 4, november: 4, december: 4,
};
export function toDeliveryQuarter(completion: string | null | undefined): string | null {
  // Defensive: the two render funnels (mapRowToVM, mapDevelopmentRowToCard)
  // already resolve the relative form, but this is also called with raw values.
  const s = resolveRelativeCompletion(completion);
  if (!s) return null;
  const direct = s.match(/^Q([1-4])\s+(\d{4})$/i);
  if (direct) return `Q${direct[1]} ${direct[2]}`;
  const monthYear = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const q = MONTH_TO_QUARTER[monthYear[1].toLowerCase()];
    if (q) return `Q${q} ${monthYear[2]}`;
  }
  return null;
}

export function toCardDistances(distances: Record<string, number> | null | undefined): Record<string, string> | null {
  if (!distances) return null;
  const out: Record<string, string> = {};
  for (const [key, minutes] of Object.entries(distances)) {
    const cardKey = key === "golf" ? "golfCourt" : key;
    out[cardKey] = String(minutes);
  }
  return Object.keys(out).length ? out : null;
}
