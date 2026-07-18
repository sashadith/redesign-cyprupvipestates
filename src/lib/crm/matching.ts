import { prisma } from "@/lib/prisma";
import { soldOutFromCounts } from "@/lib/developmentAvailability";

/* Scores every published Development against a lead's criteria for the Client
   Presentation system (see prisma/schema.prisma ClientPresentation models and
   src/app/admin/(panel)/crm/[id]/PropertyMatching.tsx). Two callers:
   - the admin matching panel, which passes explicit `filters` (the lead's own
     data is just the pre-filled starting point, editable by the advisor);
   - the auto-match hook in POST /api/leads, which passes no filters at all —
     bedrooms/location necessarily fall back to their "no criteria" neutral
     score, since a fresh Lead never carries that data itself. */

export type MatchFilters = {
  budgetMin?: number | null;
  budgetMax?: number | null;
  /** Desired bedroom counts; 5 means "5+". Admin-only — Lead has no bedroom field. */
  bedrooms?: number[];
  /** District multi-select (falls back to town when a development has no district). Admin-only. */
  districts?: string[];
  /** Area multi-select — only meaningful (and only shown in the UI) once >=1 district is picked. Admin-only. */
  areas?: string[];
  /** Apartment/Villa/Townhouse/Penthouse (any casing/spelling — normalized below). */
  propertyTypes?: string[];
  /** Include publishStatus "ready" alongside "published". Default false. */
  includeReady?: boolean;
  /** Only return developments that currently have >=1 available unit. */
  onlyAvailable?: boolean;
};

export type LeadLike = {
  budgetMin?: number | null;
  budgetMax?: number | null;
  propertyTypeInterest?: string[];
};

export type MatchedUnit = {
  id: string;
  ref: string | null;
  label: string | null;
  type: string | null;
  beds: string | null;
  areaBuilt: string | null;
  price: number | null;
  status: string;
};

export type MatchedDevelopment = {
  id: string;
  publicName: string;
  town: string | null;
  district: string | null;
  area: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  currency: string;
  mainImage: string | null;
  unitsAvailable: number;
  unitsTotal: number;
};

export type DevelopmentMatch = {
  development: MatchedDevelopment;
  score: number;
  matchedUnits: MatchedUnit[];
  scoreBreakdown: { budget: number; bedrooms: number; location: number; propertyType: number };
};

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

