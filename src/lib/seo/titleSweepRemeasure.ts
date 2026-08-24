import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { logCronRun } from "@/lib/cronLog";
import { loadSweepEntries, type SweepEntry } from "./titleSweepLog";
import { buildCanonicalMap, canonicalize } from "./urlCanonical";

// How long after a sweep batch ships before we auto-generate its before/after
// comparison — matches the 4-6 week re-measurement window called out in
// docs/SEO-TITLE-SWEEP-LOG.md itself (2026-08-15 to 2026-08-29, i.e. ~28-42
// days after the 2026-07-18 batch). We use the outer edge, 42 days, so the
// comparison isn't computed on noisy, too-early data.
export const REMEASURE_WINDOW_DAYS = 42;

/** Length of BOTH halves of the comparison. Not a "current" window length: the
 *  baseline is measured over exactly this many days too, ending the day before
 *  the batch shipped, because a comparison between windows of different lengths
 *  measures the difference in length as much as anything the sweep did.
 *
 *  That was the defect this file carried until 2026-08-24. "Current" was a
 *  trailing 28-day average and the baseline was the figure typed into
 *  docs/SEO-TITLE-SWEEP-LOG.md — which that document's own header records as a
 *  THREE-MONTH GSC average pulled 2026-07-18. On any page with a trend the
 *  comparison reported the trend. `/off-plan-properties-in-limassol` read
 *  "14.4 -> 55.2", a catastrophe; pooled across both URL variants that page's
 *  monthly average position was 4.1 in April, 5.8 in May, 26.6 in June, 51.6 in
 *  July and 55.2 in August (measured 2026-08-24). The slide started in May, two
 *  months before the rewrite, and the 14.4 is a three-month mean that April
 *  still carried. Against a like-for-like 28-day baseline the same page reads
 *  49.2 -> 55.2: still bad, but a page that was already broken before anyone
 *  touched its title. */
const METRIC_WINDOW_DAYS = 28;

const DAY = 86_400_000;
const TELEGRAM_JOB_KEY = "seo-title-sweep-telegram";

/** Lifts the power table reports on. Chosen to bracket what a title/meta
 *  rewrite plausibly buys: below +10% is not worth a sweep, above +30% does not
 *  happen from a title alone. */
const POWER_LIFTS_PCT = [10, 20, 30];

/** One-sided alpha for both the p-value and the power table. */
const ALPHA = 0.05;

/** Impressions a control page must have in BOTH windows before it counts toward
 *  the control's PER-PAGE statistics. The pooled figures need no such floor —
 *  they are impression-weighted, so a 4-impression page contributes almost
 *  nothing — but an unweighted mean of per-page CTRs is dominated by exactly
 *  those pages, where one click is 25 percentage points.
 *
 *  Measured 2026-08-24 on batch 1's windows: with no floor the control's mean
 *  per-page CTR change reads -1.10pp across 541 pages, 305 of which took zero
 *  clicks in both windows; at floors of 25/50/100/200 impressions it reads
 *  -0.39/-0.38/-0.23/-0.31pp across 167/97/67/33 pages. The unfloored figure is
 *  not a stronger version of the same finding, it is a different quantity — and
 *  it would have been quoted next to the swept batch's -0.11pp as if the rest of
 *  the site had fallen ten times as far. 100 for the same reason
 *  pagePower/types.ts uses it for MIN_IMPRESSIONS_TREND: the relative noise on a
 *  count is about 1/sqrt(n), so 100 impressions carries ~10% and the swings this
 *  statistic is meant to show sit outside it. */
const MIN_CONTROL_PAGE_IMPRESSIONS = 100;

type Agg = { impressions: number; clicks: number; posWeighted: number };

/** Pooled, impression-weighted figures for one side of one comparison. `pages`
 *  counts pages that drew at least one impression in the window, not pages that
 *  exist. */
export type SweepWindowTotals = {
  pages: number;
  impressions: number;
  clicks: number;
  ctrPct: number;
  position: number;
};

/** Both bounds INCLUSIVE, because a consumer quotes these dates to a human (or,
 *  in gather.ts, to a model that will quote them onward) and an exclusive bound
 *  quoted as a date is wrong. */
export type SweepWindow = { from: Date; to: Date; days: number };

