import { prisma } from "@/lib/prisma";
import type { ActionItem } from "../types";
import { computeTitleSweepComparison } from "@/lib/seo/titleSweepRemeasure";
import { getCtrWatchlist, getWeekOverWeekMovers, CTR_WINDOW_DAYS } from "@/lib/seo/queries";

const DAY = 86_400_000;
const RANK_DROP_MIN_IMPRESSIONS = 100;
const RANK_DROP_THRESHOLD = 5; // positions worse, week over week
const NEW_PAGE_WINDOW_DAYS = 7;

// (a) CTR outlier — good position, bad CTR, real traffic, and not already
// being tracked by an in-flight title sweep (see docs/SEO-TITLE-SWEEP-LOG.md).
// Uses the exact same query the admin SEO view's watchlist section reads, so
// the two surfaces never disagree.
async function ctrOutliers(): Promise<ActionItem[]> {
  const since = new Date(Date.now() - CTR_WINDOW_DAYS * DAY);
  const watchlist = await getCtrWatchlist();
  return watchlist.map((row) => ({
    id: `seo-ctr-outlier:${row.locale}::${row.page}`,
    severity: "ACTION",
    category: "SEO",
    title: `${row.page} — low CTR at position ${row.position.toFixed(1)}`,
    description: `${row.impressions.toLocaleString("en-GB")} impressions, ${row.ctr.toFixed(2)}% CTR over ${CTR_WINDOW_DAYS} days — review title/meta.`,
    deepLink: "/admin/analytics/seo",
    since,
  }));
}

// (b) Ranking drop — this week vs last week, impression-weighted average
// position (GSC's own daily "position" isn't simply summable, so weight by
// each day's impressions rather than a plain average of averages). Reuses
// the same week-over-week computation as the admin view's "movers" list,
// filtered down to the subset that crosses the URGENT threshold.
async function rankingDrops(): Promise<ActionItem[]> {
  const thisWeekStart = new Date(Date.now() - 7 * DAY);
  const { down } = await getWeekOverWeekMovers(RANK_DROP_MIN_IMPRESSIONS);
  return down
    .filter((m) => m.delta > RANK_DROP_THRESHOLD)
    .map((m) => ({
      id: `seo-rank-drop:${m.locale}::${m.page}`,
      severity: "URGENT",
      category: "SEO",
      title: `${m.page} dropped ${m.delta.toFixed(1)} positions this week`,
      description: `Position ${m.priorPosition.toFixed(1)} → ${m.currentPosition.toFixed(1)} (${m.impressions.toLocaleString("en-GB")} impressions this week).`,
      deepLink: "/admin/analytics/seo",
      since: thisWeekStart,
    }));
}

// (c) New Development page first earning impressions — /projects/{slug}
// pages only (the new Development system), any locale prefix. "First" = the
// earliest date() we have on record for that page across all retained
// history; still within the last 7 days = "just appeared".
async function newPagesIndexed(): Promise<ActionItem[]> {
  const rows = await prisma.searchMetric.findMany({
    where: { query: null, page: { contains: "/projects/" } },
    select: { page: true, locale: true, date: true },
  });
  const firstSeen = new Map<string, Date>();
  for (const r of rows) {
    const key = `${r.locale}::${r.page}`;
    const prev = firstSeen.get(key);
    if (!prev || r.date < prev) firstSeen.set(key, r.date);
  }

  const cutoff = new Date(Date.now() - NEW_PAGE_WINDOW_DAYS * DAY);
  const items: ActionItem[] = [];
  for (const [key, since] of Array.from(firstSeen)) {
    if (since < cutoff) continue;
    const [, page] = key.split("::");
    items.push({
      id: `seo-new-page:${key}`,
      severity: "INFO",
      category: "SEO",
      title: `${page} is now indexed and earning impressions`,
      description: `First appeared in Search Console data on ${since.toISOString().slice(0, 10)}.`,
      deepLink: "/admin/analytics/seo",
      since,
    });
  }
  return items;
}

// (d) Title-sweep re-measurement — one aggregate item once the 42-day window
// is up (see src/lib/seo/titleSweepRemeasure.ts; the one-time Telegram push
// for this same milestone is triggered separately, from the gsc-sync cron).
async function titleSweepDue(): Promise<ActionItem[]> {
  const comparison = await computeTitleSweepComparison();
  if (!comparison || !comparison.isDue) return [];
  const deltaLabel = comparison.avgCtrDeltaPp != null
    ? ` (avg ${comparison.avgCtrDeltaPp >= 0 ? "+" : ""}${comparison.avgCtrDeltaPp.toFixed(2)}pp)`
    : "";
  return [{
    id: "seo-title-sweep-remeasure",
    severity: "INFO",
    category: "SEO",
    title: `Title-sweep re-measurement ready: ${comparison.improvedCount}/${comparison.measuredCount} pages improved CTR`,
    description: `Batch from ${comparison.batchDate.toISOString().slice(0, 10)}, measured ${comparison.daysElapsed} days later${deltaLabel}.`,
    deepLink: "/admin/analytics/seo",
    since: comparison.batchDate,
  }];
}

export async function seoRules(): Promise<ActionItem[]> {
  const [a, b, c, d] = await Promise.all([ctrOutliers(), rankingDrops(), newPagesIndexed(), titleSweepDue()]);
  return [...a, ...b, ...c, ...d];
}
