#!/usr/bin/env node
/* Reiwa Development — gallery + floor plans for the manual projects (2026-10-06).
 *
 *   node --import tsx --env-file=.env.local scripts/reiwa-media.mjs <manifest.json>          # dry run
 *   node --import tsx --env-file=.env.local scripts/reiwa-media.mjs <manifest.json> --apply  # write
 *
 * manifest: { "<slug>": { "gallery": ["file.jpg", …], "plans": ["file.jpg", …] } },
 * paths relative to the manifest. Order is the gallery order; the first image is
 * the hero.
 *
 * Images go through storeUploadedImage (small/medium/large WebP, 1920 px cap,
 * content-hashed, so a re-run dedups) into public/uploads/developments/<devKey>/
 * of THIS checkout. A local run therefore writes rows into the production DB that
 * point at files on this laptop: rsync public/uploads/developments/manual-reiwa-*
 * to /var/www/shared-uploads/developments/ right after (same step as AGG and
 * Marfields).
 *
 * Sources (2026-10-06): Nova/UNO photos are the 2000 px originals from the Drive;
 * Bronte has no loose photos, its renders are the embedded originals of
 * "BRONTE Presentation ENG.pdf"; plans are pages of the developer's plan PDFs
 * rendered with pdfjs + node-canvas (pdfPagesToJpegs needs pdftoppm, which this
 * machine does not have — it silently returns []).
 *
 * Published projects are frozen (gallery/plans are content): they are skipped. */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.ts";
import { storeUploadedImage, devKeyFor } from "../src/lib/imageMirror.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: reiwa-media.mjs <manifest.json> [--apply]"); process.exit(1); }
const base = path.dirname(path.resolve(file));
const manifest = JSON.parse(fs.readFileSync(file, "utf8"));

async function store(list, devKey) {
  const out = [];
  for (const rel of list) {
    const p = path.resolve(base, rel);
    if (!fs.existsSync(p)) throw new Error(`missing ${p}`);
    if (!APPLY) { out.push(rel); continue; }
    const url = await storeUploadedImage(fs.readFileSync(p), devKey);
    if (!url) throw new Error(`could not process ${p}`);
    out.push(url);
  }
  return [...new Set(out)];
}

try {
  for (const [slug, m] of Object.entries(manifest)) {
    const feedKey = `manual:reiwa-${slug}`;
    const dev = await prisma.development.findUnique({ where: { feedKey }, select: { id: true, publishStatus: true, gallery: true, plans: true } });
    if (!dev) { console.log(`${slug}: no development ${feedKey} — run reiwa-sync first`); continue; }
    if (dev.publishStatus === "published") { console.log(`${slug}: published — media frozen, skipped`); continue; }
    const devKey = devKeyFor(feedKey);
    const gallery = await store(m.gallery ?? [], devKey);
    const plans = await store(m.plans ?? [], devKey);
    console.log(`${slug}: gallery ${(dev.gallery ?? []).length} → ${gallery.length}, plans ${(dev.plans ?? []).length} → ${plans.length}  (/uploads/developments/${devKey}/)`);
    if (APPLY) await prisma.development.update({ where: { id: dev.id }, data: { gallery, plans } });
  }
} finally {
  await prisma.$disconnect();
}
