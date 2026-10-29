#!/usr/bin/env node
/* Marinakis Developers — gallery and floor plans for the manual projects (2026-10-29).
 *
 *   node --import tsx --env-file=.env.local scripts/marinakis-media.mjs <manifest.json>          # dry run
 *   node --import tsx --env-file=.env.local scripts/marinakis-media.mjs <manifest.json> --apply  # write
 *
 * manifest: { "<slug>": { "gallery": [file…], "plans": [file…] } }, paths relative to the
 * manifest. Gallery order is the display order; the first image is the hero.
 *
 * Images go through storeUploadedImage (WebP variants, 1920 px cap, content-hashed, so a
 * re-run dedups) into public/uploads/developments/<devKey>/ of THIS checkout. A local run
 * writes rows into the production DB that point at files on this laptop: rsync
 * public/uploads/developments/manual-marinakis-* to /var/www/shared-uploads/developments/
 * right after (same step as Giovani, Platon, Reiwa and AGG).
 *
 * Sources (2026-10-29): the developer's own promo archives, linked from the Indicative
 * Price List v35 and downloaded from marinakisproperty.com/download/<slug>/ — renders per
 * project, plus plan PDFs rendered to JPEG with pdfjs + node-canvas at ~200 dpi and
 * whitespace-trimmed (pdfPagesToJpegs wants pdftoppm, which this machine does not have).
 *
 * One crop is load-bearing: Eden Valley's plans are PERMIT drawings whose title block
 * carries the architect practice's name, address, stamp and the client company's name.
 * The bottom 27 % of each sheet is cut off before the image is used — the drawing itself
 * ends above that line. Marigate's and Serene Springs' plans carry no such block.
 *
 * Published projects are frozen (gallery/plans are content): they are skipped. */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.ts";
import sharp from "sharp";
import { storeUploadedImage, devKeyFor } from "../src/lib/imageMirror.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: marinakis-media.mjs <manifest.json> [--apply]"); process.exit(1); }
const base = path.dirname(path.resolve(file));
const manifest = JSON.parse(fs.readFileSync(file, "utf8"));

async function store(rel, devKey, cache) {
  if (cache.has(rel)) return cache.get(rel);
  const p = path.resolve(base, rel);
  if (!fs.existsSync(p)) throw new Error(`missing ${p}`);
  let url = rel;
  if (APPLY) {
    // Pre-shrink: storeUploadedImage's sharp() keeps the default 268 MP input limit.
    const buf = await sharp(fs.readFileSync(p), { limitInputPixels: false }).rotate().resize({ width: 3200, height: 3200, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    url = await storeUploadedImage(buf, devKey);
    if (!url) throw new Error(`could not process ${p}`);
  }
  cache.set(rel, url);
  return url;
}

try {
  for (const [slug, m] of Object.entries(manifest)) {
    const feedKey = `manual:marinakis-${slug}`;
    const dev = await prisma.development.findUnique({ where: { feedKey }, select: { id: true, publishStatus: true, gallery: true, plans: true, units: { select: { id: true, ref: true, plans: true } } } });
    if (!dev) { console.log(`${slug}: no development ${feedKey} — run marinakis-sync first`); continue; }
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
