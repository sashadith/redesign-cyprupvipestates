import { prisma } from "@/lib/prisma";
import type { Locale } from "@prisma/client";
import { pagesInSuppressionWindow } from "./titleSweepLog";
import { REMEASURE_WINDOW_DAYS } from "./titleSweepRemeasure";
import { templateClassOf, templateClassLabel, type TemplateClass } from "./templateClass";

// Shared page-level (query=null) aggregation helpers + the CTR-watchlist and
// week-over-week mover queries — single source of truth used by BOTH the
// Action Center rules (src/lib/actionCenter/rules/seo.ts) and the admin SEO
// view (src/app/admin/(panel)/analytics/seo/page.tsx), so the two surfaces
// can never disagree about what counts as an outlier or a mover.
const DAY = 86_400_000;

export const CTR_WINDOW_DAYS = 28;
export const CTR_MIN_IMPRESSIONS = 200;
export const CTR_MAX_POSITION = 10;
export const CTR_MAX_RATE = 1.5; // %
export const CTR_SUPPRESSION_WINDOW_DAYS = REMEASURE_WINDOW_DAYS;

export type MetricAgg = { impressions: number; clicks: number; posWeighted: number };

export function accumulate(map: Map<string, MetricAgg>, key: string, impressions: number, clicks: number, position: number) {
  const a = map.get(key) ?? { impressions: 0, clicks: 0, posWeighted: 0 };
  a.impressions += impressions;
  a.clicks += clicks;
  a.posWeighted += position * impressions;
  map.set(key, a);
}
export const avgPosition = (a: MetricAgg) => (a.impressions ? a.posWeighted / a.impressions : 0);
export const ctrPct = (a: MetricAgg) => (a.impressions ? (a.clicks / a.impressions) * 100 : 0);

export type CtrWatchlistRow = { locale: Locale; page: string; impressions: number; ctr: number; position: number };

export async function getCtrWatchlist(): Promise<CtrWatchlistRow[]> {
  const since = new Date(Date.now() - CTR_WINDOW_DAYS * DAY);
  const rows = await prisma.searchMetric.findMany({
    where: { query: null, date: { gte: since } },
    select: { page: true, locale: true, clicks: true, impressions: true, position: true },
  });
  const agg = new Map<string, MetricAgg>();
  const localeByKey = new Map<string, Locale>();
  for (const r of rows) {
    const key = `${r.locale}::${r.page}`;
    accumulate(agg, key, r.impressions, r.clicks, r.position);
    localeByKey.set(key, r.locale);
  }

  const suppressed = await pagesInSuppressionWindow(CTR_SUPPRESSION_WINDOW_DAYS);
  const out: CtrWatchlistRow[] = [];
  for (const [key, a] of Array.from(agg)) {
    const [, page] = key.split("::");
    if (a.impressions < CTR_MIN_IMPRESSIONS || suppressed.has(page)) continue;
    const position = avgPosition(a);
    const ctr = ctrPct(a);
    if (position > CTR_MAX_POSITION || ctr >= CTR_MAX_RATE) continue;
    out.push({ locale: localeByKey.get(key)!, page, impressions: a.impressions, ctr, position });
  }
  return out.sort((a, b) => b.impressions - a.impressions);
}

export type MoverRow = { locale: Locale; page: string; impressions: number; priorPosition: number; currentPosition: number; delta: number };

// Positive delta = position got worse (numerically higher); negative = improved.
// Returns the FULL sorted lists (not capped) — callers slice as needed: the
// admin view's "top movers" display wants the top 10 each direction, while
// the Action Center ranking-drop rule needs every page crossing its
// threshold, not just the 10 biggest (a true alerting condition must never
// silently drop items past an arbitrary display cap).
export async function getWeekOverWeekMovers(minImpressions = 20): Promise<{ up: MoverRow[]; down: MoverRow[] }> {
  const thisWeekStart = new Date(Date.now() - 7 * DAY);
  const lastWeekStart = new Date(Date.now() - 14 * DAY);
  const rows = await prisma.searchMetric.findMany({
    where: { query: null, date: { gte: lastWeekStart } },
    select: { page: true, locale: true, date: true, clicks: true, impressions: true, position: true },
  });
  const thisWeek = new Map<string, MetricAgg>();
  const lastWeek = new Map<string, MetricAgg>();
  const localeByKey = new Map<string, Locale>();
  for (const r of rows) {
    const key = `${r.locale}::${r.page}`;
    localeByKey.set(key, r.locale);
    accumulate(r.date >= thisWeekStart ? thisWeek : lastWeek, key, r.impressions, r.clicks, r.position);
  }

  const movers: MoverRow[] = [];
  for (const [key, current] of Array.from(thisWeek)) {
    if (current.impressions < minImpressions) continue;
    const prior = lastWeek.get(key);
    if (!prior || !prior.impressions) continue;
    const [, page] = key.split("::");
    const currentPosition = avgPosition(current);
    const priorPosition = avgPosition(prior);
    movers.push({ locale: localeByKey.get(key)!, page, impressions: current.impressions, priorPosition, currentPosition, delta: currentPosition - priorPosition });
  }
  const improved = movers.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta); // most negative first = biggest improvement
  const worsened = movers.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta);
  return { up: improved, down: worsened };
}

