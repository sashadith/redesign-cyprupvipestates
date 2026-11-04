#!/usr/bin/env node
/* Patroclos Group — gallery images and floor plans for the manual projects (2026-11-04).
 *
 *   node --import tsx --env-file=.env.local scripts/patroclos-media.mjs <manifest.json> --root <dir>
 *   node --import tsx --env-file=.env.local scripts/patroclos-media.mjs <manifest.json> --root <dir> --apply
 *
 * Same mechanics as dta-media.mjs: manifest { "<slug>": { "gallery": [file…], "plans": [file…] } },
 * gallery order = display order (first = hero), names are paths relative to --root (the
 * Drive download, ~0.5 GB, kept outside the repo). Images go through storeUploadedImage
 * (WebP, 1920 px cap, content-hashed) into public/uploads/developments/<devKey>/ of THIS
 * checkout — rsync public/uploads/developments/manual-patroclos-* to
 * /var/www/shared-uploads/developments/ right after.
 *
 * Sources: the developer's Drive share — renders per project, real photos for the delivered
 * Elysium and for the Olivea resale house; floor plans rendered from the developer's PDF
 * plan sets with architect title blocks and contact details cropped away. Entries with an
 * "_" prefix in the manifest (e.g. "_notes") are ignored, as are slugs with no development.
 *
 * Published projects are frozen (gallery/plans are content): they are skipped. */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.ts";
import sharp from "sharp";
import { storeUploadedImage, devKeyFor } from "../src/lib/imageMirror.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: patroclos-media.mjs <manifest.json> [--root <dir>] [--apply]"); process.exit(1); }
const rootIx = process.argv.indexOf("--root");
const base = rootIx > -1 && process.argv[rootIx + 1]
  ? path.resolve(process.argv[rootIx + 1])
  : path.dirname(path.resolve(file));
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
    const feedKey = `manual:patroclos-${slug}`;
    const dev = await prisma.development.findUnique({ where: { feedKey }, select: { id: true, publishStatus: true, gallery: true, plans: true, units: { select: { id: true, ref: true, plans: true } } } });
    if (!dev) { console.log(`${slug}: no development ${feedKey} — run patroclos-sync first`); continue; }
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
