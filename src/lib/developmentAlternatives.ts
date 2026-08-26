// "Similar projects" for the Development detail page (Bündel 1, 2026-07-31) —
// same ranking logic on every project page: prominent under the sold-out
// banner when the current project is sold out, a quiet strip further down
// when it isn't. Only ever suggests projects that are themselves published
// AND have at least one available unit (computeAvailability) — a sold-out
// project as an "alternative" would defeat the point.
//
// Commercial vs. residential is a CATEGORICAL boundary, not a preference —
// unlike "villa vs apartment" (a taste the last stage is allowed to ignore),
// a Gewerbeimmobilie must never surface a home as an "alternative" and a
// Wohnimmobilie must never surface an office/shop, at ANY stage (bug found
// 2026-08-06: stage 3 dropped the type filter entirely, so this boundary
// leaked once stages 1-2 couldn't fill the list). Enforced up front by
// excluding different-bucket candidates from the pool before any staging
// runs — structurally impossible for a later, looser stage to let one back
// in. "Commercial" reuses matchesPropertyTypeFilter (developmentCard.ts),
// the SAME classification the /projects catalogue filter already uses
// (office/shop count as commercial; nothing else does) — one definition,
// not two that can silently disagree.
//
// Ranking funnel WITHIN the current development's own bucket, each stage a
// HARD filter (never guessed/loosened silently):
//   1. same developer AND same location, same property type, price within ±40%
//   2. same developer OR  same location, same property type, price within ±40%
//   3. same developer OR  same location, price within ±60% — the fine-grained
//      type preference (villa/apartment/studio/...) is dropped here, never
//      the commercial/residential bucket.
//   4. (final last resort, added 2026-08-06) developer AND location BOTH
//      dropped, type preference reinstated, price within ±60% — "similar
//      property, similar price, anywhere in Cyprus". Traced 2026-08-06: 9 of
//      the then-13 blockless projects (e.g. Luma Genesis, Quatrro, Lazzero
//      Park) had a real price and reachable candidates but never enough
//      sharing a developer or location — stages 1-3 all require at least
//      one of the two, so a project with neither ran out of road. Same-
//      location candidates still sort first within this stage (see
//      fillLocationFirst) purely as a tie-breaker, so a project with a thin
//      but non-empty same-district pool doesn't get buried under
//      closer-priced but farther-away suggestions.
// Each stage tops up toward MAX_ALTERNATIVES and only stops once full — a
// stage that lands on exactly MIN_ALTERNATIVES (3) still advances to the next,
// looser stage looking for a 4th (fixed 2026-08-06: it used to stop the moment
// it cleared MIN_ALTERNATIVES, leaving a project stuck at 3 in a 4-column grid
// even when a legitimate 4th candidate existed one stage further out).
// Fewer than MIN_ALTERNATIVES after stage 4 → return [] (the caller omits the
// block entirely rather than show weak/random suggestions) — this is also
// what makes a Gewerbeimmobilie's block silently disappear when there simply
// aren't 3+ other commercial developments to suggest, by design.
//
// NO PRICE BASIS AT ALL (2026-08-24): a development can have neither its own
// priceFrom nor a single priced unit — Grato Homes 2 (sold out the same day,
// 1 manually-added "sold" row + 3 feed "reserved" rows, every price null) hit
// this and got zero alternatives while 76 genuine Paphos candidates existed.
// The funnel used to bail out here (`currentPrice == null → return []`)
// because every stage filtered on a price band. It now runs its OWN four
// stages (see the `currentPrice == null` branch below), deliberately not the
// priced order with the band switched off — that first attempt shipped and
// was wrong: it kept the priced funnel's "developer or location, type
// dropped" stage ahead of "same type anywhere", and offered a sold-out Sea
// Caves luxury villa four of its own developer's Paphos APARTMENT projects.
// Without a price band there is nothing left to stop a mismatch like that,
// so type moves up and the developer stops being a filter:
//   1. same neighbourhood AND same type   2. same location AND same type
//   3. same type anywhere                 4. developer OR location, no type
// Ranking within a stage: neighbourhood → type → district → closest built
// area → same developer → cheapest. Built area stands in for price proximity
// (a 205 m² villa and a 341 m² villa aren't the same market even on the same
// hillside); developer ranks last, as a tie-breaker, never as a reason.
// Everything else is unchanged: the commercial/residential boundary, the
// sold-out exclusion and the MIN_ALTERNATIVES floor all still apply, so a
// price-less project with a thin pool still shows no block rather than a weak
// one.
//
// Commercial developments skip this funnel entirely (2026-08-06): with only
// 5 published commercial developments total, developer/location/price
// filtering routinely filtered the pool down to nothing worth showing (e.g.
// Qube Offices, the one INEX commercial project, shares neither developer
// nor location with the four BBF ones and got zero alternatives under the
// residential-shaped funnel even with the price band removed). At this
// population size there's no meaningful "best match" to rank for — every
// other commercial development is a reasonable suggestion — so it's just
// every other same-bucket development, sorted by price proximity, capped at
// MAX_ALTERNATIVES. The categorical boundary itself (already enforced when
// `candidates` is built, see isCommercial() below) still applies — nothing
// here can pull in a residential project.
import { prisma } from "@/lib/prisma";
import { computeAvailability } from "@/lib/developmentAvailability";
import { resolveDevelopmentType, matchesPropertyTypeFilter } from "@/lib/developmentCard";
import { resolveCompletionYear } from "@/lib/text";
import { mapDevelopmentRowToCard } from "@/sanity/sanity.utils";
import { localizedHref } from "@/lib/locale";
import type { ProjectCardData } from "@/app/preview-projects/ProjectCard";

