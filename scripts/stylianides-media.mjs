#!/usr/bin/env node
/* Stylianides Group — gallery, floor plans and per-unit plans for the drafts (2026-10-30).
 *
 *   node --import tsx --env-file=.env.local scripts/stylianides-media.mjs scripts/data/stylianides/projects.json <manifest.json>          # dry run
 *   node --import tsx --env-file=.env.local scripts/stylianides-media.mjs scripts/data/stylianides/projects.json <manifest.json> --apply  # write
 *
 * manifest: { "<folderKey>": { "gallery": [file…], "plans": [file…], "unitPlans": { "<ref>": file } } },
 * paths relative to the manifest; the data file maps folderKey → project slug. Gallery order
 * is the display order, the first image is the hero.
 *
 * Images go through storeUploadedImage (WebP variants, 1920 px cap, content-hashed, so a
 * re-run dedups) into public/uploads/developments/<devKey>/ of THIS checkout. A local run
 * writes rows into the production DB that point at files on this laptop: rsync
 * public/uploads/developments/stylianides-* to /var/www/shared-uploads/developments/ right
 * after (same step as Giovani, Platon, Reiwa and AGG).
 *
 * Sources (the project Dropbox folders, read 2026-10-30), prepared outside the repo: every
 * distinct render/photo once (LR duplicates and developer-branded images left out, BMPs
 * converted), plans from the UNBRANDED brochures (one La Residenza sheet from the
 * architectural set, title block cropped). Unit plans are matched by the price list's own
 * reference (feedRef), so the connector must have imported the units first.
 *
 * Published projects are frozen (gallery/plans are content): they are skipped. */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.ts";
import sharp from "sharp";
import { storeUploadedImage, devKeyFor } from "../src/lib/imageMirror.ts";

const [dataFile, file] = process.argv.slice(2);
const APPLY = process.argv.includes("--apply");
if (!dataFile || !file) { console.error("usage: stylianides-media.mjs <projects.json> <manifest.json> [--apply]"); process.exit(1); }
const base = path.dirname(path.resolve(file));
const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
// Same rule as stylianides-setup.mjs: price-list projects are dev "stylianides", the
// office buildings sold whole are dev "manual".
const feedKeyOf = Object.fromEntries(JSON.parse(fs.readFileSync(dataFile, "utf8")).projects.map((p) => [p.folderKey, p.manual ? `manual:stylianides-${p.slug}` : `stylianides:${p.slug}`]));

async function store(rel, devKey, cache) {
  if (cache.has(rel)) return cache.get(rel);
  const p = path.resolve(base, rel);
  if (!fs.existsSync(p)) throw new Error(`missing ${p}`);
  let url = rel;
  if (APPLY) {
    const buf = await sharp(fs.readFileSync(p), { limitInputPixels: false }).rotate().resize({ width: 3200, height: 3200, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    url = await storeUploadedImage(buf, devKey);
    if (!url) throw new Error(`could not process ${p}`);
  }
  cache.set(rel, url);
  return url;
}

try {
  for (const [folderKey, m] of Object.entries(manifest)) {
    const feedKey = feedKeyOf[folderKey];
    if (!feedKey) { console.log(`${folderKey}: not in the data file — skipped`); continue; }
    const slug = feedKey.replace(/^.*?:(stylianides-)?/, "");
    const dev = await prisma.development.findUnique({ where: { feedKey }, select: { id: true, publishStatus: true, gallery: true, plans: true, units: { select: { id: true, ref: true, feedRef: true } } } });
    if (!dev) { console.log(`${slug}: no development ${feedKey} — run stylianides-setup first`); continue; }
    if (dev.publishStatus === "published") { console.log(`${slug}: published — media frozen, skipped`); continue; }
    const devKey = devKeyFor(feedKey);
    const cache = new Map();
    // Sequential on purpose: some sources are 3200 px PNG re-encodes of 20 MB BMPs.
    const gallery = [];
    for (const r of m.gallery ?? []) { const url = await store(r, devKey, cache); if (!gallery.includes(url)) gallery.push(url); }
    const plans = [];
    for (const r of m.plans ?? []) plans.push(await store(r, devKey, cache));
    const unitPlans = [];
    for (const [ref, rel] of Object.entries(m.unitPlans ?? {})) {
      if (!(m.plans ?? []).includes(rel)) throw new Error(`${slug} ${ref}: unit plan ${rel} is not among the project plans`);
      const unit = dev.units.find((u) => (u.feedRef || u.ref) === ref);
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
