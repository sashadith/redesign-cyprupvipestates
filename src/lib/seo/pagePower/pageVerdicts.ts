import { prisma } from "@/lib/prisma";
import { buildCanonicalMap, canonicalize, localeOfPath } from "@/lib/seo/urlCanonical";
import { templateClassOf } from "@/lib/seo/templateClass";
import { getInventory } from "./inventory";
import {
  BURIED_POSITION, CTR_MEDIAN_FRACTION, GSC_LAG_DAYS, MIN_BUCKET_IMPRESSIONS,
  MIN_BUCKET_PAGES, MIN_IMPRESSIONS_BURIED, MIN_IMPRESSIONS_CTR,
  MIN_IMPRESSIONS_VISIBLE, POSITION_BUCKETS, TREND_WINDOW_DAYS, WINDOW_DAYS,
  pageKey, type PageKey, type PageVerdict,
} from "./types";

const DAY = 86_400_000;

type Totals = { impressions: number; clicks: number; weightedPosition: number };

const emptyTotals = (): Totals => ({ impressions: 0, clicks: 0, weightedPosition: 0 });

type Window = { since: Date; until: Date };

/**
 * Sums page-level GSC rows into one totals map per requested window.
 *
 * Takes the canonical map as a PARAMETER rather than building it: it reads
 * `redirect-mapping.csv` off disk and queries the legacy-redirect table, and
 * the caller needs three windows, so building it per call would repeat that
 * work three times over.
 *
 * The windows are served from ONE query spanning their union for the same
 * reason — the trend windows are strictly inside the main window, so three
 * separate queries would pull the same tens of thousands of rows three times.
 */
async function gscTotals(canonicalMap: Map<string, string>, windows: Window[]): Promise<Array<Map<PageKey, Totals>>> {
  const since = new Date(Math.min(...windows.map((w) => w.since.getTime())));
  const until = new Date(Math.max(...windows.map((w) => w.until.getTime())));

  const rows = await prisma.searchMetric.findMany({
    where: { query: null, date: { gte: since, lt: until } },
    select: { date: true, page: true, impressions: true, clicks: true, position: true },
  });

  const outs = windows.map(() => new Map<PageKey, Totals>());
  for (const row of rows) {
    // Derive the locale from the PATH, not from SearchMetric.locale. All three
    // sources (GSC, PageView, Lead) must derive it identically or the join keys
    // will not line up — and the stored value is not reliable anyway: a German
    // article at a prefix-less URL is recorded with locale "en". `localeOfPath`
    // rather than `deriveLocale`: see its doc comment in urlCanonical.ts.
    const target = canonicalize(canonicalMap, localeOfPath(row.page), row.page);
    // Re-derive after canonicalisation too — `canonicalize` fills the locale in
    // with `deriveLocale`, which carries the bare-root blind spot.
    const key = pageKey(localeOfPath(target.page), target.page);
    const at = row.date.getTime();
    for (let i = 0; i < windows.length; i++) {
      if (at < windows[i].since.getTime() || at >= windows[i].until.getTime()) continue;
      const totals = outs[i].get(key) ?? emptyTotals();
      totals.impressions += row.impressions;
      totals.clicks += row.clicks;
      totals.weightedPosition += row.position * row.impressions;
      outs[i].set(key, totals);
    }
  }
  return outs;
}

const positionOf = (t: Totals): number | null => (t.impressions > 0 ? t.weightedPosition / t.impressions : null);
const ctrOf = (t: Totals): number => (t.impressions > 0 ? (100 * t.clicks) / t.impressions : 0);

/**
 * Median CTR per position bucket, computed over INVENTORY PAGES ONLY.
 *
 * The GSC side also carries keys that are not pages of this site any more:
 * parameterised and trailing-slash variants, URLs from before a migration that
 * no redirect covers, deleted content Google still remembers. Those skew one
 * way — they are dead or duplicate URLs, so their CTR is depressed — which
 * would drag each bucket median DOWN, and the median is the bar the `unclicked`
 * check is measured against. A dragged-down bar silently hides real
 * underperformers, and it does it without leaving a trace anywhere in the
 * output. The comparison is also only ever APPLIED to inventory pages, so
 * drawing "typical for this position" from a different population than the one
 * being judged is a category error regardless of which way the skew runs.
 *
 * The cost is sample size, and the cost is safe: a bucket that drops below
 * MIN_BUCKET_PAGES yields no median, and a page in it is reported `unjudged`
 * with a reason saying exactly that. Under-claiming is the correct failure.
 */
function bucketMedians(totals: Map<PageKey, Totals>, inventoryKeys: Set<PageKey>): Map<string, number> {
  const medians = new Map<string, number>();
  for (const [low, high] of POSITION_BUCKETS) {
    const ctrs: number[] = [];
    for (const [key, t] of Array.from(totals.entries())) {
      if (!inventoryKeys.has(key)) continue;
      const position = positionOf(t);
      if (position == null || t.impressions < MIN_BUCKET_IMPRESSIONS) continue;
      if (position >= low && position < high) ctrs.push(ctrOf(t));
    }
    if (ctrs.length < MIN_BUCKET_PAGES) continue;
    ctrs.sort((a, b) => a - b);
    medians.set(`${low}-${high}`, ctrs[Math.floor(ctrs.length / 2)]);
  }
  return medians;
}

function bucketKeyFor(position: number): string | null {
  for (const [low, high] of POSITION_BUCKETS) if (position >= low && position < high) return `${low}-${high}`;
  return null;
}

const fmt = (n: number): string => n.toLocaleString("en-GB");

