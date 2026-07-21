import { prisma } from "@/lib/prisma";

// Catches scripted crawlers that spoof a legitimate desktop Chrome UA (so
// isbot()/EXTRA_BOT_RE in track/route.ts never sees them) but give themselves
// away behaviorally: one visitorHash racking up an implausible number of
// pageviews in a single day. Referrer is NOT part of the signal — internal
// same-host referrers are already nulled out at ingestion (see leads/track
// route), so "no referrer" is the NORMAL shape for a real visitor clicking
// around the site, not a bot tell.
//
// Threshold calibrated against 14 days of real traffic (2026-07-21): the
// vast majority of visitor-days have exactly 1 pageview; a recurring bot
// (confirmed via a single UA string appearing 708 times across 8 separate
// days, ~70-94/day) sat far above every real session. 30/day leaves wide
// margin above even a very engaged property-shopper's single sitting.
const DAILY_PAGEVIEW_THRESHOLD = 30;

export type FlagResult = { hashDaysFlagged: number; rowsFlagged: number };

// Scans a rolling window (default 3 days — the daily cron only needs to
// catch what's new since it last ran) and retroactively sets isBot=true for
// every (visitorHash, day) group over threshold. Idempotent: already-flagged
// rows are excluded from the scan, so re-running is always safe.
export async function flagHyperactiveSessions(lookbackDays = 3): Promise<FlagResult> {
  const since = new Date(Date.now() - lookbackDays * 86_400_000);
  const rows = await prisma.pageView.findMany({
    where: { createdAt: { gte: since }, isBot: false, isPrefetch: false, isTest: false },
    select: { id: true, visitorHash: true, createdAt: true },
  });

  const groups = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.visitorHash) continue;
    const day = r.createdAt.toISOString().slice(0, 10);
    const key = `${day}|${r.visitorHash}`;
    const ids = groups.get(key) ?? [];
    ids.push(r.id);
    groups.set(key, ids);
  }

  let hashDaysFlagged = 0;
  let rowsFlagged = 0;
  for (const ids of Array.from(groups.values())) {
    if (ids.length < DAILY_PAGEVIEW_THRESHOLD) continue;
    await prisma.pageView.updateMany({ where: { id: { in: ids } }, data: { isBot: true } });
    hashDaysFlagged++;
    rowsFlagged += ids.length;
  }
  return { hashDaysFlagged, rowsFlagged };
}
