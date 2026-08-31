// One-off cleanup: SearchMetric page-level rows (query IS NULL) currently
// allow duplicate (date, page, locale) keys, because the existing
// @@unique([date, page, locale, query]) constraint does not enforce
// uniqueness when query is NULL -- standard SQL NULL-inequality semantics
// (NULL is never considered equal to NULL for a unique constraint). This is
// step 1 of the SearchMetric ingest fix (2026-08-31 investigation): it clears
// the existing duplicates so a new partial unique index --
// `CREATE UNIQUE INDEX ... ON search_metrics (date, page, locale) WHERE query
// IS NULL` -- can be created without Postgres refusing over pre-existing
// violations.
//
// Two different kinds of duplicate, found by comparing values within each
// (date, page, locale) group, and handled differently:
//
//   - IDENTICAL-value groups: every row in the group already agrees on
//     impressions/clicks/position. Consistent with a plain concurrent-write
//     race (two upserts both found nothing via findFirst and both created --
//     see upsertOne's own P2002 comment in gsc-sync/route.ts, which already
//     documents this exact race for query-level rows; it silently also
//     applies to page-level rows because the constraint never blocks a
//     second NULL-query create). These are DEDUPED: keep the earliest-created
//     row untouched, delete the rest. No data lost -- the rows are copies.
//
//   - DIVERGED-value groups: rows disagree. Most likely because
//     pathFromGscUrl() (src/lib/gsc/client.ts) strips query strings and
//     fragments before storing `page`, so multiple genuinely distinct
//     GSC-reported URLs (e.g. the same article indexed both bare and with a
//     tracking parameter) collapse onto the identical stored key -- each
//     still carrying its own real impressions/clicks/position from GSC. These
//     are MERGED: sum impressions and clicks, recompute position as the
//     impression-weighted average across the group -- the same reduction
//     src/lib/seo/pagePower/pageVerdicts.ts's gscTotals() already performs at
//     read time, just made permanent here -- and ctr recomputed from the
//     merged clicks/impressions. Keep the earliest-created row, updated in
//     place with the merged values; delete the rest.
//
// Usage:
//   node scripts/cleanup-searchmetric-duplicates.mjs            # dry run (default) -- reports only, no writes
//   node scripts/cleanup-searchmetric-duplicates.mjs --apply    # writes, against the ambient DATABASE_URL
//
// Idempotent: after --apply, re-running finds zero duplicate groups and
// reports nothing to do.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

// Print the DB target up front, in both modes, so the operator can visually
// confirm before anything (even a dry run) touches the database.
{
  const url = new URL(process.env.DATABASE_URL);
  console.log(`Target database: "${url.pathname.replace(/^\//, "")}" (role "${url.username}", host "${url.hostname}")`);
}

if (!APPLY) {
  // Read-only mode -- same discipline as every other investigative query
  // this session: explicit, disclosed CVP_ALLOW_PROD_DB=1 bypass of the prod
  // guard, valid here because this mode makes no writes.
  process.env.CVP_ALLOW_PROD_DB = "1";
  const { assertNotProdDb } = await import("./assert-not-prod-db.mjs");
  assertNotProdDb();
} else {
  // The real, approved run -- writes against the ambient DATABASE_URL, same
  // shape as scripts/migrate-lead-activity-to-interactions.mjs's non-rehearsal
  // path. Not gated through assertNotProdDb: that guard's bypass is
  // documented as read-only-only, and this repo has no separate rehearsal DB
  // for search_metrics to route a --rehearsal mode through.
  console.log("--apply: writing. This is the real run.");
}

const beforeCount = await prisma.searchMetric.count({ where: { query: null } });

const groups = await prisma.$queryRaw`
  SELECT date, page, locale, COUNT(*)::int AS cnt,
         COUNT(DISTINCT impressions)::int AS distinct_impr,
         COUNT(DISTINCT clicks)::int AS distinct_clicks,
         COUNT(DISTINCT position)::int AS distinct_pos
  FROM search_metrics
  WHERE query IS NULL
  GROUP BY date, page, locale
  HAVING COUNT(*) > 1
  ORDER BY date, page, locale
`;

