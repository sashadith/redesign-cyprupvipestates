import { prisma } from "@/lib/prisma";
import { isGscConfigured } from "@/lib/gsc/client";
import { getPerLocaleTrend, getWeekOverWeekMovers, getCtrWatchlist, getCwvFailingByClass, CTR_WINDOW_DAYS } from "@/lib/seo/queries";
import { computeTitleSweepComparison, sweepVerdictLine, isoDay } from "@/lib/seo/titleSweepRemeasure";
import SeoSparkline from "./SeoSparkline";

export const dynamic = "force-dynamic";

const LOCALE_LABEL: Record<string, string> = { en: "English", de: "German", pl: "Polish", ru: "Russian" };
const SITE_URL = "https://cyprusvipestates.com";

function gscConsoleUrl(): string | null {
  const property = process.env.GSC_SITE_PROPERTY;
  return property ? `https://search.google.com/search-console/performance/search-analytics?resource_id=${encodeURIComponent(property)}` : null;
}

const Card = ({ children, id, className = "" }: { children: React.ReactNode; id?: string; className?: string }) => (
  <div id={id} className={`bg-white rounded-lg border border-[#E5E7EB] p-5 ${className}`}>{children}</div>
);

const LocaleBadge = ({ locale }: { locale: string }) => (
  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{locale}</span>
);

