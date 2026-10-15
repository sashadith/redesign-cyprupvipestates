#!/usr/bin/env node
/* Platon Properties — gallery, floor plans and unit plans for the manual projects (2026-10-15).
 *
 *   node --import tsx --env-file=.env.local scripts/platon-media.mjs <manifest.json>          # dry run
 *   node --import tsx --env-file=.env.local scripts/platon-media.mjs <manifest.json> --apply  # write
 *
 * manifest: { "<slug>": { "gallery": [file…], "plans": [file…], "unitPlans": { "<unit ref>": file } } },
 * paths relative to the manifest. Gallery order is the display order; the first image
 * is the hero. A unitPlans file must also be one of the project's plans.
 *
 * Images go through storeUploadedImage (WebP variants, 1920 px cap, content-hashed, so a
 * re-run dedups) into public/uploads/developments/<devKey>/ of THIS checkout. A local run
 * writes rows into the production DB that point at files on this laptop: rsync
 * public/uploads/developments/manual-platon-* to /var/www/shared-uploads/developments/
 * right after (same step as Reiwa, AGG and Marfields).
 *
 * Sources (Drive read 2026-10-15), always the largest copy available:
 *  - Suites: "Renders NEW" (up to 8000 px). Its only façade-detail render (IMG_7557,
 *    1448 px) exists in no larger copy, the brochure embeds the same 1448 px file.
 *  - Apartments / Triangle: "Exterior" + "Interior". Apartments' IMG_1753-1759.JPG
 *    are 1200 px re-exports of the interior PNGs (perceptual hash) and are left out,
 *    as are the two shots of the branded ground-floor café. Triangle's 7a510f5f.jpg
 *    is a smaller variant of 3.png.
 *  - Villas: the folder is "Zygi Villas"; its exteriors sit in "Architecture" and
 *    "Architecture/New 27 May", interiors in "Interior/1". The five 5234 px PNGs in
 *    "New 27 May" (All_Properties, Appartaments, Map, Map Zygi, Triangle) are
 *    satellite maps for the Limassol projects and the villas — not gallery images.
 *  - Plans: none are loose files. Apartments (units 101-301 + parking/roof storage),
 *    Triangle (typical floor, roof, parking) and Suites (floors 1-4, units 101 and
 *    402) are the plan images embedded in the brochures; the villa type plans A-D are
 *    cropped from the unbranded EN brochure's pages 14-16. The permit drawings
 *    (Greek title blocks) are not used.
 *
 * Published projects are frozen (gallery/plans are content): they are skipped. */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.ts";
import { storeUploadedImage, devKeyFor } from "../src/lib/imageMirror.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: platon-media.mjs <manifest.json> [--apply]"); process.exit(1); }
const base = path.dirname(path.resolve(file));
const manifest = JSON.parse(fs.readFileSync(file, "utf8"));

async function store(rel, devKey, cache) {
  if (cache.has(rel)) return cache.get(rel);
  const p = path.resolve(base, rel);
  if (!fs.existsSync(p)) throw new Error(`missing ${p}`);
  let url = rel;
  if (APPLY) {
    url = await storeUploadedImage(fs.readFileSync(p), devKey);
    if (!url) throw new Error(`could not process ${p}`);
  }
  cache.set(rel, url);
  return url;
}

try {
  for (const [slug, m] of Object.entries(manifest)) {
    const feedKey = `manual:platon-${slug}`;
    const dev = await prisma.development.findUnique({ where: { feedKey }, select: { id: true, publishStatus: true, gallery: true, plans: true, units: { select: { id: true, ref: true, plans: true } } } });
    if (!dev) { console.log(`${slug}: no development ${feedKey} — run platon-sync first`); continue; }
    if (dev.publishStatus === "published") { console.log(`${slug}: published — media frozen, skipped`); continue; }
    const devKey = devKeyFor(feedKey);
    const cache = new Map();
    // Sequential on purpose: some sources are 8000 px / 50 MB PNGs.
    const gallery = [];
    for (const r of m.gallery ?? []) { const url = await store(r, devKey, cache); if (!gallery.includes(url)) gallery.push(url); }
    const plans = [];
    for (const r of m.plans ?? []) plans.push(await store(r, devKey, cache));
    const unitPlans = [];
    for (const [ref, rel] of Object.entries(m.unitPlans ?? {})) {
      if (!(m.plans ?? []).includes(rel)) throw new Error(`${slug} ${ref}: unit plan ${rel} is not among the project plans`);
      const unit = dev.units.find((u) => u.ref === ref);
      if (!unit) { console.log(`  ${slug}: unit ${ref} not found — plan skipped`); continue; }
      unitPlans.push({ unit, url: await store(rel, devKey, cache) });
    }
    console.log(`${slug}: gallery ${(dev.gallery ?? []).length} → ${gallery.length}, plans ${(dev.plans ?? []).length} → ${plans.length}, unit plans ${unitPlans.length}  (/uploads/developments/${devKey}/)`);
    if (!APPLY) continue;
    await prisma.development.update({ where: { id: dev.id }, data: { gallery, plans } });
    for (const { unit, url } of unitPlans) await prisma.developmentUnit.update({ where: { id: unit.id }, data: { plans: [url] } });
  }
} finally {
  await prisma.$disconnect();
}
