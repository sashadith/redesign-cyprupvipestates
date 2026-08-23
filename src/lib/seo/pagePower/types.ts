import type { Locale } from "@prisma/client";
import type { TemplateClass } from "@/lib/seo/templateClass";

// Every number here was measured against production on 2026-08-23 — see
// docs/superpowers/specs/2026-08-23-seo-page-power-design.md. Re-measure before
// changing one; they are not preferences.

/** 90 days. A 28-day window leaves only 46 pages above 300 impressions — too
 *  thin to judge CTR, where 90 days gives 129. Shorter is not faster, it is
 *  wronger. */
export const WINDOW_DAYS = 90;

/** GSC lags two to three days. Without excluding them, every page looks like it
 *  collapsed at the start of a month. */
export const GSC_LAG_DAYS = 3;

/** Feedback only — the trend arrow on the admin screen. Never a diagnosis and
 *  never an alert: actionCenter/rules/seo.ts already reports week-over-week
 *  ranking drops. */
export const TREND_WINDOW_DAYS = 28;

export const MIN_IMPRESSIONS_VISIBLE = 10;
export const MIN_IMPRESSIONS_BURIED = 100;

/** At 30 impressions and a ~1.3% expected CTR you cannot distinguish 0% from
 *  normal. A loose floor produced 166 "findings" that were mostly noise with
 *  decimal places; 300 produces 12 real ones. */
export const MIN_IMPRESSIONS_CTR = 300;

export const BURIED_POSITION = 20;
export const CTR_MEDIAN_FRACTION = 0.5;

/** Bucket medians come from this site's own pages. An industry curve would
 *  claim position 5 owes 6% and declare 200 pages broken. */
export const POSITION_BUCKETS: ReadonlyArray<readonly [number, number]> = [
  [0, 5],
  [5, 10],
  [10, 20],
];
export const MIN_BUCKET_PAGES = 5;
export const MIN_BUCKET_IMPRESSIONS = 100;

/** A comparison session views this many DIFFERENT project pages. Comparing two
 *  properties is what a buyer does; reading five articles is what a researcher
 *  does. */
export const COMPARISON_PROJECT_PAGES = 2;
export const MIN_ENTERING_SESSIONS = 100;
export const MIN_COMPARISON_SESSIONS = 50;
export const CLASS_RATE_FRACTION = 0.5;

export type PageDiagnosis = "invisible" | "buried" | "unclicked" | "healthy" | "unjudged";
export type ClassDiagnosis = "repelling" | "mute" | "healthy" | "unjudged";

/** `${locale}::${canonicalPath}` — the join key across GSC, PageView and Lead. */
export type PageKey = string;

export const pageKey = (locale: Locale, path: string): PageKey => `${locale}::${path}`;

export type PageVerdict = {
  key: PageKey;
  locale: Locale;
  path: string;
  templateClass: TemplateClass;
  impressions: number;
  clicks: number;
  /** percent, 0–100 */
  ctr: number;
  /** impression-weighted average; null when there are no impressions */
  position: number | null;
  diagnosis: PageDiagnosis;
  /** one sentence an admin can read without opening the code */
  reason: string;
  /** 28d vs the preceding 28d, for the admin trend arrow; null when unmeasurable */
  impressionsTrendPct: number | null;
};

export type ClassVerdict = {
  templateClass: TemplateClass;
  enteringSessions: number;
  comparisonSessions: number;
  /** percent of entering sessions that became comparison sessions */
  comparisonRate: number;
  leads: number;
  diagnosis: ClassDiagnosis;
  reason: string;
};
