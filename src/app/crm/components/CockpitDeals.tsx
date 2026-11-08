"use client";
import { COMMISSION_LABEL, CreditNoteLink, DealDates, RATE_SOURCE_LABEL, StageButtons, useStageSetter, type DealRow } from "./DealsTable";
import { useToast } from "./Toast";
import { NewDealButton } from "./NewDealButton";

// Deals of one lead on the cockpit (CRM v2, 2026-10-18). Numbers are the ones
// stored on the deal (commission.ts computed them); managers get the same
// payout buttons as on the Commissions screen.

const eur = (n: number) => "€" + n.toLocaleString("en-US");

export function CockpitDeals({ deals, canPayout, today, newDeal }: {
  deals: DealRow[]; canPayout: boolean; today: string;
  /** Set when the viewer may add a deal by hand (admins and the lead's owner). */
  newDeal?: { leadId: string; leadName: string; status: string } | null;
}) {
  const toast = useToast();
  const onSet = useStageSetter(toast);
  return (
    <section className="crm-panel crm-ck-deals" aria-labelledby="crm-ck-deals-h">
      <div className="crm-ck-sechead">
        <h2 id="crm-ck-deals-h">Deals</h2>
        {newDeal && <NewDealButton {...newDeal} onDone={(m, warn) => toast.show(m, warn ? "error" : "ok")} />}
      </div>
      {deals.length === 0 ? (
        <p className="crm-muted">No deal yet. Add one with New deal, or move the lead to Reserved.</p>
      ) : (
        <ul>
          {deals.map((d) => (
            <li key={d.id} className={d.status === "CANCELLED" ? "cancelled" : undefined}>
              <div className="crm-ck-dealhead">
                <b>{d.project ?? "No project"}{d.typed?.project && <span className="crm-muted crm-ck-typed"> (typed)</span>}{d.unitLabel && <span className="crm-muted"> · {d.unitLabel}</span>}
                  {d.developer && <span className="crm-ck-dealdev">{d.developer}{d.typed?.developer && <span className="crm-muted"> (typed)</span>}</span>}</b>
                <span className={`crm-pill c-${d.status}`}>{COMMISSION_LABEL[d.status]}</span>
              </div>
              <dl className="crm-ck-dealnums">
                <div><dt>Price</dt><dd>{eur(d.price)}</dd></div>
                <div><dt>Our rate</dt><dd>{d.rateSource === "MISSING"
                  ? <span className="crm-warn">rate missing</span>
                  : <>{d.ourRatePercent != null ? `${d.ourRatePercent} % ` : ""}<span className="crm-muted">{RATE_SOURCE_LABEL[d.rateSource]}</span></>}</dd></div>
                <div><dt>Our commission</dt><dd>{d.ourCommission != null ? eur(d.ourCommission) : <span className="crm-muted">—</span>}</dd></div>
                <div><dt>Partner</dt><dd>{d.partnerCommission != null ? eur(d.partnerCommission) : <span className="crm-muted">—</span>}</dd></div>
              </dl>
              <DealDates d={d} />
              {canPayout
                ? <div className="crm-ck-payout"><StageButtons deal={d} today={today} onSet={onSet} /></div>
                : d.creditNote && <div className="crm-ck-payout"><CreditNoteLink deal={d} /></div>}
            </li>
          ))}
        </ul>
      )}
      {toast.node}
    </section>
  );
}
