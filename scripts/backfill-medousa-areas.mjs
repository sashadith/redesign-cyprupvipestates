// One-off backfill: set DevelopmentOverride.area for the Medousa developments
// that have none. Without an area they fail two of the seven publish-gate
// checks ("Area set" and "Neighbourhood description exists for this area"),
// which is why all 14 Medousa developments are stuck in draft.
//
//   node scripts/backfill-medousa-areas.mjs           # dry run
//   node scripts/backfill-medousa-areas.mjs --apply   # write
//
// WHY THE OVERRIDE AND NOT Development.area: the Medousa feed carries no area
// at all — the adapter writes `area: ov.area ?? ""`, so anything written to the
// base column is wiped by the next sync. DevelopmentOverride always wins and is
// never touched by the sync, which is exactly the right home for a per-project
// judgement call that no feed rule can express.
//
// HOW THE AREA IS DERIVED: nearest neighbour. For each Medousa project we take
// the closest OTHER development that already has both coordinates and a
// curated area, and adopt that area. Cyprus areas are neighbourhood-sized and
// the corpus is dense (187 reference projects), so this is tight in practice —
// measured 2026-08-22, every match landed within 0.91 km. Anything beyond
// MAX_KM is reported, never written: a distant "nearest" neighbour is a guess,
// not evidence.
//
// An area is only adopted if an AreaDescription already exists for it,
// otherwise the development would still fail the gate on the second check and
// we would have written a value for nothing.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MAX_KM = 2.0;
const areaSlugOf = (a) => a.toLowerCase().replace(/ph/g, "f").replace(/[^a-z]/g, "");
const R = 6371, rad = (d) => (d * Math.PI) / 180;
const haversine = (aLat, aLng, bLat, bLng) => {
  const dLa = rad(bLat - aLat), dLo = rad(bLng - aLng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const apply = process.argv.includes("--apply");

const all = await prisma.development.findMany({
  select: {
    id: true, publicName: true, dev: true, area: true, latitude: true, longitude: true,
    override: { select: { id: true, area: true, latitude: true, longitude: true } },
  },
  orderBy: { publicName: "asc" },
});
const known = new Set((await prisma.areaDescription.findMany({ select: { areaSlug: true } })).map((a) => a.areaSlug));

const resolved = (d) => ({
  lat: d.override?.latitude ?? d.latitude,
  lng: d.override?.longitude ?? d.longitude,
  area: (d.override?.area || d.area || "").trim(),
});

// Reference pool: everything that already has coordinates AND a curated area.
const pool = all.map((d) => ({ d, r: resolved(d) })).filter((x) => x.r.lat != null && x.r.lng != null && x.r.area);

const targets = all.filter((d) => d.dev === "medousa" && !resolved(d).area);
const writes = [], skipped = [];

for (const d of targets) {
  const { lat, lng } = resolved(d);
  if (lat == null || lng == null) { skipped.push({ d, why: "no coordinates — assign by hand" }); continue; }
  let best = null;
  for (const p of pool) {
    if (p.d.id === d.id) continue;
    const km = haversine(lat, lng, p.r.lat, p.r.lng);
    if (!best || km < best.km) best = { km, area: p.r.area, from: p.d.publicName };
  }
  if (!best) { skipped.push({ d, why: "no reference project with an area" }); continue; }
  if (best.km > MAX_KM) { skipped.push({ d, why: `nearest match ${best.km.toFixed(2)} km away (> ${MAX_KM} km) — too far to trust` }); continue; }
  if (!known.has(areaSlugOf(best.area))) { skipped.push({ d, why: `no AreaDescription for "${best.area}" — would still fail the gate` }); continue; }
  writes.push({ d, ...best });
}

for (const w of writes)
  console.log(`  ${w.d.publicName.padEnd(24)} -> ${w.area.padEnd(16)} (${w.km.toFixed(2)} km, from ${w.from})`);
for (const s of skipped)
  console.log(`  SKIP ${s.d.publicName.padEnd(24) } ${s.why}`);

console.log(`\n${writes.length} area override(s) would be set, ${skipped.length} skipped, of ${targets.length} Medousa developments without an area.`);

if (!apply) {
  console.log("DRY RUN — nothing written. Re-run with --apply to write.");
} else {
  for (const w of writes) {
    await prisma.developmentOverride.upsert({
      where: { developmentId: w.d.id },
      update: { area: w.area },
      create: { developmentId: w.d.id, area: w.area },
    });
    console.log(`  ✓ ${w.d.publicName} -> ${w.area}`);
  }
  console.log(`APPLIED: ${writes.length} override(s) set.`);
}
await prisma.$disconnect();
