import { prisma } from "@/lib/prisma";
import { isGscConfigured } from "@/lib/gsc/client";
import { getPerLocaleTrend, getWeekOverWeekMovers, getCtrWatchlist, CTR_WINDOW_DAYS } from "@/lib/seo/queries";
import { computeTitleSweepComparison } from "@/lib/seo/titleSweepRemeasure";
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

  const [trends, movers, watchlist, sweep] = await Promise.all([
    getPerLocaleTrend(90),
    getWeekOverWeekMovers(),
    getCtrWatchlist(),
    computeTitleSweepComparison(),
  ]);
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

      <Card id="title-sweep">
        <h2 className="text-sm font-semibold mb-3">Title-sweep measurement status</h2>
        {!sweep ? (
          <p className="text-sm text-[#6B7280]">No sweep log found (docs/SEO-TITLE-SWEEP-LOG.md).</p>
        ) : sweep.isDue ? (
          <div className="text-sm text-[#374151]">
            <p className="mb-1">
              <span className="font-semibold text-[#1B4B43]">{sweep.improvedCount}/{sweep.measuredCount}</span> measured pages improved CTR
              {sweep.avgCtrDeltaPp != null && (
                <span className="text-[#6B7280]"> (avg {sweep.avgCtrDeltaPp >= 0 ? "+" : ""}{sweep.avgCtrDeltaPp.toFixed(2)}pp)</span>
              )}
            </p>
            <p className="text-xs text-[#6B7280]">
              Batch from {sweep.batchDate.toISOString().slice(0, 10)}, measured {sweep.daysElapsed} days later ·{" "}
              {sweep.rows.length - sweep.measuredCount} of {sweep.rows.length} pages had no recorded baseline or no recent data — full detail in docs/SEO-TITLE-SWEEP-LOG.md.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#6B7280]">
            Batch from {sweep.batchDate.toISOString().slice(0, 10)} — re-measurement due {sweep.dueDate.toISOString().slice(0, 10)} ({Math.max(0, Math.ceil((sweep.dueDate.getTime() - Date.now()) / 86_400_000))} days remaining).
          </p>
        )}
      </Card>
    </div>
  );
}
