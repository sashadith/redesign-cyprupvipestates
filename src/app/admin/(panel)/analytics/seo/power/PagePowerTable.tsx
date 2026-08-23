"use client";

import { useMemo, useState } from "react";
import { templateClassOf } from "@/lib/seo/templateClass";
import type { PageDiagnosis } from "@/lib/seo/pagePower/types";

/** Exactly the fields this table renders — deliberately narrower than
 *  `PageVerdict`. Every field crosses the RSC boundary 1,679 times: measured
 *  against production on 2026-08-23 the nine below serialise to 581KB, and
 *  carrying `clicks` and `templateClass` too — neither is displayed, and the
 *  by-class table under this one answers the template question — took it to
 *  658KB for nothing. Add a field here when a column shows it, not before. */
export type Row = {
  key: string;
  locale: string;
  /** As served, locale prefix included — see `PageKey` in pagePower/types.ts.
   *  English is prefix-less, de/pl/ru are not. */
  path: string;
  impressions: number;
  /** percent, 0–100 */
  ctr: number;
  position: number | null;
  diagnosis: PageDiagnosis;
  reason: string;
  impressionsTrendPct: number | null;
};

/** Keyed by `PageDiagnosis`, not by `string`, so a sixth diagnosis added to
 *  pagePower/types.ts fails the build here rather than silently producing a
 *  bucket of pages with no tab to reach it from. */
const DIAGNOSIS_LABEL: Record<PageDiagnosis, string> = {
  buried: "Buried",
  unclicked: "Unclicked",
  invisible: "Invisible",
  healthy: "Healthy",
  unjudged: "Not enough data",
};

/** Derived from the literal above rather than hand-written a second time:
 *  non-numeric string keys enumerate in insertion order, so that one literal is
 *  both the label table and the tab order and the two cannot drift. The order
 *  is triage order — the three diagnoses that name work to do, then the two
 *  that are only ever context. */
const TABS = Object.keys(DIAGNOSIS_LABEL) as PageDiagnosis[];

const SITE_URL = "https://cyprusvipestates.com";

const LocaleBadge = ({ locale }: { locale: string }) => (
  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded shrink-0">{locale}</span>
);

/** The four homepages render as `/`, `/de`, `/pl`, `/ru` — a bare slash is a
 *  four-pixel click target and reads as punctuation next to a 115-character
 *  blog path. Not hypothetical: `/` and `/de` are both in the buried pile
 *  today. `templateClassOf` rather than a second root-URL regex, so the set of
 *  paths that count as a homepage is defined in one place. */
const pathLabel = (path: string): string => (templateClassOf(path) === "homepage" ? `${path} (homepage)` : path);

export default function PagePowerTable({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<PageDiagnosis>("buried");

  const counts = useMemo(() => {
    const c = new Map<PageDiagnosis, number>();
    for (const r of rows) c.set(r.diagnosis, (c.get(r.diagnosis) ?? 0) + 1);
    return c;
  }, [rows]);

  const shown = useMemo(
    () =>
      rows
        .filter((r) => r.diagnosis === filter)
        // Tie-broken on path, not left to impressions alone: 618 pages have
        // zero impressions and `sort` is stable, so ties fall back to inventory
        // order — which comes from Prisma `findMany` calls with no `orderBy`,
        // i.e. whatever order Postgres happened to return. Without the
        // tie-break the 1,118-row `invisible` tab reshuffles between loads.
        .sort((a, b) => b.impressions - a.impressions || a.path.localeCompare(b.path)),
    [rows, filter],
  );

  return (
    <div>
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-4 flex-wrap">
        {TABS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setFilter(d)}
            className={`px-3 py-1.5 text-sm -mb-px border-b-2 ${filter === d ? "border-[#1B4B43] text-[#111827] font-medium" : "border-transparent text-[#6B7280] hover:text-[#111827]"}`}
          >
            {DIAGNOSIS_LABEL[d]} <span className="text-[#9CA3AF] tabular-nums">({counts.get(d) ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#6B7280] uppercase tracking-wide">
              <th className="pb-2 font-semibold">Page</th>
              <th className="pb-2 font-semibold text-right">Impressions</th>
              <th className="pb-2 font-semibold text-right" title="Impressions in the last 28 days against the 28 days before them">28d</th>
              <th className="pb-2 font-semibold text-right">CTR</th>
              <th className="pb-2 font-semibold text-right">Position</th>
              <th className="pb-2 font-semibold">Why</th>
            </tr>
          </thead>
          {/* Every matching row, uncapped. `invisible` is 1,118 rows today and
              renders in well under a second, while a cap would hide exactly
              what makes that pile worth opening — the handful of pages ranking
              on the first page of results whose reason says the demand is
              missing, not the indexing. The default tab is `buried` (78 rows),
              so the long list only renders when someone asks for it. */}
          <tbody className="divide-y divide-[#F3F4F6]">
            {shown.map((r) => (
              <tr key={r.key} className="align-top">
                <td className="py-2 pr-3">
                  <div className="flex items-baseline gap-2">
                    <LocaleBadge locale={r.locale} />
                    <a href={`${SITE_URL}${r.path}`} target="_blank" rel="noreferrer" className="text-[#374151] hover:text-[#1B4B43] hover:underline break-words" title={r.path}>
                      {pathLabel(r.path)}
                    </a>
                  </div>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.impressions.toLocaleString("en-GB")}</td>
                <td className={`py-2 pr-3 text-right tabular-nums ${r.impressionsTrendPct == null ? "text-[#9CA3AF]" : r.impressionsTrendPct >= 0 ? "text-[#1B4B43]" : "text-[#B3261E]"}`}>
                  {/* Null on 1,584 of 1,679 pages — the prior 28 days must clear
                      MIN_IMPRESSIONS_TREND before a percentage means anything,
                      and an invisible page never will. Empty is the honest
                      reading; see `impressionsTrendPct` in pagePower/types.ts. */}
                  {r.impressionsTrendPct == null ? "—" : `${r.impressionsTrendPct >= 0 ? "+" : ""}${r.impressionsTrendPct.toFixed(0)}%`}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.ctr.toFixed(2)}%</td>
                {/* Null exactly when the page drew no impressions (618 pages).
                    Rendering 0 there would read as "ranked first". */}
                <td className="py-2 pr-3 text-right tabular-nums">{r.position == null ? "—" : r.position.toFixed(1)}</td>
                <td className="py-2 text-[#6B7280]">{r.reason}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-[#9CA3AF]">No pages with this diagnosis.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
