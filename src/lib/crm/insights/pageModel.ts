// Pure helpers for the /crm/insights page (CRM v2 phase 4a, Task 3): period from the URL,
// display formatting, the monthly bar chart geometry and the partner-table sort.
// No DB, no React, so node:test covers all of it.
import { PERIOD_PRESETS, resolvePeriod, type PeriodPreset, type ResolvedPeriod } from "./period";
import type { OutlookMonth } from "./outlook";
import type { PartnerQualityRow } from "./partnerQuality";

// ── Period ──────────────────────────────────────────────────────────────

export const DEFAULT_PERIOD_PRESET = "last_3_months" satisfies PeriodPreset;

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  this_month: "This month",
  last_3_months: "Last 3 months",
  this_year: "This year",
  last_12_months: "Last 12 months",
  custom: "Custom",
};

type SearchParams = Record<string, string | string[] | undefined> | undefined;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/**
 * Period from the page's searchParams (`preset`, plus `from`/`to` for custom, "YYYY-MM-DD").
 * Missing or unknown preset → last 3 months. A custom range that does not parse, or ends
 * before it starts, also falls back to last 3 months and is flagged `invalid` so the page can say so.
 */
export function periodFromSearchParams(sp: SearchParams, now: Date): ResolvedPeriod & { invalid: boolean } {
  const preset = one(sp?.preset);
  const fallback = () => resolvePeriod({ preset: DEFAULT_PERIOD_PRESET, now });
  if (!preset || !(PERIOD_PRESETS as readonly string[]).includes(preset)) {
    return { ...fallback(), invalid: !!preset };
  }
  const p = resolvePeriod({ preset, from: one(sp?.from), to: one(sp?.to), now });
  // resolvePeriod answers a bad custom range with this_month; the page wants the default instead.
  if (preset === "custom" && p.preset !== "custom") return { ...fallback(), invalid: true };
  return { ...p, invalid: false };
}

/** Query string for a preset link (custom keeps its dates). */
export function periodHref(preset: PeriodPreset, range?: { from: string; to: string }): string {
  if (preset === "custom" && range) return `/crm/insights?preset=custom&from=${range.from}&to=${range.to}`;
  return `/crm/insights?preset=${preset}`;
}

// ── Formatting ──────────────────────────────────────────────────────────

/** Whole euros, "€ 12,345". */
export function eur(n: number): string {
  const v = Math.round(n);
  return `${v < 0 ? "−" : ""}€ ${Math.abs(v).toLocaleString("en-US")}`;
}

/** Axis ticks: "€ 0", "€ 500", "€ 25k", "€ 1.5M". */
export function eurCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `€ ${trim(n / 1_000_000)}M`;
  if (a >= 1_000) return `€ ${trim(n / 1_000)}k`;
  return `€ ${Math.round(n)}`;
}
const trim = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });

/** "—" for null, else "12.5 %". */
export const pctText = (v: number | null): string => (v === null ? "—" : `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })} %`);

/** Minutes as "45 min" / "3.5 h" / "2.5 d"; "—" for null. */
export function durationText(min: number | null): string {
  if (min === null) return "—";
  if (min < 90) return `${Math.max(0, Math.round(min))} min`;
  if (min < 48 * 60) return `${trim(min / 60)} h`;
  return `${trim(min / 1440)} d`;
}

