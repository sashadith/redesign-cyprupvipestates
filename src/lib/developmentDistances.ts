// Auto-computed "distances" for a Development — purely mathematical (haversine
// + a fixed driving-time factor), no AI, no external routing API. Reused by
// every write path that can affect a Development's coordinates: feedSync.ts,
// driveAvailabilitySync.ts, the admin map-location save action, and the
// one-off backfill script (scripts/backfill-development-distances.mjs).
//
// POI sources — both are RUNTIME fs.readFile dependencies invisible to
// `next build`'s static import-graph check (the same class of bug that broke
// PDF generation earlier in this project's history — see DEPLOYMENT.md
// "lessons learned"). Both files are registered in
// scripts/verify-runtime-assets.sh's REQUIRED_FILES; do not remove either
// without also removing that gate entry.
//   - public/poi/cyprus.json       — the existing OSM-derived "LIFE NEARBY"
//     dataset (src/app/preview-projects/ProjectsMap.tsx), categories:
//     beach, restaurant, supermarket, clinic, golf, school_private,
//     school_public, pharmacy, airport (the last is NOT used here — small
//     airfields/heliports tagged amenity=airport in OSM aren't a reliable
//     stand-in for "the nearest international airport").
//   - public/poi/cyprus-extra.json — small curated additions this feature
//     needed and the main dataset doesn't cover: the island's two
//     international airports, and the main town centers (Paphos, Limassol,
//     Larnaca, Nicosia, Ayia Napa/Protaras, Polis). Versioned, not hardcoded
//     in source, per the same "keep it in a JSON file" convention as the main
//     POI dataset.
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export type DevelopmentDistances = Partial<{
  beach: number;
  restaurants: number;
  shops: number;
  airport: number;
  hospital: number;
  school: number;
  cityCenter: number;
  golf: number;
}>;

type RawPoi = { lat: number; lng: number; n?: string; c: string };
type Poi = { lat: number; lng: number };

// Each output category maps to one or more source POI categories (from either
// JSON file) — the nearest POI across ALL of them wins. `school` pools both
// school_private and school_public into a single "nearest school" figure,
// since the legacy system (and the site's own copy) only ever showed one.
const CATEGORY_SOURCES: Record<keyof DevelopmentDistances, string[]> = {
  beach: ["beach"],
  restaurants: ["restaurant"],
  shops: ["supermarket"],
  hospital: ["clinic"],
  school: ["school_private", "school_public"],
  golf: ["golf"],
  airport: ["airport_intl"],
  cityCenter: ["city_center"],
};

const HONESTY_CAP_MIN = 60;
const KM_PER_MIN = 0.6; // ~36 km/h average local/driving-time approximation

let poiByCategory: Map<string, Poi[]> | null = null;

function loadPoiByCategory(): Map<string, Poi[]> {
  if (poiByCategory) return poiByCategory;
  const map = new Map<string, Poi[]>();
  for (const rel of ["public/poi/cyprus.json", "public/poi/cyprus-extra.json"]) {
    const file = path.join(process.cwd(), rel);
    let rows: RawPoi[] = [];
    try {
      rows = (JSON.parse(fs.readFileSync(file, "utf8")).pois ?? []) as RawPoi[];
    } catch {
      rows = []; // missing/corrupt file → that source's categories simply resolve to nothing
    }
    for (const p of rows) {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") continue;
      const list = map.get(p.c);
      if (list) list.push({ lat: p.lat, lng: p.lng });
      else map.set(p.c, [{ lat: p.lat, lng: p.lng }]);
    }
  }
  poiByCategory = map;
  return map;
}

// Standard great-circle distance, in km.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestKm(lat: number, lng: number, pois: Poi[]): number | null {
  if (!pois.length) return null;
  let min = Infinity;
  for (const p of pois) {
    const km = haversineKm(lat, lng, p.lat, p.lng);
    if (km < min) min = km;
  }
  return Number.isFinite(min) ? min : null;
}

/** Pure function: given a Development's (resolved) coordinates, compute its
 *  distances object. Categories with no resolvable POI, or a driving-time
 *  estimate over the honesty cap, are simply omitted — never included as
 *  null/zero. */
export function computeDistances(lat: number, lng: number): DevelopmentDistances {
  const byCategory = loadPoiByCategory();
  const out: DevelopmentDistances = {};
  for (const key of Object.keys(CATEGORY_SOURCES) as (keyof DevelopmentDistances)[]) {
    const pois = CATEGORY_SOURCES[key].flatMap((src) => byCategory.get(src) ?? []);
    const km = nearestKm(lat, lng, pois);
    if (km == null) continue;
    const minutes = Math.max(1, Math.round(km / KM_PER_MIN));
    if (minutes > HONESTY_CAP_MIN) continue;
    out[key] = minutes;
  }
  return out;
}

/** Resolve a Development's coordinates the same way the render layer does —
 *  DevelopmentOverride's lat/lng win when set, else the Development's own —
 *  recompute, and persist onto Development.distances. This is the ONE
 *  function every write path calls: feedSync.ts, driveAvailabilitySync.ts,
 *  the admin map-location save action, and the one-off backfill script.
 *  Never compute distances from a Development's raw feed coordinates
 *  directly — an admin override often exists precisely because the feed's
 *  own geocoding was wrong, and silently recomputing from the feed value on
 *  every sync would overwrite a deliberately-corrected figure. */
export async function recomputeDevelopmentDistances(developmentId: string): Promise<DevelopmentDistances | null> {
  const row = await prisma.development.findUnique({
    where: { id: developmentId },
    select: { latitude: true, longitude: true, override: { select: { latitude: true, longitude: true } } },
  });
  if (!row) return null;
  const lat = row.override?.latitude ?? row.latitude;
  const lng = row.override?.longitude ?? row.longitude;
  const distances = lat != null && lng != null ? computeDistances(lat, lng) : null;
  await prisma.development.update({ where: { id: developmentId }, data: { distances: distances as any } });
  return distances;
}
