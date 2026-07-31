// "Similar projects" for the Development detail page (Bündel 1, 2026-07-31) —
// same ranking logic on every project page: prominent under the sold-out
// banner when the current project is sold out, a quiet strip further down
// when it isn't. Only ever suggests projects that are themselves published
// AND have at least one available unit (computeAvailability) — a sold-out
// project as an "alternative" would defeat the point.
//
// Ranking funnel, each stage a HARD filter (never guessed/loosened silently):
//   1. same developer AND same location, same property type, price within ±40%
//   2. same developer OR  same location, same property type, price within ±40%
//   3. (last resort) same developer OR same location, price within ±60% — type dropped
// Fewer than MIN_ALTERNATIVES after stage 3 → return [] (the caller omits the
// block entirely rather than show weak/random suggestions).
import { prisma } from "@/lib/prisma";
import { computeAvailability } from "@/lib/developmentAvailability";
import { resolveDevelopmentType } from "@/lib/developmentCard";

export type AlternativeCard = {
  id: string;
  slug: string;
  publicName: string;
  mainImage: string | null;
  area: string | null;
  district: string | null;
  priceFrom: number | null;
  currency: string;
};

const PRICE_BAND_TIGHT = 0.4; // ±40% — stages 1 and 2
const PRICE_BAND_LOOSE = 0.6; // ±60% — stage 3 (last resort) only
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

function cheapestAvailable(units: UnitLike[]): number | null {
  const prices = units.filter((u) => u.status === "available" && u.price != null).map((u) => u.price as number);
  return prices.length ? Math.min(...prices) : null;
}

function inBand(price: number, center: number, band: number): boolean {
  return price >= center * (1 - band) && price <= center * (1 + band);
}

function firstGalleryImage(gallery: unknown): string | null {
  return Array.isArray(gallery) && typeof gallery[0] === "string" ? (gallery[0] as string) : null;
}

export async function getAlternativeDevelopments(currentSlug: string): Promise<AlternativeCard[]> {
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

  const currentPrice = current.priceFrom ?? cheapestAvailable(current.units);
  if (currentPrice == null) return []; // no price basis to compare against — never guess

  const currentTypes = typeTokens(current.category, current.units);

  const rows = await prisma.development.findMany({
    where: { publishStatus: "published", id: { not: current.id } },
    select: {
      id: true,
      slug: true,
      publicName: true,
      developerAccountId: true,
      area: true,
      district: true,
      priceFrom: true,
      currency: true,
      category: true,
      gallery: true,
      units: { select: { status: true, type: true, price: true } },
      override: { select: { alias: true, mainImage: true } },
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

  // Stage 1: developer AND location, type required, tight price band.
  let chosen = byPriceProximity(
    candidates.filter((c) => c.sameDeveloper && c.sameLocation && c.typeMatch && inBand(c.price, currentPrice, PRICE_BAND_TIGHT)),
  ).slice(0, MAX_ALTERNATIVES);

  // Stage 2: developer OR location, type still required, tight price band.
  if (chosen.length < MIN_ALTERNATIVES) {
    chosen = fill(
      chosen,
      candidates.filter((c) => (c.sameDeveloper || c.sameLocation) && c.typeMatch && inBand(c.price, currentPrice, PRICE_BAND_TIGHT)),
    );
  }

  // Stage 3 (last resort): developer OR location, type dropped, loose price band.
  if (chosen.length < MIN_ALTERNATIVES) {
    chosen = fill(
      chosen,
      candidates.filter((c) => (c.sameDeveloper || c.sameLocation) && inBand(c.price, currentPrice, PRICE_BAND_LOOSE)),
    );
  }

  if (chosen.length < MIN_ALTERNATIVES) return [];

  return chosen.map((d) => ({
    id: d.id,
    slug: d.slug as string,
    publicName: d.override?.alias || d.publicName,
    mainImage: d.override?.mainImage || firstGalleryImage(d.gallery),
    area: d.area,
    district: d.district,
    priceFrom: d.priceFrom,
    currency: d.currency ?? "EUR",
  }));
}
