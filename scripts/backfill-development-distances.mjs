// One-off backfill: compute Development.distances for every already-existing
// published Development that has coordinates but no distances yet (or as a
// full recompute if the POI data changes). Run: node scripts/backfill-development-distances.mjs
//
// New Developments never need this — every write path that can set
// coordinates (feedSync.ts, driveAvailabilitySync.ts, the admin map-location
// save action) already recomputes automatically via
// recomputeDevelopmentDistances() in src/lib/developmentDistances.ts. This
// script exists only to catch up rows that existed before that feature shipped.
//
// The math here is a deliberate, small duplicate of computeDistances() in
// src/lib/developmentDistances.ts — that module uses the "@/..." TS path
// alias, which plain `node` can't resolve outside the Next.js build, so a
// standalone script can't import it directly (same reason every other
// scripts/*.mjs|cjs file in this repo is self-contained rather than
// importing from src/). If you change the category/POI-source mapping or the
// km-per-minute factor there, mirror the change here too.
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORY_SOURCES = {
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
const KM_PER_MIN = 0.6;

function loadPoiByCategory() {
  const map = new Map();
  for (const rel of ["public/poi/cyprus.json", "public/poi/cyprus-extra.json"]) {
    const rows = JSON.parse(fs.readFileSync(path.join(process.cwd(), rel), "utf8")).pois ?? [];
    for (const p of rows) {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") continue;
      const list = map.get(p.c);
      if (list) list.push({ lat: p.lat, lng: p.lng });
      else map.set(p.c, [{ lat: p.lat, lng: p.lng }]);
    }
  }
  return map;
}
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function nearestKm(lat, lng, pois) {
  if (!pois.length) return null;
  let min = Infinity;
  for (const p of pois) { const km = haversineKm(lat, lng, p.lat, p.lng); if (km < min) min = km; }
  return Number.isFinite(min) ? min : null;
}
function computeDistances(lat, lng, byCategory) {
  const out = {};
  for (const key of Object.keys(CATEGORY_SOURCES)) {
    const pois = CATEGORY_SOURCES[key].flatMap((src) => byCategory.get(src) ?? []);
    const km = nearestKm(lat, lng, pois);
    if (km == null) continue;
    const minutes = Math.max(1, Math.round(km / KM_PER_MIN));
    if (minutes > HONESTY_CAP_MIN) continue;
    out[key] = minutes;
  }
  return out;
}

const byCategory = loadPoiByCategory();

const rows = await prisma.development.findMany({
  where: { publishStatus: "published" },
  select: { id: true, publicName: true, latitude: true, longitude: true, override: { select: { latitude: true, longitude: true } } },
});

let computed = 0, skippedNoCoords = 0;
for (const row of rows) {
  const lat = row.override?.latitude ?? row.latitude;
  const lng = row.override?.longitude ?? row.longitude;
  if (lat == null || lng == null) { skippedNoCoords++; continue; }
  const distances = computeDistances(lat, lng, byCategory);
  await prisma.development.update({ where: { id: row.id }, data: { distances } });
  computed++;
  console.log(`✓ ${row.publicName}: ${JSON.stringify(distances)}`);
}

console.log(`\nDone. ${computed} published developments recomputed, ${skippedNoCoords} skipped (no coordinates).`);
await prisma.$disconnect();