export type LocaleTrendPoint = { date: string; clicks: number; impressions: number };
export type LocaleTrend = { locale: Locale; series: LocaleTrendPoint[] };

export async function getPerLocaleTrend(days = 90): Promise<LocaleTrend[]> {
  const since = new Date(Date.now() - days * DAY);
  const rows = await prisma.searchMetric.findMany({
    where: { query: null, date: { gte: since } },
    select: { date: true, locale: true, clicks: true, impressions: true },
  });
  const locales: Locale[] = ["en", "de", "pl", "ru"] as Locale[];
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) dayKeys.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10));

  return locales.map((locale) => {
    const byDay = new Map<string, { clicks: number; impressions: number }>();
    for (const d of dayKeys) byDay.set(d, { clicks: 0, impressions: 0 });
    for (const r of rows) {
      if (r.locale !== locale) continue;
      const k = r.date.toISOString().slice(0, 10);
      const bucket = byDay.get(k);
      if (bucket) { bucket.clicks += r.clicks; bucket.impressions += r.impressions; }
    }
    return { locale, series: dayKeys.map((d) => ({ date: d, ...byDay.get(d)! })) };
  });
}

// --- Core Web Vitals: per-template-class failure summary ---------------------
// A URL "fails" only when its last CWV_SUSTAINED_COUNT consecutive nightly
// readings ALL exceed at least one threshold — a single bad measurement
// (transient load, PSI flakiness) shouldn't trigger an alert. Grouped by
// template class since a Development-page layout issue affects every
// Development page, not just the one or two we happened to sample that night.
export const CWV_LCP_MAX_MS = 3500;
export const CWV_CLS_MAX = 0.15;
export const CWV_INP_MAX_MS = 350;
export const CWV_SUSTAINED_COUNT = 3;
const CWV_LOOKBACK_DAYS = 10; // generous window — plenty of headroom for 3 nightly reads even if a night or two is missed

export type CwvFailingMetric = "LCP" | "CLS" | "INP";
export type CwvClassSummary = {
  templateClass: TemplateClass;
  label: string;
  failingUrls: string[];
  failingMetrics: CwvFailingMetric[];
  since: Date;
};

function failsThreshold(r: { lcp: number; cls: number; inp: number | null }): CwvFailingMetric[] {
  const metrics: CwvFailingMetric[] = [];
  if (r.lcp > CWV_LCP_MAX_MS) metrics.push("LCP");
  if (r.cls > CWV_CLS_MAX) metrics.push("CLS");
  if (r.inp != null && r.inp > CWV_INP_MAX_MS) metrics.push("INP");
  return metrics;
}

export async function getCwvFailingByClass(): Promise<CwvClassSummary[]> {
  const since = new Date(Date.now() - CWV_LOOKBACK_DAYS * DAY);
  const rows = await prisma.cwvMetric.findMany({ where: { date: { gte: since } }, orderBy: { date: "desc" } });

  const latestByUrl = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = latestByUrl.get(r.url) ?? [];
    if (arr.length < CWV_SUSTAINED_COUNT) arr.push(r);
    latestByUrl.set(r.url, arr);
  }

  const byClass = new Map<TemplateClass, { urls: string[]; metrics: Set<CwvFailingMetric>; oldestDate: Date }>();
  for (const [url, readings] of Array.from(latestByUrl)) {
    if (readings.length < CWV_SUSTAINED_COUNT) continue; // not enough history yet
    const perReadingFailures = readings.map(failsThreshold);
    if (perReadingFailures.some((f) => f.length === 0)) continue; // at least one clean reading — not sustained
    const cls = templateClassOf(url);
    const entry = byClass.get(cls) ?? { urls: [], metrics: new Set<CwvFailingMetric>(), oldestDate: readings[0].date };
    entry.urls.push(url);
    for (const f of perReadingFailures.flat()) entry.metrics.add(f);
    const oldest = readings[readings.length - 1].date;
    if (oldest < entry.oldestDate) entry.oldestDate = oldest;
    byClass.set(cls, entry);
  }

  return Array.from(byClass.entries()).map(([templateClass, e]) => ({
    templateClass,
    label: templateClassLabel(templateClass),
    failingUrls: e.urls,
    failingMetrics: Array.from(e.metrics),
    since: e.oldestDate,
  }));
}

// --- Period-over-period comparison + movers, for the SEO Advisor's gather step ---
// (separate from CTR_WINDOW_DAYS/getWeekOverWeekMovers above — those serve the
// Action Center's rolling rules; these serve the Advisor's fixed 28-day report).
export const ADVISOR_PERIOD_DAYS = 28;