export default async function SeoAnalyticsPage() {
  const configured = isGscConfigured();
  const totalRows = configured ? await prisma.searchMetric.count() : 0;

  if (!configured) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-6">SEO</h1>
        <Card>
          <h2 className="text-sm font-semibold mb-2">Google Search Console not configured</h2>
          <p className="text-sm text-[#6B7280] max-w-prose">
            Set <code className="bg-[#F3F4F6] px-1 rounded">GSC_SERVICE_ACCOUNT_KEY_PATH</code> and{" "}
            <code className="bg-[#F3F4F6] px-1 rounded">GSC_SITE_PROPERTY</code> in the environment, then the daily{" "}
            <code className="bg-[#F3F4F6] px-1 rounded">gsc-sync</code> cron will backfill 90 days of data automatically on its first run.
          </p>
        </Card>
      </div>
    );
  }

  if (totalRows === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-6">SEO</h1>
        <Card>
          <h2 className="text-sm font-semibold mb-2">Waiting for first sync</h2>
          <p className="text-sm text-[#6B7280]">GSC is configured but no data has been synced yet — the next <code className="bg-[#F3F4F6] px-1 rounded">gsc-sync</code> cron run (05:30 daily) will backfill the last 90 days.</p>
        </Card>
      </div>
    );
  }

  const [trends, movers, watchlist, sweeps, cwvClassesAll] = await Promise.all([
    getPerLocaleTrend(90),
    getWeekOverWeekMovers(),
    getCtrWatchlist(),
    computeTitleSweepComparison(),
    getCwvFailingByClass(),
  ]);
  // getCwvFailingByClass now also reports classes with zero current
  // failures (needed for the Advisor's total-tracked denominator) — this
  // panel only ever showed classes that are actually failing.
  const cwvClasses = cwvClassesAll.filter((c) => c.failingUrls.length > 0);
  const gscUrl = gscConsoleUrl();

  const MoverRow = ({ m, direction }: { m: (typeof movers.up)[number]; direction: "up" | "down" }) => (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <LocaleBadge locale={m.locale} />
        <a href={`${SITE_URL}${m.page}`} target="_blank" rel="noreferrer" className="truncate text-[#374151] hover:text-[#1B4B43] hover:underline" title={m.page}>
          {m.page}
        </a>
      </div>
      <span className={`tabular-nums shrink-0 font-medium ${direction === "up" ? "text-[#1B4B43]" : "text-[#B3261E]"}`}>
        {m.priorPosition.toFixed(1)} → {m.currentPosition.toFixed(1)}
      </span>
    </li>
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold">SEO</h1>
        {gscUrl && (
          <a href={gscUrl} target="_blank" rel="noreferrer" className="text-sm text-[#1B4B43] hover:underline">
            Open in Search Console ↗
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {trends.map((t) => {
          const totalImpr = t.series.reduce((s, p) => s + p.impressions, 0);
          const totalClicks = t.series.reduce((s, p) => s + p.clicks, 0);
          return (
            <Card key={t.locale}>
              <div className="flex items-baseline justify-between mb-1">
                <h2 className="text-sm font-semibold">{LOCALE_LABEL[t.locale] ?? t.locale}</h2>
                <span className="text-xs text-[#6B7280] tabular-nums">
                  {totalImpr.toLocaleString("en-GB")} impr · {totalClicks.toLocaleString("en-GB")} clicks (90d)
                </span>
              </div>
              <SeoSparkline series={t.series} />
            </Card>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card>
          <h2 className="text-sm font-semibold mb-3">Improved this week</h2>
          {movers.up.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No pages improved position this week (≥20 impressions).</p>
          ) : (
            <ul className="divide-y divide-[#F3F4F6]">{movers.up.slice(0, 10).map((m) => <MoverRow key={`${m.locale}:${m.page}`} m={m} direction="up" />)}</ul>
          )}
        </Card>
        <Card>
          <h2 className="text-sm font-semibold mb-3">Dropped this week</h2>
          {movers.down.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No pages dropped position this week (≥20 impressions).</p>
          ) : (
            <ul className="divide-y divide-[#F3F4F6]">{movers.down.slice(0, 10).map((m) => <MoverRow key={`${m.locale}:${m.page}`} m={m} direction="down" />)}</ul>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold">CTR watchlist</h2>
          <span className="text-xs text-[#6B7280]">Position ≤10, CTR &lt;1.5% (or ≤20, CTR &lt;0.8%), ≥200 impressions, last {CTR_WINDOW_DAYS}d</span>
        </div>
        {watchlist.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No pages currently match the CTR-outlier criteria.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#6B7280] uppercase tracking-wide">
                  <th className="pb-2 font-semibold">Page</th>
                  <th className="pb-2 font-semibold text-right">Impressions</th>
                  <th className="pb-2 font-semibold text-right">Position</th>
                  <th className="pb-2 font-semibold text-right">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {watchlist.map((row) => (
                  <tr key={`${row.locale}:${row.page}`}>
                    <td className="py-1.5 pr-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <LocaleBadge locale={row.locale} />
                        <a href={`${SITE_URL}${row.page}`} target="_blank" rel="noreferrer" className="truncate text-[#374151] hover:text-[#1B4B43] hover:underline" title={row.page}>
                          {row.page}
                        </a>
                      </div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{row.impressions.toLocaleString("en-GB")}</td>
                    <td className="py-1.5 text-right tabular-nums">{row.position.toFixed(1)}</td>
                    <td className="py-1.5 text-right tabular-nums text-[#B3261E]">{row.ctr.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold">Core Web Vitals</h2>
          <span className="text-xs text-[#6B7280]">LCP &gt;3.5s, CLS &gt;0.15, or INP &gt;350ms, sustained 3 consecutive nightly checks</span>
        </div>
        {cwvClasses.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No template class currently has sustained Core Web Vitals failures.</p>
        ) : (
          <ul className="divide-y divide-[#F3F4F6]">
            {cwvClasses.map((c) => (
              <li key={c.templateClass} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#111827] capitalize">{c.label}</span>
                  <span className="text-[#B3261E] text-xs font-semibold uppercase tracking-wide">{c.failingMetrics.join(", ")}</span>
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {c.failingUrls.length} page{c.failingUrls.length === 1 ? "" : "s"} affected — e.g.{" "}
                  <a href={`${SITE_URL}${c.failingUrls[0]}`} target="_blank" rel="noreferrer" className="hover:text-[#1B4B43] hover:underline">{c.failingUrls[0]}</a>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card id="title-sweep">
        <h2 className="text-sm font-semibold mb-3">Title-sweep measurement status</h2>
        {sweeps.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No sweep log found (docs/SEO-TITLE-SWEEP-LOG.md).</p>
        ) : (
          <div className="space-y-6 divide-y divide-[#F3F4F6]">
            {sweeps.map((sweep) => (
              <div key={sweep.batchDate.toISOString()} className={sweeps.length > 1 ? "pt-6 first:pt-0" : ""}>
                <div className="text-sm text-[#374151]">
                  <p className="mb-1">
                    <span className="font-semibold text-[#1B4B43]">{sweep.improvedCount}/{sweep.measuredCount}</span> measured pages improved CTR
                    {sweep.avgCtrDeltaPp != null && (
                      <span className="text-[#6B7280]"> (avg {sweep.avgCtrDeltaPp >= 0 ? "+" : ""}{sweep.avgCtrDeltaPp.toFixed(2)}pp)</span>
                    )}
                    {sweep.control?.perPage.improvedShare != null && sweep.control.perPage.avgCtrDeltaPp != null && (
                      <span className="text-[#6B7280]">
                        {" "}· comparable unswept pages: {(sweep.control.perPage.improvedShare * 100).toFixed(0)}% improved (avg{" "}
                        {sweep.control.perPage.avgCtrDeltaPp >= 0 ? "+" : ""}{sweep.control.perPage.avgCtrDeltaPp.toFixed(2)}pp, {sweep.control.perPage.pages} pages
                        {" "}≥{sweep.control.perPage.minImpressions} impressions)
                      </span>
                    )}
                  </p>
                  {/* The verdict line is not decoration: improvedCount and
                      avgCtrDeltaPp on their own read as a verdict on the sweep
                      when they are largely a verdict on the season. It carries
                      the control, the position shift and the power. */}
                  <p className="text-sm text-[#374151] mb-1">{sweepVerdictLine(sweep)}</p>
                  <p className="text-xs text-[#6B7280]">
                    Batch from {isoDay(sweep.batchDate)}, measured {sweep.daysElapsed} days later.{" "}
                    {sweep.baselineWindow && sweep.currentWindow ? (
                      <>
                        Baseline {isoDay(sweep.baselineWindow.from)}–{isoDay(sweep.baselineWindow.to)} vs current{" "}
                        {isoDay(sweep.currentWindow.from)}–{isoDay(sweep.currentWindow.to)}, {sweep.currentWindow.days} days each, computed from Search
                        Console with both URL variants pooled.{" "}
                      </>
                    ) : (
                      <>No Search Console data covering this batch yet. </>
                    )}
                    {sweep.rows.length - sweep.measuredCount} of {sweep.rows.length} pages had no data in one of the two windows.{" "}
                    {/* isDue still means the same thing it always did — 42 days,
                        and it is still what fires the Action Center item and the
                        Telegram push. The figures are simply shown before then
                        rather than withheld: they are now a like-for-like
                        comparison rather than a 3-month average against a
                        28-day one, and a provisional number the team can watch
                        beats a blank card until the day it flips. */}
                    {sweep.isDue
                      ? "Re-measurement window closed " + isoDay(sweep.dueDate) + "."
                      : "Provisional — re-measurement due " + isoDay(sweep.dueDate) + " (" + Math.max(0, Math.ceil((sweep.dueDate.getTime() - Date.now()) / 86_400_000)) + " days)."}
                  </p>
                </div>
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[#6B7280] border-b border-[#F3F4F6]">
                        <th className="py-1.5 pr-3 font-medium">Page</th>
                        {/* Kept, never overwritten: this is what was on the
                            screen when the rewrite was approved. Where the two
                            baselines disagree the computed one is the
                            comparison and this one is the provenance. */}
                        <th className="py-1.5 px-3 font-medium whitespace-nowrap">Logged baseline (3-mo)</th>
                        <th className="py-1.5 px-3 font-medium whitespace-nowrap">Computed baseline</th>
                        <th className="py-1.5 pl-3 font-medium whitespace-nowrap">Current</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {sweep.rows.map((r) => (
                        <tr key={`${r.locale}:${r.page}`}>
                          <td className="py-1.5 pr-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <LocaleBadge locale={r.locale} />
                              <a href={`${SITE_URL}${r.page}`} target="_blank" rel="noreferrer" className="truncate text-[#374151] hover:text-[#1B4B43] hover:underline" title={r.page}>
                                {r.page}
                              </a>
                            </div>
                          </td>
                          <td className="py-1.5 px-3 tabular-nums text-[#6B7280] whitespace-nowrap">
                            {r.hasLoggedBaseline ? `#${r.baselinePosition?.toFixed(1)} · ${r.baselineCtr?.toFixed(2)}%` : "—"}
                          </td>
                          <td className="py-1.5 px-3 tabular-nums text-[#374151] whitespace-nowrap">
                            {r.hasBaseline ? `#${r.baselineComputedPosition!.toFixed(1)} · ${r.baselineComputedCtr!.toFixed(2)}% · ${r.baselineComputedImpressions!.toLocaleString("en-GB")} impr` : "no data"}
                          </td>
                          <td className="py-1.5 pl-3 tabular-nums text-[#374151] whitespace-nowrap">
                            {r.hasCurrentData ? `#${r.currentPosition!.toFixed(1)} · ${r.currentCtr!.toFixed(2)}% · ${r.currentImpressions!.toLocaleString("en-GB")} impr` : "no data"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
