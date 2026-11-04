import Link from "next/link";
import type { ResolvedPeriod } from "@/lib/crm/insights/period";
import { PERIOD_LABEL, periodHref } from "@/lib/crm/insights/pageModel";

const PRESETS = ["this_month", "last_3_months", "this_year", "last_12_months"] as const;

// Server-rendered: preset links plus a plain GET form for a custom range (no client JS needed).
export function PeriodFilter({ period }: { period: ResolvedPeriod }) {
  return (
    <div className="crm-in-filter">
      <nav className="crm-in-presets" aria-label="Period">
        {PRESETS.map((p) => (
          <Link key={p} href={periodHref(p)} className={`crm-chip${period.preset === p ? " on" : ""}`} aria-current={period.preset === p ? "page" : undefined}>
            {PERIOD_LABEL[p]}
          </Link>
        ))}
      </nav>
      <form className="crm-in-custom" method="get" action="/crm/insights">
        <input type="hidden" name="preset" value="custom" />
        <label>
          <span>From</span>
          <input type="date" name="from" defaultValue={period.fromKey} required />
        </label>
        <label>
          <span>To</span>
          <input type="date" name="to" defaultValue={period.toKey} required />
        </label>
        <button type="submit" className={`crm-btn${period.preset === "custom" ? " primary" : ""}`}>Apply</button>
      </form>
    </div>
  );
}
