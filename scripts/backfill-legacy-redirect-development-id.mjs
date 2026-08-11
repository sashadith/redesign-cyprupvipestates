// One-off backfill: set LegacyProjectRedirect.developmentId for existing
// rows (Stage 2 of the redirect-target-drift fix, 2026-08-11). Run once,
// right after the migration deploys:
//   node scripts/backfill-legacy-redirect-development-id.mjs           (dry run, prints classification)
//   node scripts/backfill-legacy-redirect-development-id.mjs --apply   (writes Bucket A only)
//
// Investigation (2026-08-11, against the live DB, 232 rows total):
//   - Bucket A (224 rows): the archived Project already carries
//     supersededByDevelopmentId — a real FK set at archive time by
//     deactivateProjectWithRedirect, not a guess. This script only ever
//     writes this bucket.
//   - Bucket B (8 rows, 2 source projects x 4 locales: trees-apartments-inex,
//     trees-villas-inex): no FK on the source Project, but the row's
//     targetPath slug matches exactly one live, published Development
//     (Development.slug is @unique, so this is never a multi-candidate
//     ambiguity — it's just weaker evidence than an FK, since two distinct
//     legacy projects both landing on the same Development could equally be
//     a deliberate consolidation or a coincidence). Reported, NOT written —
//     left for a human to confirm before a future run backfills them.
//   - Bucket C (0 rows this run): no FK, no Development slug match at all —
//     genuinely hand-typed, no Development behind them. Left as
//     targetPath-only, same as before this migration.
//   - /developers/* targets and malformed targetPath values (0 rows this
//     run) are also reported separately and never touched here.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function parseTargetPath(targetPath) {
  const parts = targetPath.split("/").filter(Boolean);
  const locales = ["de", "pl", "ru"];
  let lang = "en";
  if (locales.includes(parts[0])) lang = parts.shift();
  const [kind, slug] = parts;
  return { lang, kind, slug, partsLen: parts.length };
}

async function main() {
  const rows = await prisma.legacyProjectRedirect.findMany({
    where: { developmentId: null },
    include: { project: { select: { language: true, slug: true, supersededByDevelopmentId: true } } },
  });

  const bucketA = [];
  const bucketAOrphaned = [];
  const bucketB = [];
  const bucketC = [];
  const bucketDevelopers = [];
  const bucketMalformed = [];

  for (const r of rows) {
    const { kind, slug, partsLen } = parseTargetPath(r.targetPath);
    const base = { redirectId: r.id, sourceSlug: r.project.slug, sourceLang: r.project.language, targetPath: r.targetPath };

    if (partsLen < 2 || !kind || !slug) { bucketMalformed.push(base); continue; }
    if (kind === "developers") { bucketDevelopers.push(base); continue; }
    if (kind !== "projects") { bucketMalformed.push(base); continue; }

    const devId = r.project.supersededByDevelopmentId;
    if (devId) {
      const dev = await prisma.development.findUnique({ where: { id: devId }, select: { id: true, slug: true, publishStatus: true } });
      if (dev?.slug && dev.publishStatus === "published") bucketA.push({ ...base, developmentId: dev.id });
      else bucketAOrphaned.push({ ...base, developmentId: devId });
      continue;
    }

    const dev = await prisma.development.findUnique({ where: { slug }, select: { id: true, publishStatus: true } });
    if (dev && dev.publishStatus === "published") bucketB.push({ ...base, developmentId: dev.id, matchedSlug: slug });
    else bucketC.push(base);
  }

  console.log(`${rows.length} row(s) with no developmentId yet.`);
  console.log(`Bucket A (FK-resolved, will be written): ${bucketA.length}`);
  console.log(`Bucket A-orphaned (FK points at a missing/unpublished Development — needs a human): ${bucketAOrphaned.length}`);
  console.log(`Bucket B (slug-match only, NOT written by this script): ${bucketB.length}`);
  console.log(`Bucket C (hand-typed, no Development behind them): ${bucketC.length}`);
  console.log(`Developer-path rows (not classified here): ${bucketDevelopers.length}`);
  console.log(`Malformed targetPath: ${bucketMalformed.length}`);

  for (const [label, bucket] of [["A-orphaned", bucketAOrphaned], ["B", bucketB], ["C", bucketC], ["developers", bucketDevelopers], ["malformed", bucketMalformed]]) {
    if (!bucket.length) continue;
    console.log(`\n--- Bucket ${label} ---`);
    for (const b of bucket) console.log(`  [${b.sourceLang}] ${b.sourceSlug} -> ${b.targetPath}`);
  }

  if (!APPLY) {
    console.log("\nDry run — no changes written. Re-run with --apply to write Bucket A.");
    return;
  }

  for (const b of bucketA) {
    await prisma.legacyProjectRedirect.update({ where: { id: b.redirectId }, data: { developmentId: b.developmentId } });
  }
  console.log(`\n✓ Backfilled developmentId for ${bucketA.length} row(s). ${bucketB.length + bucketC.length} left untouched (not FK-confirmed).`);
}

main().finally(() => prisma.$disconnect());