const PRICE_BAND_TIGHT = 0.4; // ±40% — stages 1 and 2
const PRICE_BAND_LOOSE = 0.6; // ±60% — stages 3 and 4 (last resorts)
const MIN_ALTERNATIVES = 3;
const MAX_ALTERNATIVES = 4;

type UnitLike = { status: string | null; type: string | null; price: number | null; areaBuilt?: string | null; beds?: string | null };

// Feed vocabularies disagree on number and wording for the SAME property type:
// "villa" (286 units) vs "villas" (222), "apartment" (1032) vs "apartments"
// (89), and — where a development has no unit types at all — a free-text
// category like "High-End Luxury Villas" or "Luxury Villas" standing in for
// one (resolveDevelopmentType falls back to the category). Token equality on
// those raw strings meant a villa project never type-matched another villa
// project unless both feeds happened to spell it identically, and a
// category-only project never matched anything at all (Grato Homes 2,
// 2026-08-24: its type resolves to the string "High-End Luxury Villas", which
// equals nothing, so every type-filtered stage was empty for it).
// Each raw string is folded to ONE canonical token, longest/most specific
// pattern first — "townhouse" and "penthouse" must be decided before the
// generic "house", or both would collapse into it. Anything that matches no
// pattern keeps its own lower-cased text, so unusual feed types
// ("restaurant", "boutique hotel") still only match their own kind.
const TYPE_CANON: [RegExp, string][] = [
  [/semi[-\s]?detached/, "semi-detached"],
  [/maisonette/, "maisonette"],
  [/town\s?house/, "townhouse"],
  [/pent\s?house/, "penthouse"],
  [/duplex/, "duplex"],
  [/bungalow/, "bungalow"],
  [/villa/, "villa"],
  [/apartment|flat|condo/, "apartment"],
  [/studio/, "studio"],
  [/plot|land/, "plot"],
  [/office/, "office"],
  [/shop|retail/, "shop"],
  [/hotel/, "hotel"],
  [/house/, "house"],
];

function canonType(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  for (const [re, canon] of TYPE_CANON) if (re.test(t)) return canon;
  return t;
}

function typeTokens(category: string | null, units: UnitLike[]): Set<string> {
  return new Set(
    resolveDevelopmentType(category, units as any)
      .split(" · ")
      .map((s) => canonType(s))
      .filter(Boolean),
  );
}

