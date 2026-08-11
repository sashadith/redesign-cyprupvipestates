// One-off backfill: set Lead.sourceLocale for leads that existed before the
// field did (Lead-Listen-Umbau, 2026-08-11). Run once, right after the
// migration deploys:
//   node scripts/backfill-lead-source-locale.mjs           (dry run, prints what would change)
//   node scripts/backfill-lead-source-locale.mjs --apply   (writes)
//
// sourceLocale is normally set ONCE, at intake, from the site locale the
// enquiry form was actually submitted from (see src/app/admin/actions.ts /
// wherever intake writes it) — never edited afterward. This script exists
// only to give a value to leads created before that field existed.
//
// Investigation (2026-08-11, against the live DB): of 158 non-deleted leads,
// 103 have a pageSource URL whose path locale-prefix is recoverable; the
// other 55 are all source=MANUAL (monday.com bulk imports) with either an
// empty pageSource or free text ("TikTok", "Friends", ...) — no recoverable
// signal anywhere (referrer/UTM/intake SYSTEM rows were all checked too and
// are equally empty for these). Those 55 are left null on purpose, not
// guessed at.
//
// Mirrors the site's actual locale-prefix convention (src/i18n.config.ts +
// src/middleware.ts: localePrefix "as-needed", defaultLocale "en"): no
// prefix or an explicit /en/ prefix = en; /de//pl//ru/ prefix = that locale.
// Same reasoning as backfill-sold-out-since.mjs for why this file is
// self-contained plain `node` (no "@/..." path alias).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function inferLocaleFromPageSource(pageSource) {
  if (!pageSource) return null;
  let path;
  try {
    path = new URL(pageSource).pathname;
  } catch {
    return null;
  }
  const m = path.match(/^\/(de|pl|ru)(\/|$)/);
  if (m) return m[1];
  return "en";
}

async function main() {
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, sourceLocale: null },
    select: { id: true, firstName: true, lastName: true, pageSource: true, source: true },
    orderBy: { createdAt: "asc" },
  });

  const byLocale = { en: [], de: [], pl: [], ru: [] };
  const unrecoverable = [];
  for (const l of leads) {
    const locale = inferLocaleFromPageSource(l.pageSource);
    if (locale) byLocale[locale].push(l);
    else unrecoverable.push(l);
  }

  const recoverableCount = leads.length - unrecoverable.length;
  console.log(`${leads.length} lead(s) with no sourceLocale yet.`);
  console.log(`Recoverable: ${recoverableCount} (en ${byLocale.en.length}, de ${byLocale.de.length}, pl ${byLocale.pl.length}, ru ${byLocale.ru.length})`);
  console.log(`Left null (no recoverable signal): ${unrecoverable.length}`);

  if (!APPLY) {
    console.log("\nDry run — no changes written. Re-run with --apply to write.");
    return;
  }

  let written = 0;
  for (const locale of ["en", "de", "pl", "ru"]) {
    for (const l of byLocale[locale]) {
      await prisma.lead.update({ where: { id: l.id }, data: { sourceLocale: locale } });
      written++;
    }
  }
  console.log(`\n✓ Backfilled sourceLocale for ${written} lead(s). ${unrecoverable.length} left null.`);
}

main().finally(() => prisma.$disconnect());
