import Link from "next/link";
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts, classWindow } from "@/lib/seo/pagePower/classVerdicts";
import { templateClassLabel } from "@/lib/seo/templateClass";
import { COMPARISON_PROJECT_PAGES, type ClassDiagnosis } from "@/lib/seo/pagePower/types";
import PagePowerTable, { type Row } from "./PagePowerTable";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-lg border border-[#E5E7EB] p-5 ${className}`}>{children}</div>
);

/** The class verdict is the point of the table below it, so it is shown rather
 *  than left for the reader to infer from the reason sentence. Exhaustive over
 *  `ClassDiagnosis` for the same reason `DIAGNOSIS_LABEL` is in the table
 *  component: a new diagnosis must not render as unstyled text. */
const CLASS_DIAGNOSIS_COLOR: Record<ClassDiagnosis, string> = {
  repelling: "text-[#B3261E]",
  mute: "text-[#B3261E]",
  healthy: "text-[#1B4B43]",
  unjudged: "text-[#9CA3AF]",
};

const day = (d: Date): string => d.toISOString().slice(0, 10);

export default async function PagePowerPage() {
  // One `now` for both layers. Two `new Date()` calls either side of a slow
  // query can straddle UTC midnight, and this page would then print two windows
  // derived from two different "todays" — the one mismatch a reader has no way
  // to spot.
  const now = new Date();
  const [pages, classes] = await Promise.all([getPageVerdicts(now), getClassVerdicts(now)]);
  const classSpan = classWindow(now);

  // Only the fields the table renders — see the `Row` comment in
  // PagePowerTable.tsx for why this is not a spread of the verdict.
  const rows: Row[] = pages.verdicts.map((v) => ({
    key: v.key,
    locale: String(v.locale),
    path: v.path,
    impressions: v.impressions,
    ctr: v.ctr,
    position: v.position,
    diagnosis: v.diagnosis,
    reason: v.reason,
    impressionsTrendPct: v.impressionsTrendPct,
  }));

  // `windowEnd` is EXCLUSIVE — the first day the window does NOT cover — so
  // printing it would name a date whose data is not in any number on this page
  // (2026-08-21 for a window ending 2026-08-20). Its doc comment in
  // pagePower/pageVerdicts.ts says display code must subtract a day; this is
  // that code. DAY is exact here because both bounds are UTC midnights.
  const lastCoveredDay = new Date(pages.windowEnd.getTime() - DAY);
  // The by-class card runs on PageView and Lead, which have no ingestion lag, so
  // `getClassVerdicts` does not hold back the GSC_LAG_DAYS the page layer must —
  // its window ends three days later than the one in the header above. Until
  // 2026-08-23 this card printed no window of its own and inherited that header,
  // naming a span its own numbers do not cover. Both are dated for the same
  // reason `classVerdicts.ts` gives: say which source a number came from before
  // comparing them.
  const classLastCoveredDay = new Date(classSpan.windowEnd.getTime() - DAY);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Page Power</h1>
          <p className="text-sm text-[#6B7280] mt-1 max-w-prose">
            One diagnosis per page over {day(pages.windowStart)} to {day(lastCoveredDay)}. Coverage{" "}
            {pages.coveragePct.toFixed(1)}% of search clicks — below 85% means redirects the canonical map has not
            learned.
          </p>
        </div>
        <Link href="/admin/analytics/seo" className="text-sm text-[#1B4B43] hover:underline shrink-0">← Back to SEO</Link>
      </div>

      <Card className="mb-6">
        <PagePowerTable rows={rows} />
      </Card>

      <Card>
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-semibold">By template class</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Site visits and enquiries over {day(classSpan.windowStart)} to {day(classLastCoveredDay)} — a different
              window from the one above, which waits for Google to finish reporting.
            </p>
          </div>
          {/* Both columns are routinely misread, and both misreadings are
              recorded on `ClassVerdict` in pagePower/types.ts: "onward" counts
              only properties OTHER than the one the session landed on (so every
              class is measured at the same funnel step), and the enquiry count
              is only those whose form page resolves to this class — measured
              2026-08-23, 60 of 179 leads carry no recoverable page and appear
              in no class. A property here is a Development OR a legacy
              project page; both are counted, which they were not before
              2026-08-23. */}
          <span className="text-xs text-[#6B7280] text-right">
            Onward = entered here, then viewed {COMPARISON_PROJECT_PAGES}+ properties other than the landing page ·
            enquiries are only those whose form page resolves to this class
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#6B7280] uppercase tracking-wide">
                <th className="pb-2 font-semibold">Class</th>
                <th className="pb-2 font-semibold text-right">Entering</th>
                <th className="pb-2 font-semibold text-right">Onward {COMPARISON_PROJECT_PAGES}+</th>
                <th className="pb-2 font-semibold text-right">Rate</th>
                <th className="pb-2 font-semibold text-right">Traceable enquiries</th>
                <th className="pb-2 font-semibold">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {classes.map((c) => (
                <tr key={c.templateClass} className="align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-[#111827] capitalize">{templateClassLabel(c.templateClass)}</div>
                    <div className={`text-xs font-semibold uppercase tracking-wide ${CLASS_DIAGNOSIS_COLOR[c.diagnosis]}`}>{c.diagnosis}</div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.enteringSessions.toLocaleString("en-GB")}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.onwardComparisonSessions.toLocaleString("en-GB")}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.onwardComparisonRate.toFixed(1)}%</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.attributableLeads.toLocaleString("en-GB")}</td>
                  <td className="py-2 text-[#6B7280]">{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