export type LocalePeriodComparison = {
  locale: Locale;
  clicks: number; clicksPrev: number;
  impressions: number; impressionsPrev: number;
  ctr: number; ctrPrev: number;
  position: number; positionPrev: number;
};

export async function getLocalePeriodComparison(days = ADVISOR_PERIOD_DAYS): Promise<LocalePeriodComparison[]> {
  const periodStart = new Date(Date.now() - days * DAY);
  const prevStart = new Date(Date.now() - 2 * days * DAY);
  const rows = await prisma.searchMetric.findMany({
    where: { query: null, date: { gte: prevStart } },
    select: { locale: true, date: true, clicks: true, impressions: true, position: true },
  });
  const cur = new Map<Locale, MetricAgg>();
  const prev = new Map<Locale, MetricAgg>();
  for (const r of rows) {
    const bucket = r.date >= periodStart ? cur : prev;
    accumulate(bucket as any, r.locale, r.impressions, r.clicks, r.position);
  }
  const locales: Locale[] = ["en", "de", "pl", "ru"] as Locale[];
  return locales.map((locale) => {
    const c = cur.get(locale) ?? { impressions: 0, clicks: 0, posWeighted: 0 };
    const p = prev.get(locale) ?? { impressions: 0, clicks: 0, posWeighted: 0 };
    return {
      locale,
      clicks: c.clicks, clicksPrev: p.clicks,
      impressions: c.impressions, impressionsPrev: p.impressions,
      ctr: ctrPct(c), ctrPrev: ctrPct(p),
      position: avgPosition(c), positionPrev: avgPosition(p),
    };
  });
}

export type ClickDeltaRow = { locale: Locale; page: string; clicks: number; clicksPrev: number; delta: number };

export async function getClickDeltaMovers(days = ADVISOR_PERIOD_DAYS, limit = 15): Promise<{ winners: ClickDeltaRow[]; losers: ClickDeltaRow[] }> {
  const periodStart = new Date(Date.now() - days * DAY);
  const prevStart = new Date(Date.now() - 2 * days * DAY);
  const rows = await prisma.searchMetric.findMany({
    where: { query: null, date: { gte: prevStart } },
    select: { page: true, locale: true, date: true, clicks: true },
  });
  const cur = new Map<string, { locale: Locale; clicks: number }>();
  const prev = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.locale}::${r.page}`;
    if (r.date >= periodStart) {
      const e = cur.get(key) ?? { locale: r.locale, clicks: 0 };
      e.clicks += r.clicks;
      cur.set(key, e);
    } else {
      prev.set(key, (prev.get(key) ?? 0) + r.clicks);
    }
  }
  const rows2: ClickDeltaRow[] = Array.from(cur.entries()).map(([key, c]) => {
    const [, page] = key.split("::");
    const clicksPrev = prev.get(key) ?? 0;
    return { locale: c.locale, page, clicks: c.clicks, clicksPrev, delta: c.clicks - clicksPrev };
  });
  const winners = rows2.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, limit);
  const losers = rows2.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, limit);
  return { winners, losers };
}

export type StrikingDistanceRow = { locale: Locale; page: string; position: number; impressions: number; impressionsPrev: number };

// Pages currently ranking 15-30 (page 2-3 — visible enough to gain impressions,
// not yet earning much CTR) whose impressions are GROWING vs the prior period —
// a signal of rising relevance/demand where a modest push (internal links,
// content depth, a title tweak) could plausibly cross into page 1.
export async function getStrikingDistance(days = ADVISOR_PERIOD_DAYS): Promise<StrikingDistanceRow[]> {
  const periodStart = new Date(Date.now() - days * DAY);
  const prevStart = new Date(Date.now() - 2 * days * DAY);
  const rows = await prisma.searchMetric.findMany({
    where: { query: null, date: { gte: prevStart } },
    select: { page: true, locale: true, date: true, impressions: true, position: true },
  });
  const cur = new Map<string, MetricAgg & { locale: Locale }>();
  const prevImpr = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.locale}::${r.page}`;
    if (r.date >= periodStart) {
      const e = cur.get(key) ?? { locale: r.locale, impressions: 0, clicks: 0, posWeighted: 0 };
      e.impressions += r.impressions;
      e.posWeighted += r.position * r.impressions;
      cur.set(key, e);
    } else {
      prevImpr.set(key, (prevImpr.get(key) ?? 0) + r.impressions);
    }
  }
  const out: StrikingDistanceRow[] = [];
  for (const [key, c] of Array.from(cur)) {
    const [, page] = key.split("::");
    const position = avgPosition(c);
    if (position < 15 || position > 30) continue;
    const impressionsPrev = prevImpr.get(key) ?? 0;
    if (c.impressions <= impressionsPrev) continue; // must be gaining
    out.push({ locale: c.locale, page, position, impressions: c.impressions, impressionsPrev });
  }
  return out.sort((a, b) => b.impressions - a.impressions);
}
