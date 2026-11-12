#!/usr/bin/env node
/* Karma Developers — gallery images for the manual projects (2026-11-12).
 *
 *   node --import tsx --env-file=.env.local scripts/karma-media.mjs <manifest.json> --root <dir>
 *   node --import tsx --env-file=.env.local scripts/karma-media.mjs <manifest.json> --root <dir> --apply
 *
 * manifest: { "<slug>": { "gallery": [file…] } }. Gallery order is the display order; the
 * first image is the hero. Each name is the file's path inside the developer's SharePoint share
 * with the slashes replaced by "__", so the manifest stays readable and re-downloadable on its
 * own; --root is the directory those files were downloaded into (outside the repo).
 *
 * Images go through storeUploadedImage (WebP variants, 1920 px cap, content-hashed, so a
 * re-run dedups) into public/uploads/developments/<devKey>/ of THIS checkout. A local run
 * writes rows into the production DB that point at files on this laptop: rsync
 * public/uploads/developments/manual-karma-* to /var/www/shared-uploads/developments/
 * right after (same step as PDOM, DTA, Giovani, Marinakis, Platon, Reiwa and AGG).
 *
 * SELECTION (2026-11-12). The share holds ~1,180 files per the listing, most of them raw drone
 * frames (.DNG, skipped) and several renders per room. Each project keeps a curated run of
 * 12–25 images chosen by looking at every candidate: exterior first, then setting/aerial, pool,
 * interiors. Near-duplicates, branded/watermarked images and plans are left out.
 *
 * No plans: the plan PDFs in the share are full drawing sets per house type, not images.
 *
 * Published projects are frozen (gallery/plans are content): they are skipped. */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.ts";
import sharp from "sharp";
import { storeUploadedImage, devKeyFor } from "../src/lib/imageMirror.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: karma-media.mjs <manifest.json> [--root <dir>] [--apply]"); process.exit(1); }
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
    const feedKey = `manual:karma-${slug}`;
    const dev = await prisma.development.findUnique({ where: { feedKey }, select: { id: true, publishStatus: true, gallery: true, plans: true, units: { select: { id: true, ref: true, plans: true } } } });
    if (!dev) { console.log(`${slug}: no development ${feedKey} — run karma-sync.mjs --apply first`); continue; }
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