/**
 * The comparable rest of the site over the SAME two windows: every page GSC
 * reported that no batch in the sweep log touched.
 *
 * This is the part without which `avgCtrDeltaPp` and `improvedCount` mean
 * nothing. Measured on production 2026-08-24, batch 1's windows (baseline
 * 2026-06-20 to 2026-07-17, current 2026-07-25 to 2026-08-21), all figures
 * canonicalised:
 *
 *     swept, 30 pages                     CTR 1.15% -> 0.38%   (x0.33)
 *     control, all 1,044 unswept pages    CTR 1.22% -> 1.00%   (x0.82)
 *     control, the 541 in BOTH windows    CTR 1.22% -> 0.87%   (x0.72)
 *
 * The whole site's CTR fell by roughly a quarter over those eight weeks. A
 * verdict of "CTR fell 0.77pp" read on its own is a verdict on the season, the
 * SERP layout and Google's summer, not on the rewrite.
 *
 * `pages` is deliberately the BOTH-windows set, not everything with a row.
 * 503 of the 1,044 unswept pages appear in only one of the two windows — mostly
 * project pages that entered the index during July — so the all-pages control
 * compares established pages against a mixture of established pages and new
 * arrivals, and holds up ten points better than the comparable one (x0.82 vs
 * x0.72) because the new arrivals bring impressions the old windows never had.
 * Using it would have set the bar for the swept pages against a control that is
 * not the same site twice.
 */
export type SweepControlGroup = {
  pages: number;
  /** Unswept pages with a row in EITHER window. `pagesEitherWindow - pages` is
   *  the arrival/departure churn the comparable set excludes — reported rather
   *  than silently dropped, because it is the figure that says how much of the
   *  site turned over between the windows. */
  pagesEitherWindow: number;
  baseline: SweepWindowTotals;
  current: SweepWindowTotals;
  /** current pooled CTR / baseline pooled CTR. Below 1 = the untouched rest of
   *  the site lost CTR too, and the swept pages' own ratio must be read against
   *  this number, never against 1. */
  ctrRatio: number | null;
  /** The counterparts to the batch's own `avgCtrDeltaPp` and
   *  `improvedCount / measuredCount` — per-page, unweighted, computed the same
   *  way, so the pairs can be read side by side. Restricted to control pages
   *  above MIN_CONTROL_PAGE_IMPRESSIONS in both windows; the batch's own figures
   *  are NOT, because the batch's pages are its whole population rather than a
   *  sample of one, and a floor there would drop rows the sweep actually
   *  shipped. Read the pooled `ctrRatio` as the primary comparison and this pair
   *  as the secondary one. */
  perPage: {
    minImpressions: number;
    pages: number;
    avgCtrDeltaPp: number | null;
    improvedShare: number | null;
  };
};

/**
 * Whether the batch's result is distinguishable from the control's trend, and
 * what size of effect this many clicks could have detected at all.
 *
 * `pValue` answers "did the swept pages beat, or lose to, the comparable rest
 * of the site?" — not "did CTR go up?". Both halves matter and the second one
 * is the one a consumer gets wrong: measured 2026-08-24, batch 1 carries 40
 * clicks across 30 pages. At that volume the test finds a +10% CTR lift 23% of
 * the time and a +30% one 83% of the time, so a null result at +10% is the
 * expected outcome whether or not the lift is real. **A result that is not
 * significant is not a finding that the rewrite failed.** `detectableLift` exists so a consumer —
 * including the LLM in seoAdvisor/gather.ts, which will otherwise narrate a
 * null result as a failure — has to state what it could have seen before it
 * reports what it did.
 */
