import { prisma } from "@/lib/prisma";
import { buildCanonicalMap, canonicalize, localeOfPath } from "@/lib/seo/urlCanonical";
import { templateClassOf } from "@/lib/seo/templateClass";
import { getInventory } from "./inventory";
import {
  BURIED_POSITION, CTR_MEDIAN_FRACTION, GSC_LAG_DAYS, MIN_BUCKET_IMPRESSIONS,
  MIN_BUCKET_PAGES, MIN_IMPRESSIONS_BURIED, MIN_IMPRESSIONS_CTR,
  MIN_IMPRESSIONS_TREND, MIN_IMPRESSIONS_VISIBLE, POSITION_BUCKETS,
  TREND_WINDOW_DAYS, WINDOW_DAYS,
  pageKey, type PageKey, type PageVerdict,
} from "./types";

const DAY = 86_400_000;

// Deliberately NOT reusing `accumulate`/`avgPosition`/`ctrPct` from
// src/lib/seo/queries.ts, whose header declares itself the single source of
// truth for page-level aggregation. The divergence is the point: `avgPosition`
// returns 0 for a page with no impressions, and 0 is the BEST possible position
// — a page with no data would read as ranking first and be judged against the
// CTR expectation for position 0. This module needs "no position" to be
// representable, so `positionOf` returns null and every caller is forced to
// handle it. Same reason `positionOf` rejects non-finite values below. If those
// helpers ever grow a null-returning variant, collapse this back onto them.

type Totals = { impressions: number; clicks: number; weightedPosition: number };

const emptyTotals = (): Totals => ({ impressions: 0, clicks: 0, weightedPosition: 0 });

/** Named `MetricWindow`, not `Window`: `lib.dom` is in scope in this project and
 *  a bare `Window` silently shadows the global DOM type. */
type MetricWindow = { since: Date; until: Date };

/** Named, not positional. An `Array<Map<…>>` destructured as
 *  `[main, recent, prior]` lets a swap of two window literals type-check, run,
 *  and invert the sign of every trend arrow on the site with nothing to catch
 *  it. Position must not carry meaning here.
 *
 *  WINDOW_NAMES is the single declaration and both record types are derived
 *  from it, so a fourth window cannot be added to the record without the
 *  compiler also demanding it in the array — the residual failure mode of the
 *  fix above, where a name missing from the array would silently yield an
 *  empty map for that window. */
const WINDOW_NAMES = ["main", "recent", "prior"] as const;
type WindowName = (typeof WINDOW_NAMES)[number];
type WindowSet = Record<WindowName, MetricWindow>;
type TotalsSet = Record<WindowName, Map<PageKey, Totals>>;

/**
 * Sums page-level GSC rows into one totals map per window.
 *
 * Takes the canonical map as a PARAMETER rather than building it: it reads
 * `redirect-mapping.csv` off disk and queries the legacy-redirect table, and
 * there are three windows, so building it per call would repeat that work three
 * times over.
 *
 * The windows are served from ONE query spanning their union for the same
 * reason — the trend windows are strictly inside the main window, so three
 * separate queries would pull the same tens of thousands of rows three times.
 */
async function gscTotals(canonicalMap: Map<string, string>, windows: WindowSet): Promise<TotalsSet> {
  const bounds = WINDOW_NAMES.map((name) => windows[name]);
  const since = new Date(Math.min(...bounds.map((w) => w.since.getTime())));
  const until = new Date(Math.max(...bounds.map((w) => w.until.getTime())));

  const rows = await prisma.searchMetric.findMany({
    where: { query: null, date: { gte: since, lt: until } },
    select: { date: true, page: true, impressions: true, clicks: true, position: true },
  });

  const outs: TotalsSet = { main: new Map(), recent: new Map(), prior: new Map() };
  for (const row of rows) {
    // Derive the locale from the PATH, not from SearchMetric.locale. All three
    // sources (GSC, PageView, Lead) must derive it identically or the join keys
    // will not line up — and the stored value is not reliable anyway: a German
    // article at a prefix-less URL is recorded with locale "en". `localeOfPath`
    // rather than `deriveLocale`: see its doc comment in urlCanonical.ts.
    // The locale argument below is inert — `target.locale` is deliberately
    // ignored, see the next line — but `canonicalize` requires one.
    const target = canonicalize(canonicalMap, localeOfPath(row.page), row.page);
    // Re-derived from the CANONICAL path, discarding `target.locale`, because
    // `canonicalize` fills that in with `deriveLocale` and inherits its
    // bare-root blind spot. Neither call is redundant: this one decides the key.
    const key = pageKey(localeOfPath(target.page), target.page);
    const at = row.date.getTime();
    for (const name of WINDOW_NAMES) {
      // `range`, not `window`: a local named `window` shadows the DOM global,
      // which is in scope here even though this module is server-only.
      const range = windows[name];
      if (at < range.since.getTime() || at >= range.until.getTime()) continue;
      const totals = outs[name].get(key) ?? emptyTotals();
      totals.impressions += row.impressions;
      totals.clicks += row.clicks;
      totals.weightedPosition += row.position * row.impressions;
      outs[name].set(key, totals);
    }
  }
  return outs;
}

