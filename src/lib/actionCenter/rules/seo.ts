import { prisma } from "@/lib/prisma";
import type { ActionItem } from "../types";
import { computeTitleSweepComparison, sweepVerdictLine } from "@/lib/seo/titleSweepRemeasure";
import { getCtrWatchlist, getWeekOverWeekMovers, getCwvFailingByClass, CTR_WINDOW_DAYS } from "@/lib/seo/queries";
import { getStaleCopyFigures, groupStaleFigures } from "@/lib/seo/staleCopyFigures";

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
  const comparisons = await computeTitleSweepComparison();
  return comparisons.filter((c) => c.isDue).map((comparison) => {
    const deltaLabel = comparison.avgCtrDeltaPp != null
      ? ` (avg ${comparison.avgCtrDeltaPp >= 0 ? "+" : ""}${comparison.avgCtrDeltaPp.toFixed(2)}pp)`
      : "";
    const batchDateStr = comparison.batchDate.toISOString().slice(0, 10);
    return {
      id: `seo-title-sweep-remeasure:${batchDateStr}`,
      severity: "INFO",
      category: "SEO",
      title: `Title-sweep re-measurement ready: ${comparison.improvedCount}/${comparison.measuredCount} pages improved CTR`,
      // The verdict line rides along because "12/30 improved CTR" in the title
      // is a number with no scale on it: over batch 1's windows the untouched
      // rest of the site lost CTR too, and an item that says only the first
      // half gets acted on as if the sweep caused the second. It carries the
      // control, the ranking shift and what this many clicks could detect.
      description: `Batch from ${batchDateStr}, measured ${comparison.daysElapsed} days later${deltaLabel}. ${sweepVerdictLine(comparison)}`,
      deepLink: "/admin/analytics/seo",
      since: comparison.batchDate,
    };
  });
}

// (e) Core Web Vitals degraded — one item per shared template class, not per
// URL (a Development-page layout issue affects every Development page, not
// just the sampled ones). See src/lib/seo/queries.ts's getCwvFailingByClass
// for the "sustained 3 consecutive measurements" logic.
async function cwvDegraded(): Promise<ActionItem[]> {
  const classes = await getCwvFailingByClass();
  return classes.filter((c) => c.failingUrls.length > 0).map((c) => ({
    id: `seo-cwv-degraded:${c.templateClass}`,
    severity: "ACTION",
    category: "SEO",
    title: `Core Web Vitals degraded on ${c.label} (${c.failingUrls.length} page${c.failingUrls.length === 1 ? "" : "s"})`,
    description: `Failing: ${c.failingMetrics.join(", ")} — sustained over the last 3 nightly checks. Example: ${c.failingUrls[0]}.`,
    deepLink: "/admin/analytics/seo",
    since: c.since,
  }));
}

// (f) Stored copy whose figures no longer match live data — a price or a unit
// count typed into a meta description or a project description, which nothing
// ever refreshes. See src/lib/seo/staleCopyFigures.ts for how it drifts and how
// widespread it was when this rule was written (26 of 128 published
// developments). A wrong PRICE is URGENT: it is the number a buyer acts on, and
// the audit found it wrong in both directions — :upside advertised €30,000
// below its real from-price, so the enquiry arrives expecting something that
// isn't for sale. A wrong count is ACTION: embarrassing, not costly.
//
// `since` is the override's updatedAt — the last moment the copy was touched,
// which is the closest thing to "when this became wrong" without a per-field
// history. It over-reports age when the copy was right at write time and only
// drifted later, which is the common case; the item still surfaces, just with
// an older timestamp than the drift itself.
//
// Prose can legitimately mention amounts other than the from-price (a furniture
// package, a fee); staleCopyFigures filters the class we have seen, and snooze
// covers the rest — hence a per-figure item id.
async function staleCopyFigures(): Promise<ActionItem[]> {
  const groups = groupStaleFigures(await getStaleCopyFigures());
  return groups.map((g) => ({
    id: `seo-stale-figure:${g.developmentId}:${g.kind}:${g.value}`,
    severity: g.kind === "price" ? "URGENT" : "ACTION",
    category: "SEO",
    title: g.kind === "price"
      ? `${g.publicName} — published copy names ${g.said}, the page shows ${g.live}`
      : `${g.publicName} — published copy says "${g.said}", live is ${g.live}`,
    description: `In ${g.fields.join(", ")}. "…${g.context}…" — this text is stored and never regenerated; replace the figure with a {priceFrom}/{unitsAvailable}/{completion} placeholder so it stays current.`,
    deepLink: `/admin/developments/${g.developmentId}`,
    since: g.updatedAt,
  }));
}

export async function seoRules(): Promise<ActionItem[]> {
  const [a, b, c, d, e, f] = await Promise.all([ctrOutliers(), rankingDrops(), newPagesIndexed(), titleSweepDue(), cwvDegraded(), staleCopyFigures()]);
  return [...a, ...b, ...c, ...d, ...e, ...f];
}