export type SweepSignificance = {
  observedClicks: number;
  /** Clicks the swept pages would have drawn had they moved exactly like the
   *  control: their own baseline CTR, multiplied by the control's ctrRatio,
   *  applied to their own current impressions. */
  expectedClicks: number;
  /** One-sided, in whichever direction the result actually points: P(X <= obs)
   *  when observed is under expectation, P(X >= obs) when over. Poisson on the
   *  click count, which is the only quantity here with real sampling noise —
   *  impressions are effectively fixed by the rankings. */
  pValue: number;
  /** Power to detect a CTR lift of `liftPct` over the control's trend, at
   *  alpha=0.05 one-sided, at this batch's click volume. */
  detectableLift: { liftPct: number; power: number }[];
  /** The single page holding the largest share of the batch's baseline clicks.
   *  A pooled click test on 30 pages is not a finding about 30 pages when one of
   *  them is most of the sample: measured 2026-08-24, batch 1's
   *  /de/blog/wo-leben-die-meisten-deutschen-auf-zypern carried 63 of its 114
   *  baseline clicks (55%) and went to 3, and the whole of that batch's
   *  P<0.1% "behind the rest of the site" is that one page. Drop it and the
   *  remaining 29 come out at P=3% (37 clicks against 50.4 expected); and the
   *  per-page count says the swept pages improved MORE often than the comparable
   *  control did (12 of 30 = 40%, against 25% of the 67 control pages above the
   *  per-page impression floor). Three statistics, three different stories, and
   *  the concentration is what reconciles them. Surfaced so a consumer
   *  states the concentration instead of reporting one page as a verdict on a
   *  sweep. */
  topContributor: { page: string; baselineClicks: number; shareOfBaselineClicks: number } | null;
};

export type SweepComparisonRow = SweepEntry & {
  /** Computed from SearchMetric over `baselineWindow`. This is the baseline the
   *  comparison uses. */
  baselineComputedPosition?: number;
  baselineComputedCtr?: number;
  baselineComputedImpressions?: number;
  baselineComputedClicks?: number;
  currentPosition?: number;
  currentCtr?: number;
  currentImpressions?: number;
  currentClicks?: number;
  /** True when the COMPUTED baseline exists. Not the logged one: 13 of batch 1's
   *  30 pages are developer profiles, whose table in the sweep log records slug,
   *  title, project count and city and no metrics at all, so under the old
   *  logged-baseline rule 17 of 30 rows were measurable and the entire developer
   *  template fix — the reason the batch was 30 pages and not 17 — was
   *  unmeasurable by construction. Computing the baseline gives all 30 one. */
  hasBaseline: boolean;
  /** Whether docs/SEO-TITLE-SWEEP-LOG.md carries a typed baseline for this row.
   *  Provenance only — see `baselineCtr` / `baselinePosition` on SweepEntry. */
  hasLoggedBaseline: boolean;
  hasCurrentData: boolean;
};

export type SweepComparison = {
  batchDate: Date;
  dueDate: Date;
  isDue: boolean;
  daysElapsed: number;
  /** Null when the batch shipped after the last day GSC has data for — nothing
   *  to measure yet, and every row will read as having no current data. */
  baselineWindow: SweepWindow | null;
  currentWindow: SweepWindow | null;
  rows: SweepComparisonRow[];
  improvedCount: number;
  measuredCount: number;
  avgCtrDeltaPp: number | null;
  swept: { baseline: SweepWindowTotals; current: SweepWindowTotals; ctrRatio: number | null } | null;
  control: SweepControlGroup | null;
  significance: SweepSignificance | null;
};

const emptyAgg = (): Agg => ({ impressions: 0, clicks: 0, posWeighted: 0 });
const ctrOf = (a: Agg) => (a.impressions ? (a.clicks / a.impressions) * 100 : 0);
const posOf = (a: Agg) => (a.impressions ? a.posWeighted / a.impressions : 0);

function addTo(map: Map<string, Agg>, key: string, impressions: number, clicks: number, position: number) {
  const a = map.get(key) ?? emptyAgg();
  a.impressions += impressions;
  a.clicks += clicks;
  a.posWeighted += position * impressions;
  map.set(key, a);
}

function totalsOf(map: Map<string, Agg>, keys: string[]): SweepWindowTotals {
  const t = emptyAgg();
  let pages = 0;
  for (const key of keys) {
    const a = map.get(key);
    if (!a || a.impressions <= 0) continue;
    t.impressions += a.impressions;
    t.clicks += a.clicks;
    t.posWeighted += a.posWeighted;
    pages++;
  }
  return { pages, impressions: t.impressions, clicks: t.clicks, ctrPct: ctrOf(t), position: posOf(t) };
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
/** Both bounds inclusive, so a batch that shipped on the last day GSC has data
 *  for counts as one day of post-ship data, not zero. */
const inclusiveDays = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY) + 1;