function sharesType(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false;
  return Array.from(a).some((t) => b.has(t));
}

// A development counts as "commercial" the moment ANY of its units are
// office/shop-typed — a genuinely mixed-use building (rare; see the
// 2026-08-06 investigation) is treated as commercial-bucket rather than
// residential, the more conservative choice (never surface a pure-residential
// project on a building that includes commercial space).
function isCommercial(category: string | null, units: UnitLike[]): boolean {
  return matchesPropertyTypeFilter(resolveDevelopmentType(category, units as any), "commercial");
}

function cheapestAvailable(units: UnitLike[]): number | null {
  const prices = units.filter((u) => u.status === "available" && u.price != null).map((u) => u.price as number);
  return prices.length ? Math.min(...prices) : null;
}

// A sold-out development has, by definition, zero "available" units — so
// cheapestAvailable() can never produce a price for one, no matter what.
// Found 2026-08-06 tracing why Celestia/absolute-villas/neon-homes (all sold
// out, all missing a Development.priceFrom because their feed stopped
// sending one once nothing was left to sell) got zero alternatives: the
// funnel bailed out before stage 1 even ran, on `currentPrice == null` —
// developer/location were never the bottleneck. Only used for the CURRENT
// project's own price basis, never for a candidate (candidates are always
// non-sold-out by construction — see the `if (soldOut) continue;` filter
// below — so a candidate's own live cheapestAvailable() price is what should
// represent it, not a stale one).
function cheapestOfAnyStatus(units: UnitLike[]): number | null {
  const prices = units.filter((u) => u.price != null).map((u) => u.price as number);
  return prices.length ? Math.min(...prices) : null;
}

function inBand(price: number, center: number, band: number): boolean {
  return price >= center * (1 - band) && price <= center * (1 + band);
}

// Place names are compared as normalized tokens, and the AREA and TOWN columns
// are pooled into one "micro-location" set rather than compared column-to-
// column. The feeds disagree about which column a neighbourhood belongs in:
// Grato Homes 2 is area "Sea Caves" / town "Peyia", Viewpoint Hills is area
// "Peyia" / town null, Velaro Homes is area "Sea Caves" / town "Peyia". An
// area↔area comparison (all this funnel did until 2026-08-24) makes those
// three strangers to each other even though they are the same hillside. The
// ph→f fold is the same one the project page's own location column uses, so
// "Paphos" and "Pafos" don't read as two places.
const normLoc = (s: string | null | undefined) => (s || "").toLowerCase().replace(/ph/g, "f").replace(/[^a-z]/g, "");

function microTokens(area: string | null | undefined, town: string | null | undefined): Set<string> {
  return new Set([area, town].map(normLoc).filter(Boolean));
}

function sharesMicro(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false;
  return Array.from(a).some((t) => b.has(t));
}

