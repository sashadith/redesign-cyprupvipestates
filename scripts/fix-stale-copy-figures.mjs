// Corrects stale figures in published DevelopmentOverride copy, one batch at a
// time. The batch lives in fix-stale-copy-figures.json next to this file; git
// history holds the batches already applied.
//
//   node --env-file=.env.local scripts/fix-stale-copy-figures.mjs           # dry run
//   node --env-file=.env.local scripts/fix-stale-copy-figures.mjs --apply   # write
//
// Why any of this is needed: these fields are written once — by an admin or by
// "Generate with Claude" — and never regenerated, while the numbers they quote
// move with every feed sync. The Action Center rule in
// src/lib/seo/staleCopyFigures.ts finds them; this applies the corrections.
//
// Two field families, two treatments:
//
//   seo.*        Replaced wholesale (they are one sentence). Figures are written
//                as {priceFrom}/{completion} placeholders, which
//                resolveMetaDescription substitutes on every render
//                (src/lib/developmentSeo.ts) — so these cannot drift again.
//                Unit counts are deliberately NOT placeheld: the surrounding
//                phrasing would have to agree with a changing number ("1 units")
//                in four languages, and the count is already shown live in the
//                hero, the facts panel and the unit list on the same page.
//
//   description* Long prose, with no placeholder support on its render path, so
//                the wrong figures are edited out instead. Applied as EXACT
//                SUBSTRING replacements rather than whole-paragraph rewrites:
//                the stale number is usually one clause inside a 500-character
//                paragraph, and retyping the rest by hand is how you silently
//                corrupt copy nobody asked you to touch. Each `find` must occur
//                exactly once in the field, which makes it its own guard — if
//                the copy changed since review, the script aborts instead of
//                overwriting someone else's edit.
//
// Only what is WRONG is corrected. Figures that are still accurate stay — ridge
// quotes its real 307.6–347.1 m² range and its real 3.10 m ceilings, and there
// is no reason to strip a fact that is true and describes the built product
// rather than the current offer.
//
// A full backup of every field touched is written before the first update.
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const HERE = new URL(".", import.meta.url).pathname;
const batch = JSON.parse(readFileSync(`${HERE}fix-stale-copy-figures.json`, "utf8"));
const slugs = Object.keys(batch);
const DESC_FIELDS = ["descriptionEN", "descriptionDE", "descriptionPL", "descriptionRU"];

const devs = await prisma.development.findMany({
  where: { slug: { in: slugs } },
  select: {
    slug: true,
    override: { select: { id: true, seo: true, descriptionEN: true, descriptionDE: true, descriptionPL: true, descriptionRU: true } },
  },
});
if (devs.length !== slugs.length) throw new Error(`expected ${slugs.length} developments, found ${devs.length} — aborting`);
for (const d of devs) if (!d.override?.id) throw new Error(`${d.slug} has no override row — aborting`);

const stamp = process.env.BACKUP_STAMP || new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "");
const backupPath = `${HERE}fix-stale-copy-figures-backup-${stamp}.json`;
writeFileSync(backupPath, JSON.stringify(
  Object.fromEntries(devs.map((d) => [d.slug, {
    seo: d.override.seo ?? null,
    ...Object.fromEntries(DESC_FIELDS.map((k) => [k, d.override[k] ?? null])),
  }])), null, 2));
console.log(`backup: ${backupPath}\n`);

for (const d of devs) {
  const spec = batch[d.slug];
  const currentSeo = (d.override.seo && typeof d.override.seo === "object") ? d.override.seo : {};
  const data = {};

  console.log(`========== ${d.slug}`);

  if (spec.seo) {
    data.seo = { ...currentSeo, ...spec.seo };
    for (const [k, v] of Object.entries(spec.seo)) {
      console.log(`  ${k}`);
      console.log(`    old: ${JSON.stringify(currentSeo[k] ?? null)}`);
      console.log(`    new: ${JSON.stringify(v)}`);
    }
  }

  // Edits are grouped by field so several can be applied to the same paragraph
  // or to different paragraphs of the same text, in order.
  for (const [field, edits] of Object.entries(spec.edits ?? {})) {
    let text = d.override[field];
    if (!text) throw new Error(`${d.slug}.${field} is empty — aborting`);
    for (const { find, replace } of edits) {
      const occurrences = text.split(find).length - 1;
      if (occurrences !== 1) {
        throw new Error(`${d.slug}.${field}: ${JSON.stringify(find)} occurs ${occurrences}x, expected exactly 1 — copy changed since review, aborting`);
      }
      text = text.replace(find, replace);
      console.log(`  ${field}`);
      console.log(`    - ${JSON.stringify(find)}`);
      console.log(`    + ${JSON.stringify(replace)}`);
    }
    data[field] = text;
  }

  if (APPLY) {
    await prisma.developmentOverride.update({ where: { id: d.override.id }, data });
    console.log("  -> written");
  }
}

console.log(APPLY ? "\nDone." : "\nDRY RUN — nothing written. Re-run with --apply to write.");
await prisma.$disconnect();