/** P(X <= k) for X ~ Poisson(lambda). Summed in log space so the exp(-lambda)
 *  first term doesn't underflow if a future batch ever carries thousands of
 *  clicks; at the tens-of-clicks volumes this file actually sees it makes no
 *  difference. */
function poissonCdf(k: number, lambda: number): number {
  if (k < 0) return 0;
  if (lambda <= 0) return 1;
  let logTerm = -lambda;
  let sum = Math.exp(logTerm);
  for (let i = 1; i <= k; i++) {
    logTerm += Math.log(lambda) - Math.log(i);
    sum += Math.exp(logTerm);
  }
  return Math.min(1, sum);
}

/** Power of the one-sided test to detect `liftPct` more clicks than the control
 *  trend predicts, given that trend predicts `lambda0`. */
function poissonPower(lambda0: number, liftPct: number): number {
  if (lambda0 <= 0) return 0;
  const lambda1 = lambda0 * (1 + liftPct / 100);
  // Smallest k for which observing k or more clicks would clear alpha.
  let k = Math.ceil(lambda0);
  const cap = Math.ceil(lambda0 + 12 * Math.sqrt(lambda0) + 30); // ~12 sigma; the loop cannot run away
  while (k < cap && 1 - poissonCdf(k - 1, lambda0) > ALPHA) k++;
  return 1 - poissonCdf(k - 1, lambda1);
}

