import type { ChannelRow } from "@/lib/crm/insights/channels";
import { channelLabel, durationText, eur, pctText, relativeBarPct } from "@/lib/crm/insights/pageModel";

// Channel comparison: a plain table; the won rate carries one inline bar (single hue, relative to
// the best channel shown) so the ranking reads at a glance while the number stays the source.
export function ChannelTable({ rows, truncated }: { rows: ChannelRow[]; truncated: boolean }) {
  const bestWon = Math.max(0, ...rows.map((r) => r.wonRate ?? 0));
  return (
    <section className="crm-in-section" aria-labelledby="crm-in-channels">
      <div className="crm-in-head">
        <h2 id="crm-in-channels">Channel performance</h2>
        <p className="crm-muted">Leads created in the period, by source (newsletter and trashed leads left out). Won rate = closed ÷ leads; the bar is relative to the best channel.</p>
      </div>
      {truncated && <p className="crm-notice">Only the newest 20,000 leads of the period are counted.</p>}
      {rows.length === 0 ? (
        <p className="crm-notice">No leads were created in this period.</p>
      ) : (
        <div className="crm-in-tablewrap">
          <table className="crm-in-table">
            <caption className="crm-in-sr">Channel performance for the selected period</caption>
            <thead>
              <tr>
                <th scope="col">Channel</th>
                <th scope="col" className="num">Leads</th>
                <th scope="col" className="num">Contacted</th>
                <th scope="col" className="num">Median first response</th>
                <th scope="col" className="num">Viewings</th>
                <th scope="col" className="num">Reserved + closed</th>
                <th scope="col">Won rate</th>
                <th scope="col" className="num">Earned commission</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{channelLabel(r.source, r.partnerMode)}</th>
                  <td className="num">{r.leads.toLocaleString("en-US")}</td>
                  <td className="num">
                    {pctText(r.contactedPct)} <span className="crm-muted">({r.contacted.toLocaleString("en-US")})</span>
                  </td>
                  <td className="num">{durationText(r.medianFirstResponseMin)}</td>
                  <td className="num">{r.viewings.toLocaleString("en-US")}</td>
                  <td className="num">{r.reservedOrClosed.toLocaleString("en-US")}</td>
                  <td>
                    <span className="crm-in-won">
                      <span className="crm-in-won-track" aria-hidden="true">
                        <span className="crm-in-won-bar" style={{ width: `${relativeBarPct(r.wonRate, bestWon)}%` }} />
                      </span>
                      <span className="crm-in-num">{pctText(r.wonRate)}</span>
                      <span className="crm-muted crm-in-num">({r.closed})</span>
                    </span>
                  </td>
                  <td className="num money">{eur(r.earnedCommission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