export type PageVerdictResult = { verdicts: PageVerdict[]; coveragePct: number; windowStart: Date; windowEnd: Date };

export async function getPageVerdicts(now: Date = new Date()): Promise<PageVerdictResult> {
  const windowEnd = new Date(now.getTime() - GSC_LAG_DAYS * DAY);
  const windowStart = new Date(windowEnd.getTime() - WINDOW_DAYS * DAY);
  const trendStart = new Date(windowEnd.getTime() - TREND_WINDOW_DAYS * DAY);
  const priorStart = new Date(trendStart.getTime() - TREND_WINDOW_DAYS * DAY);

  const [inventory, canonicalMap] = await Promise.all([getInventory(), buildCanonicalMap()]);
  const [totals, recent, prior] = await gscTotals(canonicalMap, [
    { since: windowStart, until: windowEnd },
    { since: trendStart, until: windowEnd },
    { since: priorStart, until: trendStart },
  ]);

  const inventoryKeys = new Set(inventory.map((p) => p.key));
  const medians = bucketMedians(totals, inventoryKeys);
  const devSlugs = new Set(inventory.filter((p) => p.kind === "development").map((p) => p.path.split("/").pop() as string));

  const verdicts: PageVerdict[] = inventory.map((page) => {
    const t = totals.get(page.key) ?? emptyTotals();
    const position = positionOf(t);
    const ctr = ctrOf(t);

    const recentImpressions = recent.get(page.key)?.impressions ?? 0;
    const priorImpressions = prior.get(page.key)?.impressions ?? 0;
    const impressionsTrendPct = priorImpressions >= MIN_IMPRESSIONS_VISIBLE
      ? (100 * (recentImpressions - priorImpressions)) / priorImpressions
      : null;

    let diagnosis: PageVerdict["diagnosis"] = "unjudged";
    let reason = "Not enough data to judge.";

    if (t.impressions < MIN_IMPRESSIONS_VISIBLE) {
      diagnosis = "invisible";
      reason = `Fewer than ${MIN_IMPRESSIONS_VISIBLE} impressions in ${WINDOW_DAYS} days — indexing, internal links, or no demand for the subject.`;
    } else if (t.impressions >= MIN_IMPRESSIONS_BURIED && position != null && position > BURIED_POSITION) {
      diagnosis = "buried";
      reason = `${fmt(t.impressions)} impressions at average position ${position.toFixed(1)} — nobody scrolls that far. Needs content and authority, not a new title.`;
    } else if (t.impressions >= MIN_IMPRESSIONS_CTR && position != null && position <= BURIED_POSITION) {
      const bucket = bucketKeyFor(position);
      const median = bucket ? medians.get(bucket) : undefined;
      if (bucket == null) {
        // Position exactly BURIED_POSITION: the buckets are half-open and stop
        // at 20, so 20.0 belongs to no bucket while still passing the <= 20 test
        // above. Rare, but an impression-weighted average lands on a boundary
        // often enough to matter (see POSITION_BUCKETS in types.ts) — and "too
        // few comparable pages" would be a false explanation for it.
        reason = `Average position ${position.toFixed(1)} sits on the edge of the comparison range, so there is no expected CTR to measure against.`;
      } else if (median == null) {
        reason = `Position ${position.toFixed(1)} has too few comparable pages to set an expected CTR.`;
      } else if (ctr < median * CTR_MEDIAN_FRACTION) {
        diagnosis = "unclicked";
        reason = `CTR ${ctr.toFixed(2)}% against ${median.toFixed(2)}% typical for position ${position.toFixed(1)} — title and meta description.`;
      } else {
        diagnosis = "healthy";
        reason = `CTR ${ctr.toFixed(2)}% is in line with position ${position.toFixed(1)}.`;
      }
    } else {
      // Everything left over is `unjudged`, and it gets here for one of TWO
      // different reasons — which one depends on the position, so the sentence
      // has to branch or it will lie to an admin:
      //  - a bad position with too few impressions to call it buried, which is
      //    NOT a CTR question at all (a page at position 45 would never reach
      //    the CTR test however many impressions it had);
      //  - a good position with too few impressions to judge CTR.
      if (position != null && position > BURIED_POSITION) {
        reason = `${fmt(t.impressions)} impressions at average position ${position.toFixed(1)} — below the ${MIN_IMPRESSIONS_BURIED} impressions needed to call a page buried.`;
      } else {
        reason = `${fmt(t.impressions)} impressions — below the ${MIN_IMPRESSIONS_CTR} needed to judge CTR.`;
      }
    }

    return {
      key: page.key,
      locale: page.locale,
      path: page.path,
      templateClass: templateClassOf(page.path, devSlugs),
      impressions: t.impressions,
      clicks: t.clicks,
      ctr,
      position,
      diagnosis,
      reason,
      impressionsTrendPct,
    };
  });

  // Coverage: the share of GSC clicks that landed on a page we know about. If
  // this falls, redirects exist that the canonical map has not learned yet —
  // that is itself an alarm, so it is reported rather than silently absorbed.
  // Every unmatched click is a page being judged on partial data, or not judged
  // at all, so this number is the instrument the whole join is trusted on.
  let totalClicks = 0;
  let matchedClicks = 0;
  for (const [key, t] of Array.from(totals.entries())) {
    totalClicks += t.clicks;
    if (inventoryKeys.has(key)) matchedClicks += t.clicks;
  }
  const coveragePct = totalClicks > 0 ? (100 * matchedClicks) / totalClicks : 100;

  return { verdicts, coveragePct, windowStart, windowEnd };
}