// Shared by: Action Center rule (d), the admin SEO view's "title-sweep
// measurement status" section, the weekly Advisor payload, and the one-time
// Telegram push below — one computation, four consumers.
//
// Returns one entry per distinct "## YYYY-MM-DD" batch section in the log,
// each with its own dueDate/isDue/rows — batches must stay independent so a
// second (or third) sweep doesn't inherit an earlier batch's due date or get
// silently skipped by the Telegram push once the first batch has already
// notified. (Previously this collapsed everything to `entries[0].batchDate`,
// which only ever worked because there was exactly one batch in the log.)
export async function computeTitleSweepComparison(): Promise<SweepComparison[]> {
  const entries = await loadSweepEntries();
  if (!entries.length) return [];

  const byBatch = new Map<number, SweepEntry[]>();
  for (const e of entries) {
    const key = e.batchDate.getTime();
    const arr = byBatch.get(key) ?? [];
    arr.push(e);
    byBatch.set(key, arr);
  }
  const batches = Array.from(byBatch.entries()).sort(([a], [b]) => a - b);

  // The current window ends at the last day that HAS data, not at Date.now().
  // GSC lags about three days: on 2026-08-24 the newest page-level row is
  // 2026-08-21. A trailing 28 days from "now" silently averages in three empty
  // days and one partial one, which drags every current CTR and position toward
  // whatever the incomplete tail happens to hold.
  const lastRow = await prisma.searchMetric.aggregate({ _max: { date: true }, where: { query: null } });
  const lastDay = lastRow._max.date ? utcDay(lastRow._max.date) : null;

  const windows = batches.map(([batchTime]) => {
    const batchDate = utcDay(new Date(batchTime));
    if (!lastDay || lastDay < batchDate) return { baseline: null, current: null };
    // Equal-length halves, and the current half holds only post-ship days. Both
    // fall out of one number: a batch younger than METRIC_WINDOW_DAYS gets a
    // shorter pair rather than a 28-day "current" window that reaches back
    // across its own deploy date. Batch 2 (2026-07-27) had 26 days of data on
    // 2026-08-24, so it is measured 26-vs-26; a 28-day current window would
    // have counted 2026-07-25 and -26 — two days of the OLD title — as "after".
    const days = Math.min(METRIC_WINDOW_DAYS, inclusiveDays(batchDate, lastDay));
    const baselineTo = addDays(batchDate, -1);
    return {
      baseline: { from: addDays(baselineTo, -(days - 1)), to: baselineTo, days },
      current: { from: addDays(lastDay, -(days - 1)), to: lastDay, days },
    };
  });

  const starts = windows.map((w) => w.baseline?.from).filter((d): d is Date => !!d);
  if (!starts.length) {
    return batches.map(([, batchEntries], i) => emptyComparison(batchEntries, windows[i]));
  }
  const earliest = starts.reduce((a, b) => (a < b ? a : b));

  // Every page-level row from the earliest baseline day to the last day with
  // data — the control group needs the whole site, not just the swept pages, so
  // this can no longer filter by page. Two 28-day windows plus the gap between
  // them is ~20k rows against a table of 37k (2026-08-24), the same order as
  // getCtrWatchlist's own unfiltered read.
  const metricRows = await prisma.searchMetric.findMany({
    where: { query: null, date: { gte: earliest, lte: lastDay! } },
    select: { page: true, locale: true, date: true, clicks: true, impressions: true, position: true },
  });

  // Both windows are canonicalised. The site moved English off the /en/ prefix
  // at the end of June — /en/off-plan-properties-in-limassol runs to 2026-06-29,
  // /off-plan-properties-in-limassol starts 2026-06-27 — and GSC keeps every URL
  // it has ever seen as its own `page` series forever, so a migrated page is two
  // series with the handover between them. That handover sits INSIDE batch 1's
  // baseline window. Measured 2026-08-24 over that window (2026-06-20 to
  // 2026-07-17): across the batch's 20 English pages an exact `page: { in: [...] }`
  // match — what this query did until now — sees 2,232 of 4,447 impressions and
  // 14 of 30 clicks. Half the English baseline, on the half of the window that
  // happens to fall on the newer URL.
  //
  // German is worse, and it is the one that would have inverted the verdict:
  // /blog/wo-leben-die-meisten-deutschen-auf-zypern handed over to
  // /de/blog/wo-leben-... on 2026-06-29, so the exact match sees 234 impressions
  // and ZERO clicks where the pooled series has 2,698 and 63 — 55% of the whole
  // batch's baseline clicks, on the pre-migration URL alone.
  //
  // A silent failure here looks exactly like success: the baseline shrinks, the
  // batch appears to have improved, and nothing errors.
  const canonicalMap = await buildCanonicalMap();
  const canonicalKey = new Map<string, string>();
  const keyFor = (locale: string, page: string): string => {
    const memo = `${locale}::${page}`;
    const hit = canonicalKey.get(memo);
    if (hit) return hit;
    const c = canonicalize(canonicalMap, locale as SweepEntry["locale"], page);
    const key = `${c.locale}::${c.page}`;
    canonicalKey.set(memo, key);
    return key;
  };

  // Swept across ALL batches, so batch 1's pages never land in batch 2's
  // control (and vice versa) — a control group has to be untouched, not merely
  // untouched by this one batch.
  const sweptKeys = new Set(entries.map((e) => keyFor(e.locale, e.page)));

  const perBatch = batches.map(() => ({ baseline: new Map<string, Agg>(), current: new Map<string, Agg>() }));
  for (const r of metricRows) {
    const key = keyFor(r.locale, r.page);
    const day = utcDay(r.date);
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      if (w.baseline && day >= w.baseline.from && day <= w.baseline.to) {
        addTo(perBatch[i].baseline, key, r.impressions, r.clicks, r.position);
      }
      if (w.current && day >= w.current.from && day <= w.current.to) {
        addTo(perBatch[i].current, key, r.impressions, r.clicks, r.position);
      }
    }
  }

  return batches.map(([, batchEntries], i) => {
    const batchDate = batchEntries[0].batchDate;
    const dueDate = new Date(batchDate.getTime() + REMEASURE_WINDOW_DAYS * DAY);
    const daysElapsed = Math.floor((Date.now() - batchDate.getTime()) / DAY);
    const isDue = Date.now() >= dueDate.getTime();
    const w = windows[i];
    if (!w.baseline || !w.current) return emptyComparison(batchEntries, w);

    const { baseline, current } = perBatch[i];

    const rows: SweepComparisonRow[] = batchEntries.map((e) => {
      const key = keyFor(e.locale, e.page);
      const b = baseline.get(key);
      const c = current.get(key);
      const hasBaseline = !!b && b.impressions > 0;
      const hasCurrentData = !!c && c.impressions > 0;
      return {
        ...e,
        hasBaseline,
        hasLoggedBaseline: e.baselineCtr != null,
        hasCurrentData,
        baselineComputedCtr: hasBaseline ? ctrOf(b!) : undefined,
        baselineComputedPosition: hasBaseline ? posOf(b!) : undefined,
        baselineComputedImpressions: b?.impressions,
        baselineComputedClicks: b?.clicks,
        currentCtr: hasCurrentData ? ctrOf(c!) : undefined,
        currentPosition: hasCurrentData ? posOf(c!) : undefined,
        currentImpressions: c?.impressions,
        currentClicks: c?.clicks,
      };
    });

    const measured = rows.filter((r) => r.hasBaseline && r.hasCurrentData);
    const improvedCount = measured.filter((r) => (r.currentCtr as number) > (r.baselineComputedCtr as number)).length;
    const avgCtrDeltaPp = measured.length
      ? measured.reduce((sum, r) => sum + ((r.currentCtr as number) - (r.baselineComputedCtr as number)), 0) / measured.length
      : null;

    const batchKeys = Array.from(new Set(batchEntries.map((e) => keyFor(e.locale, e.page))));
    const sweptBaseline = totalsOf(baseline, batchKeys);
    const sweptCurrent = totalsOf(current, batchKeys);
    const sweptRatio = sweptBaseline.ctrPct > 0 ? sweptCurrent.ctrPct / sweptBaseline.ctrPct : null;

    const control = buildControl(baseline, current, sweptKeys);
    const significance = buildSignificance(sweptBaseline, sweptCurrent, control, baseline, batchKeys);

    return {
      batchDate,
      dueDate,
      isDue,
      daysElapsed,
      baselineWindow: w.baseline,
      currentWindow: w.current,
      rows,
      improvedCount,
      measuredCount: measured.length,
      avgCtrDeltaPp,
      swept: { baseline: sweptBaseline, current: sweptCurrent, ctrRatio: sweptRatio },
      control,
      significance,
    };
  });
}

