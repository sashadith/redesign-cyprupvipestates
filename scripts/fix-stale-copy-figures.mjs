// One-off: correct the stale figures in :gravity's and :upside's published copy.
//
//   node --env-file=.env.local scripts/fix-stale-copy-figures.mjs           # dry run
//   node --env-file=.env.local scripts/fix-stale-copy-figures.mjs --apply   # write
//
// Both were advertising numbers that had drifted from live data (found by the
// Action Center rule in src/lib/seo/staleCopyFigures.ts, 2026-08-20):
//
//   :gravity  "from €981,243" and "Ten units"  — live: €360,053, 47 available
//   :upside   "from €280,000" and "11 units"   — live: €310,000, 10 available
//
// :upside's is the dangerous direction — the published price sat €30,000 BELOW
// the real one, so an enquiry arrives expecting something that is not for sale.
//
// Two different treatments, because the two field families render differently:
//
//   seo.desc*      -> rewritten with {priceFrom}/{completion} placeholders.
//                     resolveMetaDescription() substitutes them on every render
//                     (src/lib/developmentSeo.ts), so these can never drift
//                     again. Unit counts are deliberately NOT placeheld: the
//                     phrasing would have to agree with a number that changes
//                     ("1 units"), in four languages.
//   description*   -> plain prose, no placeholder support on that render path,
//                     so the volatile figures are removed instead. Only
//                     PARAGRAPH 2 is touched — the one carrying the count, the
//                     size range and the price. Paragraphs 1 and 3 are pure
//                     location and audience copy and are never rewritten; the
//                     script splices around them rather than restating them, so
//                     it cannot corrupt text it was not meant to change.
//
// Sizes, prices and availability are all shown live further down the same page
// (facts panel, hero, unit list), so removing them from the prose costs the
// reader nothing.
//
// Safety: a full backup of every field it touches is written before the first
// update, and each paragraph swap asserts the paragraph still contains the
// stale phrase it was reviewed against — if the copy changed since, the script
// aborts rather than overwriting someone else's edit.
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const HERE = new URL(".", import.meta.url).pathname;
const changes = JSON.parse(readFileSync(`${HERE}fix-stale-copy-figures.json`, "utf8"));
const slugs = Object.keys(changes);
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
  const spec = changes[d.slug];
  const currentSeo = (d.override.seo && typeof d.override.seo === "object") ? d.override.seo : {};
  const data = { seo: { ...currentSeo, ...spec.seo } };

  console.log(`========== ${d.slug}`);
  for (const [k, v] of Object.entries(spec.seo)) {
    console.log(`  ${k}`);
    console.log(`    old: ${JSON.stringify(currentSeo[k] ?? null)}`);
    console.log(`    new: ${JSON.stringify(v)}`);
  }

  for (const [field, { expect, text }] of Object.entries(spec.paragraph2)) {
    const full = d.override[field];
    if (!full) throw new Error(`${d.slug}.${field} is empty — aborting`);
    const paras = full.split(/\n\s*\n/);
    if (paras.length < 2) throw new Error(`${d.slug}.${field}: expected 2+ paragraphs, found ${paras.length} — aborting`);
    if (!paras[1].includes(expect)) {
      throw new Error(`${d.slug}.${field}: paragraph 2 no longer contains ${JSON.stringify(expect)} — copy changed since review, aborting`);
    }
    // Splice the replacement into the ORIGINAL string rather than re-joining the
    // parts. These fields are stored with CRLF line endings, and the paragraph
    // split leaves the trailing "\r" attached to each part — a join("\n\n")
    // would quietly rewrite every paragraph break in the field from CRLF to LF
    // and strip that "\r", i.e. change bytes this script has no business
    // touching. Preserving the trailing character keeps the field byte-identical
    // outside the one paragraph being replaced.
    const target = paras[1];
    const trailing = target.endsWith("\r") ? "\r" : "";
    const at = full.indexOf(target);
    if (at === -1) throw new Error(`${d.slug}.${field}: could not locate paragraph 2 in the source string — aborting`);
    data[field] = full.slice(0, at) + text + trailing + full.slice(at + target.length);
    console.log(`  ${field} — replacing paragraph 2 of ${paras.length}`);
    console.log(`    old: ${JSON.stringify(paras[1])}`);
    console.log(`    new: ${JSON.stringify(text)}`);
  }

  if (APPLY) {
    await prisma.developmentOverride.update({ where: { id: d.override.id }, data });
    console.log("  -> written");
  }
}

console.log(APPLY ? "\nDone." : "\nDRY RUN — nothing written. Re-run with --apply to write.");
await prisma.$disconnect();
