// One-off backfill: classify existing PageView rows as isBot/isPrefetch so the
// admin Analytics page's country/device accuracy fix (2026-07-20) also cleans up
// history, not just traffic recorded after the fix ships. Run:
//   node scripts/backfill-pageview-bot-flags.mjs           (dry run, prints counts only)
//   node scripts/backfill-pageview-bot-flags.mjs --apply   (writes the updates)
//
// Three layers, in order — each only touches rows the previous layer left unflagged:
//
// 1. isBot — re-run the same isbot()+explicit-pattern check the track route now
//    applies at ingestion (src/app/api/analytics/track/route.ts) against each row's
//    already-stored userAgent. Self-contained rather than importing that TS file —
//    same reason every other scripts/*.mjs in this repo duplicates rather than
//    imports from src/ (plain `node` can't resolve the "@/..." path alias outside
//    the Next.js build). Keep this list in sync with the route's EXTRA_BOT_RE if
//    you change one.
//
// 2. isPrefetch (exact historical profile) — investigated 2026-07-20: one single
//    UA — `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)
//    Chrome/149.0.0.0 Safari/537.36` — accounts for 63.8% of all 13,832 historical
//    PageView rows. Not textually bot-like (isbot doesn't flag it), but the
//    behavioral profile is unambiguous: near-1:1 ratio of rows to distinct
//    visitorHash (real visitors don't share one fingerprint at that volume), 99%+
//    `referrer = www.google.com`, spread evenly across all 24 hours (not a nightly
//    cron pattern), landing on real content that ranks in search. This matches
//    Chrome/Google Search's privacy-preserving prerender: Google's infrastructure
//    speculatively renders top search results (executing real JS, hence our beacon
//    firing) before/without a user ever actually arriving. The exact UA+referrer
//    pair is the only thing we can match retroactively — the Sec-Purpose/Purpose
//    request header that would prove this definitively going forward was never
//    stored for historical rows. Documented, deliberate best-effort heuristic, not
//    a certainty — see the report after this script runs for the exact row count.
//
// 3. isBot (residual PSI-window fallback) — rows still unflagged after 1 and 2,
//    inside the psi-sync cron's run window (`0 2 * * *` UTC, ± a few minutes of
//    buffer for the ~30-URL sequential run). Catches genuine PageSpeed-Insights-
//    driven Lighthouse hits that don't share the dominant prefetch UA and don't
//    self-identify as a bot either. Broad by design (time-window only, no UA/
//    referrer condition) — this is the fallback the original task explicitly
//    anticipated for exactly this "UA doesn't help" scenario.
import { PrismaClient } from "@prisma/client";
import { isbot } from "isbot";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const EXTRA_BOT_RE =
  /googlebot|bingbot|ahrefsbot|semrushbot|gptbot|claudebot|perplexitybot|bytespider|facebookexternalhit|chrome-lighthouse|headlesschrome/i;
function isBotUA(ua) {
  if (!ua) return false;
  return isbot(ua) || EXTRA_BOT_RE.test(ua);
}

const PREFETCH_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
const PREFETCH_REFERRER = "www.google.com";

async function main() {
  console.log(APPLY ? "APPLY mode — writing updates." : "DRY RUN — no writes (pass --apply to write).");

  // Layer 1: UA-pattern bots. Batch-classify in JS (need isbot(), can't push into SQL).
  const candidates = await prisma.pageView.findMany({
    where: { isBot: false, isPrefetch: false },
    select: { id: true, userAgent: true },
  });
  const botIds = candidates.filter((r) => isBotUA(r.userAgent)).map((r) => r.id);
  console.log(`Layer 1 (isbot/pattern):     ${botIds.length} rows`);
  if (APPLY && botIds.length) {
    await prisma.pageView.updateMany({ where: { id: { in: botIds } }, data: { isBot: true } });
  }

  // Layer 2: exact dominant prefetch profile (only rows layer 1 didn't already take).
  const prefetchWhere = {
    isBot: false, isPrefetch: false,
    userAgent: PREFETCH_UA, referrer: PREFETCH_REFERRER,
  };
  const prefetchCount = await prisma.pageView.count({ where: prefetchWhere });
  console.log(`Layer 2 (prefetch profile):  ${prefetchCount} rows`);
  if (APPLY && prefetchCount) {
    await prisma.pageView.updateMany({ where: prefetchWhere, data: { isPrefetch: true } });
  }

  // Layer 3: residual PSI-window rows (still unflagged after 1 and 2), 01:55–02:20 UTC.
  const residual = await prisma.pageView.findMany({
    where: { isBot: false, isPrefetch: false },
    select: { id: true, createdAt: true },
  });
  const psiWindowIds = residual
    .filter((r) => {
      const h = r.createdAt.getUTCHours();
      const m = r.createdAt.getUTCMinutes();
      return (h === 1 && m >= 55) || (h === 2 && m <= 20);
    })
    .map((r) => r.id);
  console.log(`Layer 3 (PSI-window residual): ${psiWindowIds.length} rows`);
  if (APPLY && psiWindowIds.length) {
    await prisma.pageView.updateMany({ where: { id: { in: psiWindowIds } }, data: { isBot: true } });
  }

  const total = await prisma.pageView.count();
  const excludedTotal = botIds.length + prefetchCount + psiWindowIds.length;
  console.log(`\nTotal rows: ${total}`);
  console.log(`Would be excluded (bot+prefetch, all layers): ${excludedTotal} (${((excludedTotal / total) * 100).toFixed(1)}%)`);
  console.log(`Would remain as real views: ${total - excludedTotal}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
