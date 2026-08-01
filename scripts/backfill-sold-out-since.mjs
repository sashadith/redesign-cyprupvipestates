// One-off backfill: stamp Development.soldOutSince = now for every
// Development that's already sold out at rollout time (Bündel 2, 2026-08-01).
// Run once, right after the migration deploys: node scripts/backfill-sold-out-since.mjs
//   node scripts/backfill-sold-out-since.mjs           (dry run, prints what would change)
//   node scripts/backfill-sold-out-since.mjs --apply   (writes)
//
// New/future sold-outs never need this — recomputeDevelopmentDerivedState()
// (src/lib/developmentDerivedState.ts) sets soldOutSince automatically from
// every write path that can change unit status. This script exists only to
// give a value to developments that were ALREADY sold out before the field
// existed, where there is no way to know the true sold-out date.
//
// IMPORTANT: the value this writes is a LOWER BOUND, not the true sold-out
// date — a project backfilled here could genuinely have been sold out for
// months already. Never display it as an exact date; the admin UI
// (src/app/admin/(panel)/developments/page.tsx's fmtSoldOutSince) already
// phrases every soldOutSince value as "at least" for this reason.
//
// The soldOut check here is a deliberate, small duplicate of
// computeAvailability() (src/lib/developmentAvailability.ts) — that module
// uses the "@/..." TS path alias, which plain `node` can't resolve outside
// the Next.js build (same reason every other scripts/*.mjs file in this repo
// is self-contained). If that rule ever changes, mirror it here too.
//
// Scoped to published/ready only (2026-08-01, same day, after review) —
// matches recomputeDevelopmentDerivedState()'s own "trackable" gate exactly:
// a draft can be mid-edit through "has units, none available yet" as pure
// data entry, not a real sold-out event, and an archived dev's archiving
// decision is already made — backfilling either would only risk a false
// "back in stock" notification later for a project that was never really
// on the market to begin with. See developmentDerivedState.ts for the full
// reasoning (identical gate, kept consistent on purpose).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const TRACKABLE_STATUSES = ["published", "ready"];

async function main() {
  const devs = await prisma.development.findMany({
    where: { soldOutSince: null, publishStatus: { in: TRACKABLE_STATUSES } },
    select: { id: true, publicName: true, dev: true, publishStatus: true, units: { select: { status: true } } },
  });

  const toBackfill = devs.filter((d) => {
    const total = d.units.length;
    const available = d.units.filter((u) => u.status === "available").length;
    return total > 0 && available === 0;
  });

  console.log(`${toBackfill.length} published/ready development(s) currently sold out with no soldOutSince yet:`);
  for (const d of toBackfill) console.log(`  - [${d.dev}/${d.publishStatus}] ${d.publicName} (${d.id})`);

  if (!APPLY) {
    console.log("\nDry run — no changes written. Re-run with --apply to write.");
    return;
  }

  const now = new Date();
  for (const d of toBackfill) {
    await prisma.development.update({ where: { id: d.id }, data: { soldOutSince: now } });
  }
  console.log(`\n✓ Backfilled soldOutSince = ${now.toISOString()} for ${toBackfill.length} development(s).`);
}

main().finally(() => prisma.$disconnect());