function emptyComparison(batchEntries: SweepEntry[], w: { baseline: SweepWindow | null; current: SweepWindow | null }): SweepComparison {
  const batchDate = batchEntries[0].batchDate;
  return {
    batchDate,
    dueDate: new Date(batchDate.getTime() + REMEASURE_WINDOW_DAYS * DAY),
    isDue: Date.now() >= batchDate.getTime() + REMEASURE_WINDOW_DAYS * DAY,
    daysElapsed: Math.floor((Date.now() - batchDate.getTime()) / DAY),
    baselineWindow: w.baseline,
    currentWindow: w.current,
    rows: batchEntries.map((e) => ({ ...e, hasBaseline: false, hasLoggedBaseline: e.baselineCtr != null, hasCurrentData: false })),
    improvedCount: 0,
    measuredCount: 0,
    avgCtrDeltaPp: null,
    swept: null,
    control: null,
    significance: null,
  };
}

function buildControl(baseline: Map<string, Agg>, current: Map<string, Agg>, sweptKeys: Set<string>): SweepControlGroup {
  const either = new Set<string>();
  for (const k of Array.from(baseline.keys())) if (!sweptKeys.has(k)) either.add(k);
  for (const k of Array.from(current.keys())) if (!sweptKeys.has(k)) either.add(k);

  const both: string[] = [];
  for (const k of Array.from(either)) {
    const b = baseline.get(k);
    const c = current.get(k);
    if (b && b.impressions > 0 && c && c.impressions > 0) both.push(k);
  }

  const bTotals = totalsOf(baseline, both);
  const cTotals = totalsOf(current, both);
  const deltas = both
    .filter((k) => baseline.get(k)!.impressions >= MIN_CONTROL_PAGE_IMPRESSIONS && current.get(k)!.impressions >= MIN_CONTROL_PAGE_IMPRESSIONS)
    .map((k) => ctrOf(current.get(k)!) - ctrOf(baseline.get(k)!));
  return {
    pages: both.length,
    pagesEitherWindow: either.size,
    baseline: bTotals,
    current: cTotals,
    ctrRatio: bTotals.ctrPct > 0 ? cTotals.ctrPct / bTotals.ctrPct : null,
    perPage: {
      minImpressions: MIN_CONTROL_PAGE_IMPRESSIONS,
      pages: deltas.length,
      avgCtrDeltaPp: deltas.length ? deltas.reduce((s, d) => s + d, 0) / deltas.length : null,
      improvedShare: deltas.length ? deltas.filter((d) => d > 0).length / deltas.length : null,
    },
  };
}