const isIdentical = (g) => g.distinct_impr === 1 && g.distinct_clicks === 1 && g.distinct_pos === 1;
const identicalGroups = groups.filter(isIdentical);
const divergedGroups = groups.filter((g) => !isIdentical(g));

console.log(`\n${groups.length} duplicate (date,page,locale) groups: ${identicalGroups.length} identical-value (dedupe), ${divergedGroups.length} diverged-value (merge).`);

const extraRows = groups.reduce((sum, g) => sum + (g.cnt - 1), 0);
console.log(`page-level rows before: ${beforeCount}`);
console.log(`rows to delete: ${extraRows}`);
console.log(`page-level rows after (projected): ${beforeCount - extraRows}`);

// 5 worked examples from the diverged set, spread across distinct pages.
console.log("\n--- 5 worked examples (diverged groups) ---");
const seenPages = new Set();
const examples = [];
for (const g of divergedGroups) {
  if (seenPages.has(g.page)) continue;
  seenPages.add(g.page);
  examples.push(g);
  if (examples.length === 5) break;
}
for (const g of examples) {
  const rows = await prisma.searchMetric.findMany({
    where: { date: g.date, page: g.page, locale: g.locale, query: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, impressions: true, clicks: true, position: true, createdAt: true },
  });
  const sumImpr = rows.reduce((s, r) => s + r.impressions, 0);
  const sumClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const weightedPos = rows.reduce((s, r) => s + r.position * r.impressions, 0) / sumImpr;
  console.log(`\n${g.date.toISOString().slice(0, 10)}  ${g.locale}::${g.page}  (${rows.length} rows)`);
  for (const r of rows) {
    console.log(`  before: impr=${r.impressions} clicks=${r.clicks} pos=${r.position.toFixed(2)}  (id=${r.id}, created=${r.createdAt.toISOString()})`);
  }
  const formula = rows.map((r) => `${r.position.toFixed(2)}×${r.impressions}`).join(" + ");
  console.log(`  merged: impr=${sumImpr} clicks=${sumClicks} pos=${weightedPos.toFixed(4)}  [= (${formula}) / ${sumImpr}]`);
  console.log(`  kept row: ${rows[0].id} (earliest created) updated in place; other ${rows.length - 1} row(s) deleted`);
}

if (!APPLY) {
  console.log("\nDry run only -- no writes made. Pass --apply to write.");
  await prisma.$disconnect();
  process.exit(0);
}

// --- apply: dedupe identical groups, merge diverged groups ---
console.log("\nApplying...");
let done = 0;
for (const g of groups) {
  const rows = await prisma.searchMetric.findMany({
    where: { date: g.date, page: g.page, locale: g.locale, query: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, impressions: true, clicks: true, position: true },
  });
  const keep = rows[0];
  const rest = rows.slice(1);

  if (!isIdentical(g)) {
    const sumImpr = rows.reduce((s, r) => s + r.impressions, 0);
    const sumClicks = rows.reduce((s, r) => s + r.clicks, 0);
    const weightedPos = sumImpr > 0 ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / sumImpr : keep.position;
    const newCtr = sumImpr > 0 ? (100 * sumClicks) / sumImpr : 0;
    await prisma.searchMetric.update({ where: { id: keep.id }, data: { impressions: sumImpr, clicks: sumClicks, position: weightedPos, ctr: newCtr } });
  }
  // identical groups: keep row is already correct as-is, no update needed.

  if (rest.length) {
    await prisma.searchMetric.deleteMany({ where: { id: { in: rest.map((r) => r.id) } } });
  }
  done++;
  if (done % 50 === 0) console.log(`  ${done}/${groups.length} groups done...`);
}

const afterCount = await prisma.searchMetric.count({ where: { query: null } });
console.log(`\nDone. ${done} groups processed.`);
console.log(`page-level rows before: ${beforeCount}`);
console.log(`page-level rows after: ${afterCount}`);

await prisma.$disconnect();
