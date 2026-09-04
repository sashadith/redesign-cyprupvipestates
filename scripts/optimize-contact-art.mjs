/* Convert the contact-modal phone artwork from PNG to WebP.

   The source files are 1024x1536 RGBA PNGs at ~1.6-1.9 MB each — 7.1 MB for
   the set, all of it fetched the moment a visitor opens the contact form on any
   page of the site. The artwork is never displayed wider than 462 CSS px
   (contactModal.css), so 950px keeps a 2x retina buffer and everything above
   that is waste.

   sharp ships with Next, so no extra tooling is needed. Alpha is preserved —
   the phone has to float on the panel gradient, and an earlier set of exports
   that had flattened the transparency onto a checkerboard is exactly the bug
   this must not reintroduce.

   Writes .webp next to the .png; the PNGs are removed separately once the
   component references the new files. */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = new URL("../public/img/contact/", import.meta.url).pathname;
const TARGET_WIDTH = 950;
const QUALITY = 82;

const pngs = fs.readdirSync(DIR).filter((f) => f.endsWith(".png"));
if (!pngs.length) {
  console.log("no PNG sources found — nothing to do.");
  process.exit(0);
}

let before = 0;
let after = 0;

for (const file of pngs.sort()) {
  const src = path.join(DIR, file);
  const dest = src.replace(/\.png$/, ".webp");

  const meta = await sharp(src).metadata();
  if (!meta.hasAlpha) {
    console.log(`SKIP ${file}: no alpha channel — refusing to ship artwork with a baked-in background.`);
    continue;
  }

  await sharp(src).resize({ width: TARGET_WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY, alphaQuality: 90 }).toFile(dest);

  const a = fs.statSync(src).size;
  const b = fs.statSync(dest).size;
  before += a;
  after += b;
  const out = await sharp(dest).metadata();
  console.log(
    `${file.padEnd(16)} ${(a / 1024 / 1024).toFixed(2)} MB -> ${(b / 1024).toFixed(0)} KB` +
      `  (${meta.width}x${meta.height} -> ${out.width}x${out.height}, alpha ${out.hasAlpha ? "kept" : "LOST"})`
  );
}

console.log(`\ntotal ${(before / 1024 / 1024).toFixed(1)} MB -> ${(after / 1024).toFixed(0)} KB` +
  `  (${Math.round((1 - after / before) * 100)}% smaller)`);
