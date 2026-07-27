import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { logCronRun } from "@/lib/cronLog";
import { loadSweepEntries, type SweepEntry } from "./titleSweepLog";

// How long after a sweep batch ships before we auto-generate its before/after
// comparison — matches the 4-6 week re-measurement window called out in
// docs/SEO-TITLE-SWEEP-LOG.md itself (2026-08-15 to 2026-08-29, i.e. ~28-42
// days after the 2026-07-18 batch). We use the outer edge, 42 days, so the
// comparison isn't computed on noisy, too-early data.
export const REMEASURE_WINDOW_DAYS = 42;
const METRIC_WINDOW_DAYS = 28; // "current" CTR/position = trailing 28-day average
const DAY = 86_400_000;
const TELEGRAM_JOB_KEY = "seo-title-sweep-telegram";

export type SweepComparisonRow = SweepEntry & {
  currentPosition?: number;
  currentCtr?: number;
  hasBaseline: boolean;
  hasCurrentData: boolean;
};

export type SweepComparison = {
  batchDate: Date;
  dueDate: Date;
  isDue: boolean;
  daysElapsed: number;
  rows: SweepComparisonRow[];
  improvedCount: number;
  measuredCount: number;
  avgCtrDeltaPp: number | null;
};

// Shared by: Action Center rule (d), the admin SEO view's "title-sweep
// measurement status" section, and the one-time Telegram push below — one
// computation, three consumers.
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

  const since = new Date(Date.now() - METRIC_WINDOW_DAYS * DAY);
  const metricRows = await prisma.searchMetric.findMany({
    where: { query: null, date: { gte: since }, page: { in: entries.map((e) => e.page) } },
    select: { page: true, locale: true, clicks: true, impressions: true, position: true },
  });
  const agg = new Map<string, { impressions: number; clicks: number; posWeighted: number }>();
  for (const r of metricRows) {
    const key = `${r.locale}::${r.page}`;
    const a = agg.get(key) ?? { impressions: 0, clicks: 0, posWeighted: 0 };
    a.impressions += r.impressions;
    a.clicks += r.clicks;
    a.posWeighted += r.position * r.impressions;
    agg.set(key, a);
  }

  const batches = Array.from(byBatch.entries()).sort(([a], [b]) => a - b);
  return batches.map(([, batchEntries]) => {
    const batchDate = batchEntries[0].batchDate;
    const dueDate = new Date(batchDate.getTime() + REMEASURE_WINDOW_DAYS * DAY);
    const daysElapsed = Math.floor((Date.now() - batchDate.getTime()) / DAY);
    const isDue = Date.now() >= dueDate.getTime();

    const rows: SweepComparisonRow[] = batchEntries.map((e) => {
      const a = agg.get(`${e.locale}::${e.page}`);
      const hasCurrentData = !!a && a.impressions > 0;
      return {
        ...e,
        hasBaseline: e.baselineCtr != null,
        hasCurrentData,
        currentCtr: hasCurrentData ? (a!.clicks / a!.impressions) * 100 : undefined,
        currentPosition: hasCurrentData ? a!.posWeighted / a!.impressions : undefined,
      };
    });

    const measured = rows.filter((r) => r.hasBaseline && r.hasCurrentData);
    const improvedCount = measured.filter((r) => (r.currentCtr as number) > (r.baselineCtr as number)).length;
    const avgCtrDeltaPp = measured.length
      ? measured.reduce((sum, r) => sum + ((r.currentCtr as number) - (r.baselineCtr as number)), 0) / measured.length
      : null;

    return { batchDate, dueDate, isDue, daysElapsed, rows, improvedCount, measuredCount: measured.length, avgCtrDeltaPp };
  });
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

  for (const comparison of comparisons) {
    if (!comparison.isDue) continue;
    const jobKey = `${TELEGRAM_JOB_KEY}:${comparison.batchDate.toISOString().slice(0, 10)}`;
    const already = await prisma.cronRunLog.findFirst({ where: { job: jobKey, ok: true } });
    if (already) continue;

    const deltaLabel = comparison.avgCtrDeltaPp != null
      ? ` (avg ${comparison.avgCtrDeltaPp >= 0 ? "+" : ""}${comparison.avgCtrDeltaPp.toFixed(2)}pp)`
      : "";
    const text = [
      "<b>📈 Title-Sweep Re-Measurement Ready</b>",
      "",
      `Batch from ${comparison.batchDate.toISOString().slice(0, 10)}, measured ${comparison.daysElapsed} days later.`,
      `${comparison.improvedCount}/${comparison.measuredCount} pages improved CTR${deltaLabel}.`,
      "",
      `<a href="${siteUrl}/admin/analytics/seo">View full comparison</a>`,
    ].join("\n");

    await sendTelegramMessage(text);
    await logCronRun(jobKey, true, `sent: ${comparison.improvedCount}/${comparison.measuredCount} improved`);
    sent++;
  }

  return { sent };
}
