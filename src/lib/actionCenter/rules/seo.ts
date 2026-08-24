import { prisma } from "@/lib/prisma";
import type { ActionItem } from "../types";
import { computeTitleSweepComparison, sweepVerdictLine } from "@/lib/seo/titleSweepRemeasure";
import { getCtrWatchlist, getWeekOverWeekMovers, getCwvFailingByClass, CTR_WINDOW_DAYS } from "@/lib/seo/queries";
import { getStaleCopyFigures, groupStaleFigures } from "@/lib/seo/staleCopyFigures";

const DAY = 86_400_000;
const RANK_DROP_MIN_IMPRESSIONS = 100;
const RANK_DROP_THRESHOLD = 5; // positions worse, week over week
const NEW_PAGE_WINDOW_DAYS = 7;
const NEW_PAGE_EXAMPLE_COUNT = 3;

// ISO-8601 week key ("2026-W34") in UTC, matching the UTC the rest of this file
// dates things in. Used only to scope the new-pages item's id — see the id
// comment in `newPagesIndexed` for why a week and not a page set or a count.
// Thursday decides both the year and the number, which is what makes the key
// correct across the turn of the year: 2026-12-28 and 2027-01-03 are both
// 2026-W53, and 2024-12-30 is already 2025-W01.
function isoWeekKey(d: Date): string {
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / DAY + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

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

// (c) New Development pages first earning impressions — /projects/{slug} pages
// only (the new Development system), any locale prefix. "First" = the earliest
// date() we have on record for that page across all retained history; still
// within the last 7 days = "just appeared".
//
// ONE item for the whole batch, not one per page — the same call pagePower.ts
// makes for its diagnoses, and here for a sharper reason: measured against
// production on 2026-08-23 this rule alone emitted 48 items, 26% of the 184 the
// Action Center held, and every one of them was an INFO notice that something
// had gone right. A panel of work to do cannot spend a quarter of itself on
// good news.
//
// The per-page shape was not wrong when it was written, it was overtaken.
// NEW_PROJECTS_INDEXABLE flipped on 2026-07-17 and roughly 130 Development
// pages across four locales entered the index at once, so a batch is now what a
// launch looks like, and the lone page one item per page was sized for is the
// rare case. Recomputed day by day back over the three weeks to 2026-08-23, the
// batch never held fewer than 48 pages and peaked at 118.
//
// Severity stays INFO at every size, and deliberately does not scale with
// impressions the way pagePower.ts's page items do. There is no work behind
// this item for a threshold to make urgent: those 48 pages carried 58
// impressions between them on 2026-08-23 — three on the largest, one apiece on
// thirty-nine of them — so an "at stake" rung would never fire, and a page
// being indexed still would not be a task if it did.
async function newPagesIndexed(): Promise<ActionItem[]> {
  const rows = await prisma.searchMetric.findMany({
    where: { query: null, page: { contains: "/projects/" } },
    select: { page: true, locale: true, date: true, impressions: true },
  });
  const firstSeen = new Map<string, Date>();
  // Lifetime total per page, which for a page whose first row falls inside the
  // window below is the same thing as "impressions since it appeared".
  const imprByKey = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.locale}::${r.page}`;
    const prev = firstSeen.get(key);
    if (!prev || r.date < prev) firstSeen.set(key, r.date);
    imprByKey.set(key, (imprByKey.get(key) ?? 0) + r.impressions);
  }

  // Both the count and the window are narrower than they read. GSC data lands
  // about three days late — on 2026-08-23 the newest row in search_metrics was
  // dated 2026-08-20 — so a 7-day window never holds more than four or five
  // days of data. That is how this rule and the sync have always behaved, not
  // something the grouping changed; it is written down because it is why the 48
  // pages measured that day sit well below the 80-118 the same window held a
  // week earlier.
  const cutoff = new Date(Date.now() - NEW_PAGE_WINDOW_DAYS * DAY);
  const fresh: Array<{ page: string; since: Date; impressions: number }> = [];
  for (const [key, since] of Array.from(firstSeen)) {
    if (since < cutoff) continue;
    const [, page] = key.split("::");
    fresh.push({ page, since, impressions: imprByKey.get(key) ?? 0 });
  }
  if (fresh.length === 0) return [];

  const impressions = fresh.reduce((sum, p) => sum + p.impressions, 0);
  const earliest = fresh.reduce((first, p) => (p.since < first ? p.since : first), fresh[0].since);
  const many = fresh.length > 1;
  // Largest three by impressions, each carrying its own figure. pagePower.ts
  // lists bare paths, but its piles run to thousands of impressions and a
  // ranking there means something; the entire spread here on 2026-08-23 was 3,
  // 2 and 1, so a bare "Largest:" would promise an ordering the data cannot
  // back. With a single page there is nothing to rank and it is simply named.
  const examples = fresh
    .slice()
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, NEW_PAGE_EXAMPLE_COUNT)
    .map((p) => `${p.page} (${p.impressions.toLocaleString("en-GB")})`);
  return [{
    // The ISO week the item is computed in — not the rule name alone, and not
    // pagePower.ts's magnitude band.
    //
    // A bare `seo-new-pages` could not survive dismissal: `dismissForeverItem`
    // writes snoozedUntil = 2099 (../snooze.ts), so one dismissal of "48 new
    // Development pages are now indexed" would silence every launch after it
    // too. An id has to be narrow enough that an old snooze cannot hide a new
    // condition, which is the same bar pagePower.ts sets for its own ids.
    //
    // pagePower.ts answers that with a band on the pile size, and the answer
    // does not transfer. Its band holds because its piles are slow: it takes a
    // roughly doubled pile to move a rung. This pile IS a rolling 7-day window,
    // and it moves that fast unaided — recomputed against production on
    // 2026-08-23 with `now` wound back a day at a time:
    //
    //   days back    0    1    2    3    4    5    6    7
    //   pages       48   60   68   76   80  113  111  116
    //   band        20   50   50   50   50  100  100  100
    //
    // — the band changes on the first night, so it would void even the one-day
    // snooze the panel offers (ActionCenterPanel.tsx), never mind the 30-day one.
    //
    // The week keeps both promises at once. Membership turns over completely
    // inside the window by construction, and measurably so: of the 48 pages in
    // the item computed on 2026-08-23, not one was in the item computed for
    // seven days earlier (48 in, 116 out). A week-long id therefore lasts about
    // as long as the batch it names stays the same batch — a snooze holds for
    // the rest of the week, and no dismissal, forever or otherwise, outlives it
    // by more than that. Monday's batch gets a new id, and next quarter's launch
    // can never be hidden by a dismissal taken today.
    //
    // It fails in the safe direction at the seam: a 7-day snooze taken on a
    // Saturday runs out of week on Monday and the item returns a few days early.
    // pagePower.ts records the same trade for its `unclicked` pile — an item
    // coming back too soon is the mistake to prefer over one that stays hidden.
    id: `seo-new-pages:${isoWeekKey(new Date())}`,
    severity: "INFO",
    category: "SEO",
    title: `${fresh.length.toLocaleString("en-GB")} new Development page${many ? "s are" : " is"} now indexed and earning impressions`,
    description: `${impressions.toLocaleString("en-GB")} impressions behind ${many ? "them" : "it"} so far. ${many ? `Largest: ${examples.join(", ")}` : examples[0]}. First appeared in Search Console data ${many ? `from ${earliest.toISOString().slice(0, 10)} onwards` : `on ${earliest.toISOString().slice(0, 10)}`}.`,
    deepLink: "/admin/analytics/seo",
    // The earliest first-appearance in the batch — exact, and not the
    // approximation pagePower.ts's items are forced into, because a first-seen
    // date is precisely when this condition became true for the page that has
    // held it longest. It moves FORWARD as pages age out of the window rather
    // than backward, so the item can never render as older than the window it
    // was computed over.
    since: earliest,
  }];
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