// Stand-in for price proximity when the current development has no price at
// all (2026-08-24). Built area is the closest thing to a price signal the
// remaining data offers — a 205 m² 4-bed villa and a 341 m² 5-bed villa are
// not in the same market even when they share a hillside and a property type.
// Taken over ALL units for the current development (a sold-out one has no
// available rows left, same reason cheapestOfAnyStatus exists) and over
// available units for a candidate, which is what a buyer could actually buy.
const numOf = (v: string | null | undefined) => {
  const m = (v || "").replace(",", ".").match(/[\d.]+/);
  const n = m ? parseFloat(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

function builtAreas(units: UnitLike[], availableOnly: boolean): number[] {
  return units
    .filter((u) => (availableOnly ? u.status === "available" : true))
    .map((u) => numOf(u.areaBuilt))
    .filter((n): n is number => n != null);
}

// Distance from `basis` to the CLOSEST unit the candidate offers — a
// development with a 160-240 m² range covers a 205 m² brief exactly, and
// shouldn't be scored on its midpoint.
function sizeDistance(basis: number, areas: number[]): number {
  if (!areas.length) return Number.POSITIVE_INFINITY;
  return Math.min(...areas.map((a) => Math.abs(a - basis)));
}

export async function getAlternativeDevelopments(currentSlug: string, lang: string): Promise<ProjectCardData[]> {
  const current = await prisma.development.findUnique({
    where: { slug: currentSlug },
    select: {
      id: true,
      developerAccountId: true,
      area: true,
      district: true,
      priceFrom: true,
      category: true,
      town: true,
      units: { select: { status: true, type: true, price: true, areaBuilt: true } },
      // area/district ARE admin-editable (DevelopmentOverride, sync never
      // touches that table — same protection every other admin field there
      // has). Reading only the raw Development columns meant an admin
      // correction here would silently do nothing for this funnel — found
      // 2026-08-06 tracing why Lazzero Park's own district was null despite
      // being clearly Paphos. Resolve override-first, same as every other
      // surface (mapDevelopmentRowToCard: `ov?.district || d.district`).
      override: { select: { area: true, district: true, town: true } },
    },
  });
  if (!current) return [];

  // null = this development carries no price anywhere (see the header comment):
  // the price band is then dropped from every stage rather than guessed at.
  const currentPrice = current.priceFrom ?? cheapestAvailable(current.units) ?? cheapestOfAnyStatus(current.units);

  const currentTypes = typeTokens(current.category, current.units);
  const currentIsCommercial = isCommercial(current.category, current.units);
  const currentMicro = microTokens(current.override?.area || current.area, current.override?.town || current.town);
  const currentDistrict = normLoc(current.override?.district || current.district);
  // Only consulted on the price-less path (see the header comment).
  const currentBuiltAreas = builtAreas(current.units, false);
  const currentBuilt = currentBuiltAreas.length ? Math.min(...currentBuiltAreas) : null;

  const rows = await prisma.development.findMany({
    where: { publishStatus: "published", id: { not: current.id } },
    select: {
      id: true,
      slug: true,
      developerAccountId: true,
      area: true,
      district: true,
      priceFrom: true,
      category: true,
      town: true,
      units: { select: { status: true, type: true, price: true, areaBuilt: true } },
      override: { select: { area: true, district: true, town: true } },
    },
  });

  type Candidate = (typeof rows)[number] & {
    price: number;
    sameDeveloper: boolean;
    sameMicro: boolean;
    sameLocation: boolean;
    typeMatch: boolean;
    sizeGap: number;
  };

  const candidates: Candidate[] = [];
  for (const d of rows) {
    if (!d.slug) continue; // published-but-no-slug would be a data anomaly — skip defensively
    const { soldOut } = computeAvailability(d.units);
    if (soldOut) continue; // never suggest a sold-out project as an alternative
    const price = d.priceFrom ?? cheapestAvailable(d.units);
    if (price == null) continue;
    if (isCommercial(d.category, d.units) !== currentIsCommercial) continue; // categorical boundary — excluded from the pool entirely, no stage can reintroduce it
    const sameDeveloper = !!current.developerAccountId && d.developerAccountId === current.developerAccountId;
    const sameMicro = sharesMicro(currentMicro, microTokens(d.override?.area || d.area, d.override?.town || d.town));
    const dDistrict = normLoc(d.override?.district || d.district);
    const sameDistrict = !!currentDistrict && !!dDistrict && currentDistrict === dDistrict;
    const sameLocation = sameMicro || sameDistrict;
    const typeMatch = sharesType(currentTypes, typeTokens(d.category, d.units));
    const sizeGap = currentBuilt == null ? Number.POSITIVE_INFINITY : sizeDistance(currentBuilt, builtAreas(d.units, true));
    candidates.push({ ...d, price, sameDeveloper, sameMicro, sameLocation, typeMatch, sizeGap });
  }

  // Closest price first — the moment a price basis exists. Without one, rank
  // by the signals that DO exist, in the order a buyer would weigh them:
  // same neighbourhood, same property type, same district, closest size —
  // and only then the developer. Developer LAST is the correction of
  // 2026-08-24: ranking it first handed a sold-out Sea Caves luxury villa
  // four of its developer's Paphos apartment projects (Arbeo/Roble/Lazzero/
  // Blossom Park) while the villa projects one hillside over went unshown.
  // Sharing a developer is a nice-to-have; sharing a market is the point.
  const rank = (a: Candidate, b: Candidate) => {
    if (a.sameMicro !== b.sameMicro) return a.sameMicro ? -1 : 1;
    if (a.typeMatch !== b.typeMatch) return a.typeMatch ? -1 : 1;
    if (a.sameLocation !== b.sameLocation) return a.sameLocation ? -1 : 1;
    // Infinity on both sides (no built-area data anywhere) must compare equal,
    // not NaN — fall through to the next criterion instead.
    const gapA = Number.isFinite(a.sizeGap) ? a.sizeGap : Number.MAX_SAFE_INTEGER;
    const gapB = Number.isFinite(b.sizeGap) ? b.sizeGap : Number.MAX_SAFE_INTEGER;
    if (gapA !== gapB) return gapA - gapB;
    if (a.sameDeveloper !== b.sameDeveloper) return a.sameDeveloper ? -1 : 1;
    return a.price - b.price;
  };

  const byRelevance = (list: Candidate[]) => {
    const sorted = [...list];
    if (currentPrice != null) {
      const basis = currentPrice;
      return sorted.sort((a, b) => Math.abs(a.price - basis) - Math.abs(b.price - basis));
    }
    return sorted.sort(rank);
  };

  const fill = (chosen: Candidate[], pool: Candidate[]) => {
    if (chosen.length >= MAX_ALTERNATIVES) return chosen;
    const seen = new Set(chosen.map((c) => c.id));
    const more = byRelevance(pool.filter((c) => !seen.has(c.id)));
    return [...chosen, ...more].slice(0, MAX_ALTERNATIVES);
  };

  // Stage 4 only: same-location candidates still come first even though
  // location is no longer a filter — otherwise a Paphos project with a thin
  // same-district market (e.g. Lazzero Park) could fill entirely with
  // Limassol suggestions ahead of the one Paphos match that does exist.
  // Within each location bucket, still closest price first.
  const fillLocationFirst = (chosen: Candidate[], pool: Candidate[]) => {
    if (chosen.length >= MAX_ALTERNATIVES) return chosen;
    const seen = new Set(chosen.map((c) => c.id));
    const rest = byRelevance(pool.filter((c) => !seen.has(c.id)));
    const more = [...rest].sort((a, b) => (a.sameLocation === b.sameLocation ? 0 : a.sameLocation ? -1 : 1));
    return [...chosen, ...more].slice(0, MAX_ALTERNATIVES);
  };

  let chosen: Candidate[];
  if (currentIsCommercial) {
    // No developer/location/price filtering — see the header comment above
    // for why. Just every other commercial development, best price match first.
    chosen = byRelevance(candidates).slice(0, MAX_ALTERNATIVES);
  } else if (currentPrice == null) {
    // ---- Price-less funnel (2026-08-24) ----
    // Its own stage order, NOT the priced one with the band switched off: the
    // priced funnel drops the type preference (stage 3) before it ever tries
    // "same type anywhere" (stage 4), which is only safe because the price
    // band is doing the real filtering underneath. With no band, that order
    // offers apartments to villa buyers. Here type outranks everything except
    // the immediate neighbourhood, and the developer is never a filter at all.
    //   1. same neighbourhood (area/town pooled) AND same type
    //   2. same location (neighbourhood or district) AND same type
    //   3. same type anywhere — neighbourhood-first within the stage (rank)
    //   4. last resort: same developer OR same location, type dropped
    chosen = byRelevance(candidates.filter((c) => c.sameMicro && c.typeMatch)).slice(0, MAX_ALTERNATIVES);
    if (chosen.length < MAX_ALTERNATIVES) {
      chosen = fill(chosen, candidates.filter((c) => c.sameLocation && c.typeMatch));
    }
    if (chosen.length < MAX_ALTERNATIVES) {
      chosen = fill(chosen, candidates.filter((c) => c.typeMatch));
    }
    if (chosen.length < MAX_ALTERNATIVES) {
      chosen = fill(chosen, candidates.filter((c) => c.sameDeveloper || c.sameLocation));
    }
  } else {
    const basis = currentPrice;
    // Stage 1: developer AND location, type required, tight price band.
    chosen = byRelevance(
      candidates.filter((c) => c.sameDeveloper && c.sameLocation && c.typeMatch && inBand(c.price, basis, PRICE_BAND_TIGHT)),
    ).slice(0, MAX_ALTERNATIVES);

    // Stage 2: developer OR location, type still required, tight price band.
    // Advances even from exactly MIN_ALTERNATIVES — only a full MAX_ALTERNATIVES
    // skips the next, looser stage (see header comment: a project stuck at 3
    // when a legitimate 4th candidate exists one stage out reads as broken).
    if (chosen.length < MAX_ALTERNATIVES) {
      chosen = fill(
        chosen,
        candidates.filter((c) => (c.sameDeveloper || c.sameLocation) && c.typeMatch && inBand(c.price, basis, PRICE_BAND_TIGHT)),
      );
    }

    // Stage 3: developer OR location, type dropped, loose price band.
    if (chosen.length < MAX_ALTERNATIVES) {
      chosen = fill(
        chosen,
        candidates.filter((c) => (c.sameDeveloper || c.sameLocation) && inBand(c.price, basis, PRICE_BAND_LOOSE)),
      );
    }

    // Stage 4 (final last resort): developer AND location both dropped —
    // "similar property, similar price, anywhere in Cyprus". Type comes back
    // as the one remaining constraint (dropped in stage 3, reinstated here —
    // without it this stage would suggest e.g. a commercial-adjacent studio
    // to a villa buyer purely on price). Same-location candidates still sort
    // first within this stage via fillLocationFirst, even though location is
    // no longer required to be included at all.
    if (chosen.length < MAX_ALTERNATIVES) {
      chosen = fillLocationFirst(
        chosen,
        candidates.filter((c) => c.typeMatch && inBand(c.price, basis, PRICE_BAND_LOOSE)),
      );
    }
  }

  if (chosen.length < MIN_ALTERNATIVES) return [];

  // Full card data — same shape, same resolvers (mapDevelopmentRowToCard) as
  // the /projects listing card, so AlternativesBlock can render the exact
  // same <ProjectCard> component rather than a second hand-built variant.
  // Only fetched for the small ranked shortlist, not the whole candidate pool.
  const cardRows = await prisma.development.findMany({
    where: { id: { in: chosen.map((c) => c.id) } },
    include: { override: true, units: { select: { beds: true, status: true, price: true, type: true, areaBuilt: true } } },
  });
  const byId = new Map(cardRows.map((row) => [row.id, row]));

  return chosen
    .map((c) => byId.get(c.id))
    .filter((row): row is (typeof cardRows)[number] => !!row)
    .map((row) => {
      const card = mapDevelopmentRowToCard(row);
      const kf = card.keyFeatures;
      const result: ProjectCardData = {
        id: card.sanityId,
        title: card.title,
        href: card.slug ? localizedHref(lang, ["projects", card.slug]) : "#",
        image: card.previewImage ?? undefined,
        city: kf.city,
        price: kf.price,
        bedrooms: kf.bedrooms,
        area: kf.coveredArea,
        type: kf.propertyType,
        energy: kf.energyEfficiency,
        completion: resolveCompletionYear(kf.completionDate),
        isNew: card.isNew,
        isFeatured: card.isFeatured,
        // Distances are deliberately dropped here — Sascha 2026-07-31: the
        // alternatives strip shouldn't carry them even where the source
        // project has them, unlike the /projects listing card.
        distances: null,
        vatApplies: kf.vatApplies,
        unitsAvailable: card.unitsAvailable,
        unitsTotal: card.unitsTotal,
      };
      return result;
    });
}
