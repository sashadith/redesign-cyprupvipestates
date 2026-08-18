// One-off backfill: mirror DevelopmentOverride.mainImage to our own /uploads/
// storage for the rows where it still points at a third-party origin (feed
// source's CDN, e.g. aristodevelopers.com) instead of the mirrored local
// copy every other gallery image already uses.
//
// How these got stuck external isn't fully pinned down — the current admin
// GalleryManager UI only lets you pick "hero" from the already-local gallery
// array, so this looks like leftover state from an earlier import path. Not
// investigated further since the fix is the same either way: mirror + repoint.
//
// Run: node scripts/backfill-development-mainimage-mirror.mjs           (dry run, prints what would change)
//      node scripts/backfill-development-mainimage-mirror.mjs --apply   (downloads + writes)
import { createHash } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Deliberately duplicated from src/lib/imageMirror.ts (mirrorImage/devKeyFor) —
// this script runs under plain `node`, which can't resolve the "@/" path
// alias or import a .ts file directly, so every scripts/*.mjs in this repo
// keeps its own small copy rather than importing from src/.
const SIZES = [["small", 640], ["medium", 1280], ["large", 1920]];
const root = () => join(process.cwd(), "public", "uploads", "developments");
const hash = (s) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const exists = (p) => access(p).then(() => true).catch(() => false);
const devKeyFor = (feedKey) => feedKey.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "");

async function mirrorImage(src, devKey) {
  const h = hash(src);
  const dir = join(root(), devKey);
  const mediumFile = join(dir, `${h}_medium.webp`);
  const mediumUrl = `/uploads/developments/${devKey}/${h}_medium.webp`;
  if (await exists(mediumFile)) return mediumUrl;
  const res = await fetch(src, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!/image\//i.test(res.headers.get("content-type") ?? "")) throw new Error("not an image response");
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dir, { recursive: true });
  for (const [size, w] of SIZES) {
    const out = await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    await writeFile(join(dir, `${h}_${size}.webp`), out);
  }
  return mediumUrl;
}

async function main() {
  console.log(APPLY ? "APPLY mode — downloading + writing updates." : "DRY RUN — no writes (pass --apply to write).");

  const overrides = await prisma.developmentOverride.findMany({
    where: { mainImage: { not: null } },
    include: { development: { select: { id: true, feedKey: true, slug: true, publicName: true } } },
  });
  const targets = overrides.filter((o) => o.mainImage && !o.mainImage.startsWith("/uploads/"));

  console.log(`${targets.length} override(s) with an off-origin mainImage.\n`);

  let mirrored = 0;
  let failed = 0;
  for (const o of targets) {
    const devKey = devKeyFor(o.development.feedKey);
    console.log(`- ${o.development.slug ?? o.development.feedKey} (${o.development.publicName})`);
    console.log(`    from: ${o.mainImage}`);
    if (!APPLY) {
      console.log(`    to:   /uploads/developments/${devKey}/<hash>_medium.webp (dry run — not fetched)`);
      continue;
    }
    try {
      const newUrl = await mirrorImage(o.mainImage, devKey);
      await prisma.developmentOverride.update({ where: { id: o.id }, data: { mainImage: newUrl } });
      console.log(`    to:   ${newUrl}`);
      mirrored++;
    } catch (e) {
      console.log(`    FAILED: ${e.message} (left as-is)`);
      failed++;
    }
  }

  if (APPLY) console.log(`\nDone. Mirrored: ${mirrored}, failed: ${failed}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