// "studio" → 0, else the first number found ("2 bed" / "2" / "2-3" → 2). Beds is
// a free-text string across every feed adapter, never a clean int.
function parseBeds(raw: string | null | undefined): number | null {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return null;
  if (s.includes("studio")) return 0;
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

const TYPE_ALIASES: Record<string, string> = {
  apartment: "apartment", flat: "apartment",
  villa: "villa", house: "villa",
  townhouse: "townhouse",
  penthouse: "penthouse",
};
function normalizeType(raw: string | null | undefined): string | null {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return null;
  for (const [k, v] of Object.entries(TYPE_ALIASES)) if (s.includes(k)) return v;
  return null;
}

/** [min*0.9, max*1.1] — null bound = unbounded on that side. */
function widen(min: number | null, max: number | null, pct: number): { lo: number | null; hi: number | null } {
  return { lo: min != null ? min * (1 - pct) : null, hi: max != null ? max * (1 + pct) : null };
}
function inRange(price: number, lo: number | null, hi: number | null): boolean {
  if (lo != null && price < lo) return false;
  if (hi != null && price > hi) return false;
  return true;
}
function rangesOverlap(aLo: number | null, aHi: number | null, bLo: number | null, bHi: number | null): boolean {
  if (aLo != null && bHi != null && aLo > bHi) return false;
  if (aHi != null && bLo != null && aHi < bLo) return false;
  return true;
}

export async function matchDevelopmentsForLead(lead: LeadLike, filters: MatchFilters = {}): Promise<DevelopmentMatch[]> {
  const statuses = filters.includeReady ? ["published", "ready"] : ["published"];
  const rows = await prisma.development.findMany({
    where: { publishStatus: { in: statuses } },
    include: { units: true, override: true },
  });

  // Budget: filters override the lead's own numbers when provided (the admin
  // is deliberately widening/narrowing the search, not just re-reading the lead).
  const budgetMin = filters.budgetMin !== undefined ? filters.budgetMin : lead.budgetMin ?? null;
  const budgetMax = filters.budgetMax !== undefined ? filters.budgetMax : lead.budgetMax ?? null;
  const hasBudget = budgetMin != null || budgetMax != null;
  const tight = widen(budgetMin, budgetMax, 0.10); // full match band
  const loose = widen(budgetMin, budgetMax, 0.20); // near-miss band (tier 3)

  const bedrooms = filters.bedrooms ?? [];
  const hasBedCriteria = bedrooms.length > 0;

  const districts = (filters.districts ?? []).map((l) => l.toLowerCase()).filter(Boolean);
  const areas = (filters.areas ?? []).map((l) => l.toLowerCase()).filter(Boolean);
  const hasLocationCriteria = districts.length > 0;

  const propertyTypes = (filters.propertyTypes ?? lead.propertyTypeInterest ?? []).map(normalizeType).filter(Boolean) as string[];
  const hasTypeCriteria = propertyTypes.length > 0;

  const out: DevelopmentMatch[] = [];

  for (const d of rows) {
    const ov = d.override;
    const town = ov?.town || d.town || null;
    const district = ov?.district || d.district || null;
    const area = ov?.area || d.area || null;
    const gallery = arr<string>(ov?.gallery).length ? arr<string>(ov?.gallery) : arr<string>(d.gallery);
    const mainImage = ov?.mainImage || gallery[0] || null;
    const available = d.units.filter((u) => u.status === "available");
    // Hard exclude — a genuinely sold-out development can never be a NEW
    // presentation candidate, independent of the admin-toggleable
    // `onlyAvailable` filter below (that one controls near-sold inclusion,
    // not this: a true sold-out state is never negotiable). See Part 2c —
    // existing presentations that already contain one are untouched, this
    // only gates what can be newly matched/added.
    if (soldOutFromCounts(available.length, d.units.length)) continue;
    if (filters.onlyAvailable && available.length === 0) continue;

    // ---- BUDGET (40) ----
    let budgetScore = 0;
    if (!hasBudget) {
      // No budget signal at all (neither lead nor filter) — don't zero every
      // unbudgeted lead out; award a neutral score in the same spirit as the
      // other three dimensions' "no criteria" fallback (not in the original
      // spec verbatim, but budget is the only dimension with no stated neutral
      // case, and 0-scoring every no-budget lead would be misleading).
      budgetScore = 24;
    } else {
      const pricedUnits = available.filter((u) => u.price != null) as (typeof available[number] & { price: number })[];
      const anyTight = pricedUnits.some((u) => inRange(u.price, tight.lo, tight.hi));
      const anyLoose = !anyTight && pricedUnits.some((u) => inRange(u.price, loose.lo, loose.hi));
      if (anyTight) budgetScore = 40;
      else if (pricedUnits.length === 0 && rangesOverlap(tight.lo, tight.hi, d.priceFrom, d.priceTo)) budgetScore = 25;
      else if (anyLoose) budgetScore = 15;
      else budgetScore = 0;
    }

    // ---- BEDROOMS (25) ----
    let bedroomScore = 15;
    if (hasBedCriteria) {
      const unitBeds = available.map((u) => parseBeds(u.beds)).filter((n): n is number => n != null);
      const exact = unitBeds.some((b) => bedrooms.includes(b));
      const near = !exact && unitBeds.some((b) => bedrooms.some((want) => Math.abs(want - b) === 1));
      bedroomScore = exact ? 25 : near ? 15 : 0;
    }

    // ---- LOCATION (20) ---- District -> Area cascade (PART 6):
    // no criteria -> neutral 12. District(s) picked, no area -> match = 20 (any
    // area within that district counts, as before this change). District(s) AND
    // area(s) picked -> that specific area = 20, same district / other area = 10,
    // a different district entirely = 0.
    let locationScore = 12;
    if (hasLocationCriteria) {
      const devDistrictKey = (district || town || "").toLowerCase();
      const devAreaKey = (area || "").toLowerCase();
      const districtMatches = !!devDistrictKey && districts.some((sel) => devDistrictKey.includes(sel) || sel.includes(devDistrictKey));
      if (areas.length > 0) {
        const areaMatches = !!devAreaKey && areas.some((sel) => devAreaKey.includes(sel) || sel.includes(devAreaKey));
        locationScore = areaMatches ? 20 : districtMatches ? 10 : 0;
      } else {
        locationScore = districtMatches ? 20 : 0;
      }
    }

    // ---- PROPERTY TYPE (15) ----
    let typeScore = 8;
    if (hasTypeCriteria) {
      const anyType = available.some((u) => { const t = normalizeType(u.type); return t && propertyTypes.includes(t); });
      typeScore = anyType ? 15 : 0;
    }

    const score = budgetScore + bedroomScore + locationScore + typeScore;

    // matchedUnits: available units satisfying every UNIT-LEVEL criterion that
    // was actually supplied (budget/beds/type — location is development-level).
    const matchedUnits: MatchedUnit[] = available
      .filter((u) => {
        if (hasBudget && u.price != null && !inRange(u.price, tight.lo, tight.hi)) return false;
        if (hasBudget && u.price == null) return false; // can't confirm a budget match without a price
        if (hasBedCriteria) {
          const b = parseBeds(u.beds);
          if (b == null || !bedrooms.some((want) => Math.abs(want - b) <= 1)) return false;
        }
        if (hasTypeCriteria) {
          const t = normalizeType(u.type);
          if (!t || !propertyTypes.includes(t)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
      .map((u) => ({ id: u.id, ref: u.ref, label: u.label, type: u.type, beds: u.beds, areaBuilt: u.areaBuilt, price: u.price, status: u.status ?? "available" }));

    // Same fallback as developmentRender.ts's mapRowToVM — unit-driven feeds
    // and manually-created developments often leave the project-level price
    // null even though real unit prices exist.
    const availableUnitPrices = available.map((u) => u.price).filter((p): p is number => p != null);
    const priceFrom = d.priceFrom ?? (availableUnitPrices.length ? Math.min(...availableUnitPrices) : null);

    out.push({
      development: {
        id: d.id, publicName: ov?.alias || d.publicName, town, district, area,
        priceFrom, priceTo: d.priceTo, currency: d.currency || "EUR",
        mainImage, unitsAvailable: available.length, unitsTotal: d.units.length,
      },
      score,
      matchedUnits,
      scoreBreakdown: { budget: budgetScore, bedrooms: bedroomScore, location: locationScore, propertyType: typeScore },
    });
  }

  return out.sort((a, b) => b.score - a.score);
}
