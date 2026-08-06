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

type UnitLike = { status: string | null; type: string | null; price: number | null };

function typeTokens(category: string | null, units: UnitLike[]): Set<string> {
  return new Set(
    resolveDevelopmentType(category, units as any)
      .split(" · ")
      .map((s) => s.trim().toLowerCase())
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
      units: { select: { status: true, type: true, price: true } },
    },
  });
  if (!current) return [];

  const currentPrice = current.priceFrom ?? cheapestAvailable(current.units) ?? cheapestOfAnyStatus(current.units);
  if (currentPrice == null) return []; // no price basis to compare against — never guess

  const currentTypes = typeTokens(current.category, current.units);
  const currentIsCommercial = isCommercial(current.category, current.units);

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
      units: { select: { status: true, type: true, price: true } },
    },
  });

  type Candidate = (typeof rows)[number] & { price: number; sameDeveloper: boolean; sameLocation: boolean; typeMatch: boolean };

  const candidates: Candidate[] = [];
  for (const d of rows) {
    if (!d.slug) continue; // published-but-no-slug would be a data anomaly — skip defensively
    const { soldOut } = computeAvailability(d.units);
    if (soldOut) continue; // never suggest a sold-out project as an alternative
    const price = d.priceFrom ?? cheapestAvailable(d.units);
    if (price == null) continue;
    if (isCommercial(d.category, d.units) !== currentIsCommercial) continue; // categorical boundary — excluded from the pool entirely, no stage can reintroduce it
    const sameDeveloper = !!current.developerAccountId && d.developerAccountId === current.developerAccountId;
    const sameArea = !!current.area && !!d.area && current.area.toLowerCase() === d.area.toLowerCase();
    const sameDistrict = !!current.district && !!d.district && current.district.toLowerCase() === d.district.toLowerCase();
    const sameLocation = sameArea || sameDistrict;
    const typeMatch = sharesType(currentTypes, typeTokens(d.category, d.units));
    candidates.push({ ...d, price, sameDeveloper, sameLocation, typeMatch });
  }

  const byPriceProximity = (list: Candidate[]) =>
    [...list].sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));

  const fill = (chosen: Candidate[], pool: Candidate[]) => {
    if (chosen.length >= MAX_ALTERNATIVES) return chosen;
    const seen = new Set(chosen.map((c) => c.id));
    const more = byPriceProximity(pool.filter((c) => !seen.has(c.id)));
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
    const more = [...pool.filter((c) => !seen.has(c.id))].sort((a, b) => {
      if (a.sameLocation !== b.sameLocation) return a.sameLocation ? -1 : 1;
      return Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice);
    });
    return [...chosen, ...more].slice(0, MAX_ALTERNATIVES);
  };

  let chosen: Candidate[];
  if (currentIsCommercial) {
    // No developer/location/price filtering — see the header comment above
    // for why. Just every other commercial development, best price match first.
    chosen = byPriceProximity(candidates).slice(0, MAX_ALTERNATIVES);
  } else {
    // Stage 1: developer AND location, type required, tight price band.
    chosen = byPriceProximity(
      candidates.filter((c) => c.sameDeveloper && c.sameLocation && c.typeMatch && inBand(c.price, currentPrice, PRICE_BAND_TIGHT)),
    ).slice(0, MAX_ALTERNATIVES);

    // Stage 2: developer OR location, type still required, tight price band.
    // Advances even from exactly MIN_ALTERNATIVES — only a full MAX_ALTERNATIVES
    // skips the next, looser stage (see header comment: a project stuck at 3
    // when a legitimate 4th candidate exists one stage out reads as broken).
    if (chosen.length < MAX_ALTERNATIVES) {
      chosen = fill(
        chosen,
        candidates.filter((c) => (c.sameDeveloper || c.sameLocation) && c.typeMatch && inBand(c.price, currentPrice, PRICE_BAND_TIGHT)),
      );
    }

    // Stage 3: developer OR location, type dropped, loose price band.
    if (chosen.length < MAX_ALTERNATIVES) {
      chosen = fill(
        chosen,
        candidates.filter((c) => (c.sameDeveloper || c.sameLocation) && inBand(c.price, currentPrice, PRICE_BAND_LOOSE)),
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
        candidates.filter((c) => c.typeMatch && inBand(c.price, currentPrice, PRICE_BAND_LOOSE)),
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