/** Null rather than 0 when there is no usable position — see the note at the
 *  top of this file. Non-finite is rejected explicitly: `position` is Postgres
 *  `double precision`, which admits NaN and ±Infinity, and NaN compares false
 *  against everything, so a single poisoned row would otherwise carry a
 *  50,000-impression page silently past every threshold in `getPageVerdicts`. */
const positionOf = (t: Totals): number | null => {
  if (t.impressions <= 0) return null;
  const position = t.weightedPosition / t.impressions;
  return Number.isFinite(position) ? position : null;
};

const ctrOf = (t: Totals): number => (t.impressions > 0 ? (100 * t.clicks) / t.impressions : 0);

/** The top of the SECOND position bucket — the union of POSITION_BUCKETS[0] and
 *  POSITION_BUCKETS[1], i.e. "on the first page of results". Used only by the
 *  `invisible` reason below, to decide whether a page's own rank rules out the
 *  technical explanations.
 *
 *  Derived from the buckets rather than written as a literal 10 so the boundary
 *  stays tied to the ranking bands the rest of this module already reasons in;
 *  re-banding POSITION_BUCKETS moves this with it instead of leaving a stale
 *  number behind. It reads two fixed indices, so it assumes the buckets keep at
 *  least two bands — which POSITION_BUCKETS' own doc comment already requires,
 *  since `bucketMedians` and `bucketKeyFor` depend on the same shape. */
const WELL_RANKED_POSITION = POSITION_BUCKETS[1][1];

/** Which bucket a position belongs to, or null if none — the ONE implementation
 *  of the half-open `[low, high)` membership rule documented on POSITION_BUCKETS
 *  in types.ts. `bucketMedians` calls it too, so a page can never be compared
 *  against a median drawn from a population it was not itself eligible for. */
function bucketKeyFor(position: number): string | null {
  for (const [low, high] of POSITION_BUCKETS) if (position >= low && position < high) return `${low}-${high}`;
  return null;
}

/** True median. `sorted[Math.floor(n / 2)]` on its own is the UPPER of the two
 *  middle values on an even-length sample — the 67th percentile of a six-page
 *  bucket, not the median — which biases the expected-CTR bar upward and
 *  over-flags `unclicked`, while the reason text quotes a "typical" figure that
 *  is typical of nothing. MIN_BUCKET_PAGES is 5, so even-length buckets are the
 *  ordinary case, not an edge case. Input must be sorted ascending. */
function medianOf(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

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
  const byBucket = new Map<string, number[]>();
  for (const [key, t] of Array.from(totals.entries())) {
    if (!inventoryKeys.has(key)) continue;
    if (t.impressions < MIN_BUCKET_IMPRESSIONS) continue;
    const position = positionOf(t);
    if (position == null) continue;
    const bucket = bucketKeyFor(position);
    if (bucket == null) continue;
    const ctrs = byBucket.get(bucket) ?? [];
    ctrs.push(ctrOf(t));
    byBucket.set(bucket, ctrs);
  }

  const medians = new Map<string, number>();
  for (const [bucket, ctrs] of Array.from(byBucket.entries())) {
    if (ctrs.length < MIN_BUCKET_PAGES) continue;
    ctrs.sort((a, b) => a - b);
    medians.set(bucket, medianOf(ctrs));
  }
  return medians;
}

const fmt = (n: number): string => n.toLocaleString("en-GB");

/** "1 impression" / "9 impressions". Only the `invisible` branch can reach a
 *  count of one — every other diagnosis has an impression floor of 100 or more —
 *  but 137 of the 1,118 invisible pages read "1 impressions" without this, and
 *  a tool that miscounts its own noun is not believed about anything else.
 *  Same shape as `enquiries` in classVerdicts.ts. */
const impressions = (n: number): string => `${fmt(n)} impression${n === 1 ? "" : "s"}`;