function buildSignificance(
  sweptBaseline: SweepWindowTotals,
  sweptCurrent: SweepWindowTotals,
  control: SweepControlGroup,
  baselineByKey: Map<string, Agg>,
  batchKeys: string[],
): SweepSignificance | null {
  if (control.ctrRatio == null || sweptBaseline.impressions <= 0 || sweptCurrent.impressions <= 0) return null;
  const expectedClicks = sweptCurrent.impressions * (sweptBaseline.ctrPct / 100) * control.ctrRatio;
  if (expectedClicks <= 0) return null;
  const observedClicks = sweptCurrent.clicks;
  const pValue =
    observedClicks <= expectedClicks
      ? poissonCdf(observedClicks, expectedClicks)
      : 1 - poissonCdf(observedClicks - 1, expectedClicks);

  let topContributor: SweepSignificance["topContributor"] = null;
  if (sweptBaseline.clicks > 0) {
    for (const key of batchKeys) {
      const clicks = baselineByKey.get(key)?.clicks ?? 0;
      if (!topContributor || clicks > topContributor.baselineClicks) {
        topContributor = { page: key.split("::")[1] ?? key, baselineClicks: clicks, shareOfBaselineClicks: clicks / sweptBaseline.clicks };
      }
    }
  }

  return {
    observedClicks,
    expectedClicks,
    pValue,
    detectableLift: POWER_LIFTS_PCT.map((liftPct) => ({ liftPct, power: poissonPower(expectedClicks, liftPct) })),
    topContributor,
  };
}

/** How far the swept pages' average position may diverge from the control's
 *  before the verdict line has to say so. A CTR comparison is not
 *  position-adjusted: CTR falls when a page ranks deeper, whatever its title
 *  says. Measured 2026-08-24, batch 1's swept pages went from position 11.6 to
 *  19.6 while the control moved 29.9 to 28.7 — a 9-place relative slide, and
 *  most of that batch's CTR fall is it. 3 places, because a page moving from
 *  position 8 to 11 leaves the first screen and typically loses about a third of
 *  its CTR — comparable to the whole effect a title rewrite is being tested
 *  for, so a divergence that size can no longer be left unmentioned. */
const POSITION_DIVERGENCE_CAVEAT = 3;

const formatP = (p: number) => (p < 0.001 ? "P<0.1%" : `P=${(p * 100).toFixed(0)}%`);

/** One line a consumer can print without re-deriving the comparison — and
 *  without being able to omit the control, the position shift or the power,
 *  which are the three omissions that turn a seasonal decline into "the rewrite
 *  failed". Admin-facing English. */
export function sweepVerdictLine(c: SweepComparison): string {
  if (!c.swept || !c.control || !c.significance) return "Not enough Search Console data to measure this batch yet.";
  const pp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}pp`;
  const sweptDelta = c.swept.current.ctrPct - c.swept.baseline.ctrPct;
  const controlDelta = c.control.current.ctrPct - c.control.baseline.ctrPct;
  const sig = c.significance;
  const verdict =
    sig.pValue >= ALPHA
      ? "no detectable difference from the comparable rest of the site"
      : sig.observedClicks > sig.expectedClicks
        ? "ahead of the comparable rest of the site"
        : "behind the comparable rest of the site";
  const parts = [
    `Swept CTR ${c.swept.baseline.ctrPct.toFixed(2)}% → ${c.swept.current.ctrPct.toFixed(2)}% (${pp(sweptDelta)}); ` +
      `the ${c.control.pages} comparable unswept pages ${c.control.baseline.ctrPct.toFixed(2)}% → ${c.control.current.ctrPct.toFixed(2)}% (${pp(controlDelta)}).`,
    `${sig.observedClicks} clicks against ${sig.expectedClicks.toFixed(1)} expected at the control's trend, ${formatP(sig.pValue)} — ${verdict}.`,
  ];

  // Position first, because when it has moved it usually IS the answer, and a
  // reader who has already accepted a CTR verdict will not revisit it.
  const sweptPosDelta = c.swept.current.position - c.swept.baseline.position;
  const controlPosDelta = c.control.current.position - c.control.baseline.position;
  if (Math.abs(sweptPosDelta - controlPosDelta) >= POSITION_DIVERGENCE_CAVEAT) {
    parts.push(
      `Average position moved ${c.swept.baseline.position.toFixed(1)} → ${c.swept.current.position.toFixed(1)} on the swept pages against ` +
        `${c.control.baseline.position.toFixed(1)} → ${c.control.current.position.toFixed(1)} on the control. This comparison is NOT position-adjusted, ` +
        `and a ranking move that size accounts for a CTR change of the size being tested — read the ranking, not the snippet, as the likelier cause.`,
    );
  }

  const top = sig.topContributor;
  if (top && top.shareOfBaselineClicks >= 0.4) {
    parts.push(
      `${(top.shareOfBaselineClicks * 100).toFixed(0)}% of the baseline clicks are one page (${top.page}), so this is largely that page's story, not the batch's.`,
    );
  }

  const best = sig.detectableLift[sig.detectableLift.length - 1];
  parts.push(
    `At this click volume a +${best.liftPct}% CTR lift would have been detected ${(best.power * 100).toFixed(0)}% of the time, ` +
      `so a result that is not significant is not evidence the rewrite failed.`,
  );
  return parts.join(" ");
}

