#!/usr/bin/env node
/* Giovani Homes — gallery and floor plans for the manual projects (2026-10-27).
 *
 *   node --import tsx --env-file=.env.local scripts/giovani-media.mjs <manifest.json>          # dry run
 *   node --import tsx --env-file=.env.local scripts/giovani-media.mjs <manifest.json> --apply  # write
 *
 * manifest: { "<slug>": { "gallery": [file…], "plans": [file…] } }, paths relative to the
 * manifest. Gallery order is the display order; the first image is the hero.
 *
 * Images go through storeUploadedImage (WebP variants, 1920 px cap, content-hashed, so a
 * re-run dedups) into public/uploads/developments/<devKey>/ of THIS checkout. A local run
 * writes rows into the production DB that point at files on this laptop: rsync
 * public/uploads/developments/manual-giovani-* to /var/www/shared-uploads/developments/
 * right after (same step as Platon, Reiwa and AGG).
 *
 * Sources (Drive read 2026-10-27), prepared outside the repo:
 *  - Gallery: every distinct render, aerial, interior and show-house image; where a set
 *    exists in High/Medium/Low only one copy, the smallest that is still >= 1920 px wide
 *    (several High PNGs are 100-366 MB / up to 362 MP, past sharp's default pixel limit).
 *    Skipped: OLD / "DO NOT USE" / DRAFTS folders, 360 panoramas, the VR how-to, progress
 *    sets except the newest one per project.
 *  - Plans: the Unbranded brochures' plan pages rendered at 200 dpi, the ARTISTIC layout
 *    images, and — only for house types with no clean plan (Napa Meridian, Santa Elena
 *    D/E/F, Semeli C/D/E) — the permit drawing with its title block cropped off, because
 *    that block carries the developer's logo and the architect's stamp.
 *
 * Published projects are frozen (gallery/plans are content): they are skipped. */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.ts";
import sharp from "sharp";
import { storeUploadedImage, devKeyFor } from "../src/lib/imageMirror.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: giovani-media.mjs <manifest.json> [--apply]"); process.exit(1); }
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
    const feedKey = `manual:giovani-${slug}`;
    const dev = await prisma.development.findUnique({ where: { feedKey }, select: { id: true, publishStatus: true, gallery: true, plans: true, units: { select: { id: true, ref: true, plans: true } } } });
    if (!dev) { console.log(`${slug}: no development ${feedKey} — run giovani-sync first`); continue; }
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
