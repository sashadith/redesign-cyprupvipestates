import { redirect } from "next/navigation";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { channelData, outlookData, partnerQualityData } from "@/lib/crm/insights/queries";
import { periodFromSearchParams, PERIOD_LABEL } from "@/lib/crm/insights/pageModel";
import { PeriodFilter } from "./PeriodFilter";
import { ChannelTable } from "./ChannelTable";
import { CommissionOutlookSection } from "./CommissionOutlook";
import { PartnerQualityTable } from "./PartnerQualityTable";

export const dynamic = "force-dynamic";

// Manager-only insights (CRM v2 phase 4a): aggregates across all leads, never lists lead contact data.
export default async function InsightsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const user = await requireCrmUser();
  if (!canAssignLeads(user)) redirect("/crm/today");

  const now = new Date();
  const period = periodFromSearchParams(searchParams, now);
  const [channels, outlook, partners] = await Promise.all([
    channelData(period),
    outlookData(now, period),
    partnerQualityData(period, now),
  ]);
  const rangeText = period.fromKey === period.toKey ? period.fromKey : `${period.fromKey} – ${period.toKey}`;

  return (
    <>
      <div className="crm-headrow">
        <div>
          <h1>Insights</h1>
          <p>Which channels and partners bring business, and where commission stands. Cyprus time.</p>
        </div>
      </div>
      <PeriodFilter period={period} />
      {period.invalid && <p className="crm-notice" role="status">That period could not be read, so the last 3 months are shown.</p>}
      <p className="crm-in-range crm-muted">
        {PERIOD_LABEL[period.preset]} · <span className="crm-in-num">{rangeText}</span>
      </p>
      <ChannelTable rows={channels.rows} truncated={channels.truncated} />
      <CommissionOutlookSection outlook={outlook} periodLabel={PERIOD_LABEL[period.preset].toLowerCase()} />
      <section className="crm-in-section" aria-labelledby="crm-in-partners">
        <div className="crm-in-head">
          <h2 id="crm-in-partners">Partner quality</h2>
          <p className="crm-muted">Claims submitted in the period, per active or suspended partner. Valid = accepted and not lost as unreachable or invalid.</p>
        </div>
        {partners.truncated && <p className="crm-notice">Only the first 500 partners or 20,000 claims are counted.</p>}
        <PartnerQualityTable rows={partners.rows} />
      </section>
    </>
  );
}
