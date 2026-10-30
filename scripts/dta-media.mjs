#!/usr/bin/env node
/* DTA Group — gallery images for the manual projects (2026-10-29).
 *
 *   node --import tsx --env-file=.env.local scripts/dta-media.mjs <manifest.json> --root <dir>
 *   node --import tsx --env-file=.env.local scripts/dta-media.mjs <manifest.json> --root <dir> --apply
 *
 * manifest: { "<slug>": { "gallery": [file…], "plans": [file…] } }. Gallery order is the
 * display order; the first image is the hero. Each name is the file's path inside the
 * developer's Dropbox share with the slashes replaced by "__", so the manifest stays
 * readable and re-downloadable on its own; --root is the directory those files were
 * downloaded into (they are ~1.2 GB, so they live outside the repo). Without --root the
 * names resolve against the manifest's own directory.
 *
 * Images go through storeUploadedImage (WebP variants, 1920 px cap, content-hashed, so a
 * re-run dedups) into public/uploads/developments/<devKey>/ of THIS checkout. A local run
 * writes rows into the production DB that point at files on this laptop: rsync
 * public/uploads/developments/manual-dta-* to /var/www/shared-uploads/developments/
 * right after (same step as Giovani, Marinakis, Platon, Reiwa and AGG).
 *
 * Sources (2026-10-29): the developer's own Dropbox share, one Photos folder per project —
 * architectural renders for the four off-plan projects, real photography for the two
 * finished towers. Luma ships only TIFFs and Level ships both, which sharp reads directly.
 *
 * Three exclusions are deliberate, not oversights. Level's MONTAGE and PANORAMIC aerials
 * show the wider Souni land development — dozens of houses — where this project is five,
 * and its Type A renders show a house type none of the five are; both would misdescribe
 * what is for sale. iHome's gated-entrance shot is a close-up of the developer's own
 * branded sign. Where a .tif and a .jpg are the same render, the .jpg wins.
 *
 * No plans yet: every page of the developer's per-unit presentations is a branded
 * marketing page carrying their logo and direct sales contact, so a floor plan needs
 * cropping per template first.
 *
 * Published projects are frozen (gallery/plans are content): they are skipped. */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.ts";
import sharp from "sharp";
import { storeUploadedImage, devKeyFor } from "../src/lib/imageMirror.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: dta-media.mjs <manifest.json> [--root <dir>] [--apply]"); process.exit(1); }
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
    const feedKey = `manual:dta-${slug}`;
    const dev = await prisma.development.findUnique({ where: { feedKey }, select: { id: true, publishStatus: true, gallery: true, plans: true, units: { select: { id: true, ref: true, plans: true } } } });
    if (!dev) { console.log(`${slug}: no development ${feedKey} — run dta-sync first`); continue; }
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