/** "CONTACT_FORM" → "Contact form"; partner splits keep their mode. */
export function channelLabel(source: string, partnerMode: string | null): string {
  const base = source.charAt(0) + source.slice(1).toLowerCase().replace(/_/g, " ");
  if (source === "PARTNER" && partnerMode === "HANDOVER") return `${base} · Handover`;
  if (source === "PARTNER" && partnerMode === "FIX") return `${base} · Fix`;
  return base;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-03" → "Mar 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1] ?? "?"} ${y}`;
}

// ── Chart geometry (monthly grouped bars) ──────────────────────────────

/** A "nice" axis: max rounded up to 1/2/2.5/5 × 10^k steps; zero data → a 0..1 axis with one tick. */
export function niceScale(maxValue: number, tickCount = 4): { max: number; step: number; ticks: number[] } {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return { max: 0, step: 0, ticks: [0] };
  const raw = maxValue / tickCount;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? 10 * mag);
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 1e6; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { max, step, ticks };
}

export type BarSegment = { x: number; y: number; width: number; height: number; value: number; top: boolean };
export type MonthBar = { month: string; label: string; showYear: boolean; cx: number; earned: BarSegment | null; developerPaid: BarSegment | null; total: number; earnedValue: number; developerPaidValue: number; band: { x: number; width: number } };
export type MonthChart = {
  width: number; height: number;
  plot: { left: number; right: number; top: number; bottom: number };
  ticks: { value: number; y: number; label: string }[];
  bars: MonthBar[];
  empty: boolean;
};

export const CHART_DIMENSIONS = { width: 720, height: 260, left: 64, right: 12, top: 16, bottom: 44, barWidth: 24, gap: 2 } as const;

/**
 * Grouped columns: earned and developer paid side by side per month, both from the baseline, a
 * `gap` between them. Each bar is capped at `barWidth`, the pair is centred in its band, and the
 * scale comes from the tallest single value. Zero values are null (no sliver); every drawn bar
 * has the rounded data end (`top`). All-zero data -> `empty`.
 */
export function monthChartGeometry(months: OutlookMonth[], dims: { width: number; height: number; left: number; right: number; top: number; bottom: number; barWidth: number; gap: number } = CHART_DIMENSIONS): MonthChart {
  const plot = { left: dims.left, right: dims.width - dims.right, top: dims.top, bottom: dims.height - dims.bottom };
  const plotH = plot.bottom - plot.top;
  const peaks = months.map((m) => Math.max(Math.max(0, m.earned), Math.max(0, m.developerPaid)));
  const scale = niceScale(Math.max(0, ...peaks));
  const yOf = (v: number) => (scale.max > 0 ? plot.bottom - (v / scale.max) * plotH : plot.bottom);
  const bandW = months.length > 0 ? (plot.right - plot.left) / months.length : 0;
  const barW = Math.min(dims.barWidth, Math.max(0, (bandW - 8 - dims.gap) / 2));

  const bars = months.map((m, i): MonthBar => {
    const bandX = plot.left + i * bandW;
    const cx = bandX + bandW / 2;
    const e = Math.max(0, m.earned);
    const d = Math.max(0, m.developerPaid);
    const eH = scale.max > 0 ? (e / scale.max) * plotH : 0;
    const dH = scale.max > 0 ? (d / scale.max) * plotH : 0;
    const earned: BarSegment | null = e > 0 && eH > 0 ? { x: cx - dims.gap / 2 - barW, y: plot.bottom - eH, width: barW, height: eH, value: e, top: true } : null;
    const developerPaid: BarSegment | null = d > 0 && dH > 0 ? { x: cx + dims.gap / 2, y: plot.bottom - dH, width: barW, height: dH, value: d, top: true } : null;
    const [, mo] = m.month.split("-").map(Number);
    return {
      month: m.month, label: MONTHS[mo - 1] ?? "?", showYear: i === 0 || mo === 1, cx,
      earned, developerPaid, total: e + d, earnedValue: e, developerPaidValue: d, band: { x: bandX, width: bandW },
    };
  });

  return {
    width: dims.width, height: dims.height, plot,
    ticks: scale.ticks.map((v) => ({ value: v, y: yOf(v), label: eurCompact(v) })),
    bars,
    empty: peaks.every((t) => t === 0),
  };
}

/** SVG path for a column with rounded top corners (data end) and a square base. */
export function columnPath(s: { x: number; y: number; width: number; height: number }, rounded: boolean, radius = 4): string {
  const r = rounded ? Math.max(0, Math.min(radius, s.width / 2, s.height)) : 0;
  const { x, y, width: w, height: h } = s;
  const f = (n: number) => Math.round(n * 100) / 100;
  if (r === 0) return `M${f(x)},${f(y + h)}V${f(y)}H${f(x + w)}V${f(y + h)}Z`;
  return `M${f(x)},${f(y + h)}V${f(y + r)}Q${f(x)},${f(y)} ${f(x + r)},${f(y)}H${f(x + w - r)}Q${f(x + w)},${f(y)} ${f(x + w)},${f(y + r)}V${f(y + h)}Z`;
}

/** Inline won-rate bar width in %, relative to the best channel shown (0 when nobody won). */
export function relativeBarPct(value: number | null, max: number): number {
  if (value === null || !(max > 0) || value <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 1000) / 10);
}

// ── Partner table sort ─────────────────────────────────────────────────

export const PARTNER_SORT_KEYS = [
  "name", "submitted", "accepted", "inReview", "rejected", "valid", "reachedViewing", "closed", "conversionPct", "medianResponseMin",
] as const;
export type PartnerSortKey = (typeof PARTNER_SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

/** First click on a column: names A→Z, response time fastest first, every count highest first. */
export function defaultSortDir(key: PartnerSortKey): SortDir {
  return key === "name" || key === "medianResponseMin" ? "asc" : "desc";
}

/**
 * Comparator for the partner quality table. Empty values (no conversion / no response yet) always
 * sort last, whichever the direction; ties fall back to the name A→Z so the order is stable.
 */
export function comparePartnerRows(key: PartnerSortKey, dir: SortDir): (a: PartnerQualityRow, b: PartnerQualityRow) => number {
  const sign = dir === "asc" ? 1 : -1;
  return (a, b) => {
    const byName = a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.partnerId.localeCompare(b.partnerId);
    if (key === "name") return sign * byName;
    const va = a[key];
    const vb = b[key];
    if (va === null && vb === null) return byName;
    if (va === null) return 1;
    if (vb === null) return -1;
    return sign * (va - vb) || byName;
  };
}