/** Split out from the push itself so the message can be rendered and checked
 *  without sending one (and without writing the CronRunLog marker that would
 *  then suppress the real send). Admin-facing English, Telegram HTML. */
export function titleSweepTelegramText(comparison: SweepComparison, siteUrl: string): string {
  const windowLine = comparison.baselineWindow && comparison.currentWindow
    ? `${comparison.baselineWindow.days}d before (${isoDay(comparison.baselineWindow.from)}–${isoDay(comparison.baselineWindow.to)}) vs ${comparison.currentWindow.days}d after (${isoDay(comparison.currentWindow.from)}–${isoDay(comparison.currentWindow.to)}), Search Console, both URL variants pooled.`
    : "No Search Console data for this batch yet.";
  return [
    "<b>📈 Title-Sweep Re-Measurement Ready</b>",
    "",
    `Batch from ${isoDay(comparison.batchDate)}, measured ${comparison.daysElapsed} days later.`,
    windowLine,
    `${comparison.improvedCount}/${comparison.measuredCount} pages improved CTR.`,
    "",
    sweepVerdictLine(comparison),
    "",
    `<a href="${siteUrl}/admin/analytics/seo">View full comparison</a>`,
  ].join("\n");
}

// One-time-per-batch push, guarded by a CronRunLog marker keyed to that
// batch's date (job=`${TELEGRAM_JOB_KEY}:${batchDateISO}`, ok=true) so each
// batch notifies exactly once when its own window is first crossed, not
// every day forever after and not just once globally — separate from the
// Action Center INFO item (rule d), which keeps showing on the dashboard
// indefinitely once due, matching the "items are live conditions"
// architecture (see actionCenter/types.ts).
export async function maybeSendTitleSweepTelegram(): Promise<{ sent: number }> {
  const comparisons = await computeTitleSweepComparison();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
  let sent = 0;

  for (let i = 0; i < comparisons.length; i++) {
    const comparison = comparisons[i];
    if (!comparison.isDue) continue;
    const jobKey = `${TELEGRAM_JOB_KEY}:${comparison.batchDate.toISOString().slice(0, 10)}`;
    // comparisons is sorted earliest-first, so index 0 is the one batch that
    // could have gone through the pre-multi-batch code path, which wrote its
    // "sent" marker under the old un-suffixed TELEGRAM_JOB_KEY (no per-batch
    // key existed yet). If this deploy lands after that batch's due date has
    // already passed under the old code, the "already sent" row is under
    // that legacy key, not this batch's new one — check both so a late
    // deploy can never cause a duplicate send for a pre-existing batch.
    const candidateKeys = i === 0 ? [jobKey, TELEGRAM_JOB_KEY] : [jobKey];
    const already = await prisma.cronRunLog.findFirst({ where: { job: { in: candidateKeys }, ok: true } });
    if (already) continue;

    await sendTelegramMessage(titleSweepTelegramText(comparison, siteUrl));
    await logCronRun(jobKey, true, `sent: ${comparison.improvedCount}/${comparison.measuredCount} improved`);
    sent++;
  }

  return { sent };
}
