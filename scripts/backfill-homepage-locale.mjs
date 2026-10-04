// One-time backfill for the deriveLocale() bare-locale-root bug (see
// src/lib/gsc/client.ts, 2026-09-14). Every SearchMetric row with
// page IN ("/de","/pl","/ru") was written with locale:"en" instead of the
// correct locale, for the entire lifetime of the sync. Confirmed via a
// pre-flight collision check (2026-09-14, production): zero rows already
// exist with the correct locale for any of these three pages, so this is a
// plain UPDATE, not a merge — no aggregation logic needed.
//
// Usage: node --env-file=.env.local scripts/backfill-homepage-locale.mjs [--apply]
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const dbUrl = new URL(process.env.DATABASE_URL);
console.log(`DB host: ${dbUrl.hostname}:${dbUrl.port}`);
const APPLY = process.argv.includes("--apply");
console.log(APPLY ? "APPLY MODE" : "DRY RUN (pass --apply to write)");

const TARGETS = [
  { page: "/de", locale: "de" },
  { page: "/pl", locale: "pl" },
  { page: "/ru", locale: "ru" },
];

for (const { page, locale } of TARGETS) {
  const collision = await prisma.searchMetric.count({ where: { page, locale } });
  if (collision > 0) {
    console.log(`\n[${page}] ABORT: ${collision} row(s) already exist with locale=${locale} — this is no longer a plain relabel, needs merge logic. Skipping.`);
    continue;
  }
  const mislabeled = await prisma.searchMetric.count({ where: { page, locale: "en" } });
  console.log(`\n[${page}] rows to relabel from locale=en to locale=${locale}: ${mislabeled}`);
  if (APPLY) {
    const result = await prisma.searchMetric.updateMany({ where: { page, locale: "en" }, data: { locale } });
    console.log(`[${page}] updated: ${result.count}`);
    const check = await prisma.searchMetric.count({ where: { page, locale } });
    const remaining = await prisma.searchMetric.count({ where: { page, locale: "en" } });
    console.log(`[${page}] READBACK: locale=${locale} count=${check}, remaining locale=en count=${remaining}`);
  }
}
await prisma.$disconnect();