/** SearchMetric.date is `@db.Date`, so every row sits at UTC midnight. Bounds
 *  carrying `now`'s time-of-day make `gte: windowStart` exclude the row on
 *  windowStart's own date, so the date handed back for display is one the window
 *  does not contain — and the injectable `now` parameter invites callers to pass
 *  a date-only value, which would flip that behaviour again.
 *
 *  DST is a non-issue and DAY = 86_400_000 is exact here: every bound produced
 *  by this function is a UTC-midnight instant and every comparison against it is
 *  absolute-ms, so no local calendar is ever consulted. Do not "fix" the
 *  arithmetic later with a timezone-aware subtraction. */
const utcMidnight = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export type PageVerdictResult = {
  verdicts: PageVerdict[];
  coveragePct: number;
  /** INCLUSIVE, UTC midnight — the first day the window covers. */
  windowStart: Date;
  /** EXCLUSIVE, UTC midnight — the first day the window does NOT cover, i.e.
   *  the day after `today − GSC_LAG_DAYS`. Display code wanting a human
   *  "… to <last day>" must subtract one day. */
  windowEnd: Date;
};

export async function getPageVerdicts(now: Date = new Date()): Promise<PageVerdictResult> {
  // The property to hold: the NEWEST day inside the window is exactly
  // `today − GSC_LAG_DAYS`. `windowEnd` is an exclusive bound, so it is the
  // midnight that FOLLOWS that day — expressed here as "newest covered day,
  // plus one" rather than as `(GSC_LAG_DAYS - 1) * DAY`, so the property is
  // stated outright instead of being left for the reader to reconstruct from
  // the arithmetic. That newest day is present in the data: the sync cron
  // (src/app/api/cron/gsc-sync/route.ts, LAG_DAYS = 2) fetches through
  // `now − 2 days` inclusive, one day fresher than this window needs.
  const newestCoveredDay = utcMidnight(new Date(now.getTime() - GSC_LAG_DAYS * DAY));
  const windowEnd = new Date(newestCoveredDay.getTime() + DAY);
  const windowStart = utcMidnight(new Date(windowEnd.getTime() - WINDOW_DAYS * DAY));
  const trendStart = utcMidnight(new Date(windowEnd.getTime() - TREND_WINDOW_DAYS * DAY));
  const priorStart = utcMidnight(new Date(trendStart.getTime() - TREND_WINDOW_DAYS * DAY));

  const [inventory, canonicalMap] = await Promise.all([getInventory(), buildCanonicalMap()]);
  const totals = await gscTotals(canonicalMap, {
    main: { since: windowStart, until: windowEnd },
    recent: { since: trendStart, until: windowEnd },
    prior: { since: priorStart, until: trendStart },
  });

  const inventoryKeys = new Set(inventory.map((p) => p.key));
  const medians = bucketMedians(totals.main, inventoryKeys);
  const devSlugs = new Set(inventory.filter((p) => p.kind === "development").map((p) => p.path.split("/").pop() as string));

  const verdicts: PageVerdict[] = inventory.map((page) => {
    const t = totals.main.get(page.key) ?? emptyTotals();
    const position = positionOf(t);
    const ctr = ctrOf(t);

    const recentImpressions = totals.recent.get(page.key)?.impressions ?? 0;
    const priorImpressions = totals.prior.get(page.key)?.impressions ?? 0;
    const impressionsTrendPct = priorImpressions >= MIN_IMPRESSIONS_TREND
      ? (100 * (recentImpressions - priorImpressions)) / priorImpressions
      : null;

    let diagnosis: PageVerdict["diagnosis"] = "unjudged";
    let reason = "Not enough data to judge.";

    if (t.impressions < MIN_IMPRESSIONS_VISIBLE) {
      diagnosis = "invisible";
      // The diagnosis is right either way; the CAUSE is not. Calibration on
      // 2026-08-23 found three of the ten highest-impression `invisible` pages
      // ranking in the top seven results — `/projects/ruby-project` and
      // `/de/projects/velaro-homes` at position 2.9, `/ru/projects/aura-konia`
      // at 6.3, each on 9 impressions and an 11.1% CTR. A page at position 2.9
      // is indexed and is being served: "indexing" and "internal links" are not
      // merely unlikely there, they are EXCLUDED by the same row the verdict is
      // computed from, and the one cause that does apply was listed third. So
      // the sentence splits on the page's own rank.
      //
      // A page with no impressions has no position — `positionOf` returns null
      // rather than 0 for exactly this reason (see the note at the top of this
      // file) — and falls to the original wording, where indexing and internal
      // links are still live hypotheses. A null must never be read as a good
      // rank here; that is what the explicit `!= null` buys.
      reason = position != null && position < WELL_RANKED_POSITION
        ? `${impressions(t.impressions)} in ${WINDOW_DAYS} days, but at average position ${position.toFixed(1)} — indexed and served on the first page, so indexing and internal links are ruled out. Nobody is searching for this subject: the work is demand-side (a subject with search volume), or accepting that this page will never carry traffic. Nothing technical will move it.`
        : `Fewer than ${MIN_IMPRESSIONS_VISIBLE} impressions in ${WINDOW_DAYS} days — indexing, internal links, or no demand for the subject.`;
    } else if (t.impressions >= MIN_IMPRESSIONS_BURIED && position != null && position > BURIED_POSITION) {
      diagnosis = "buried";
      reason = `${fmt(t.impressions)} impressions at average position ${position.toFixed(1)} — nobody scrolls that far. Needs content and authority, not a new title.`;
    } else if (t.impressions >= MIN_IMPRESSIONS_CTR && position != null && position <= BURIED_POSITION) {
      const bucket = bucketKeyFor(position);
      const median = bucket == null ? undefined : medians.get(bucket);
      if (bucket == null) {
        // Position exactly BURIED_POSITION: the buckets are half-open and stop
        // at 20, so 20.0 belongs to no bucket while still passing the <= 20 test
        // above. Rare, but an impression-weighted average lands on a boundary
        // often enough to matter (see POSITION_BUCKETS in types.ts) — and "too
        // few comparable pages" would be a false explanation for it.
        reason = `Average position ${position.toFixed(1)} sits on the edge of the comparison range, so there is no expected CTR to measure against.`;
      } else if (median == null) {
        reason = `Position ${position.toFixed(1)} has too few comparable pages to set an expected CTR.`;
      } else if (!(median > 0)) {
        // A median of 0 means at least half the bucket earned no clicks, so the
        // bar is 0 and `ctr < 0 * fraction` can never be true. Left to fall
        // through, the `unclicked` test becomes unfalsifiable and EVERY page in
        // the bucket is certified healthy — including a 5,000-impression page
        // with no clicks at all, which is the single most confidently wrong
        // sentence this module could emit, on exactly the pages the feature
        // exists to find. It is reachable: at positions 10–20 the expected
        // clicks over the window are around one, so a thin locale's bucket
        // crossing 50% zero-click pages is ordinary. Kept distinct from the
        // too-few-pages case above: there the sample is missing, here the
        // sample exists and has nothing to say.
        //
        // Written `!(median > 0)` rather than `median <= 0` so a NaN bar is
        // rejected rather than silently passed through, matching the
        // Number.isFinite discipline in `positionOf` — one habit, not two
        // standards.
        //
        // The sentence branches on THIS page's clicks: a zero median says
        // nothing about the page being judged, so "earned no clicks either" is
        // untrue of a page here with 500 impressions and 15 clicks.
        const noBar = `At least half the comparable pages at position ${position.toFixed(1)} earned no clicks, so there is no expected CTR to judge against`;
        reason = t.clicks > 0
          ? `${noBar} — this page's own ${ctr.toFixed(2)}% cannot be called high or low.`
          : `${noBar}, and this page earned none either.`;
      } else if (ctr < median * CTR_MEDIAN_FRACTION) {
        diagnosis = "unclicked";
        reason = `CTR ${ctr.toFixed(2)}% against ${median.toFixed(2)}% typical for position ${position.toFixed(1)} — title and meta description.`;
      } else {
        diagnosis = "healthy";
        reason = `CTR ${ctr.toFixed(2)}% is in line with position ${position.toFixed(1)}.`;
      }
    } else if (position == null) {
      // Visible, but no usable average position — with impressions above the
      // floor the only way in is a non-finite weighted average, i.e. corrupt
      // stored GSC data. Blaming the impression count here would contradict the
      // impression count printed in the same sentence.
      reason = `${fmt(t.impressions)} impressions, but the stored average position is not a usable number — the GSC data for this page needs re-syncing.`;
    } else if (position > BURIED_POSITION) {
      // A bad position with too few impressions to call it buried. NOT a CTR
      // question: a page at position 45 would never reach the CTR test however
      // many impressions it had, so quoting the CTR floor here would misdirect.
      reason = `${fmt(t.impressions)} impressions at average position ${position.toFixed(1)} — below the ${MIN_IMPRESSIONS_BURIED} impressions needed to call a page buried.`;
    } else {
      // A good position with too few impressions to judge CTR.
      reason = `${fmt(t.impressions)} impressions — below the ${MIN_IMPRESSIONS_CTR} needed to judge CTR.`;
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
  for (const [key, t] of Array.from(totals.main.entries())) {
    totalClicks += t.clicks;
    if (inventoryKeys.has(key)) matchedClicks += t.clicks;
  }
  const coveragePct = totalClicks > 0 ? (100 * matchedClicks) / totalClicks : 100;

  return { verdicts, coveragePct, windowStart, windowEnd };
}
