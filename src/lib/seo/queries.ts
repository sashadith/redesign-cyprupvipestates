import { prisma } from "@/lib/prisma";
import type { Locale } from "@prisma/client";
import { pagesInSuppressionWindow } from "./titleSweepLog";
import { REMEASURE_WINDOW_DAYS } from "./titleSweepRemeasure";

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
