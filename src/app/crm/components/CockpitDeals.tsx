"use client";
import { COMMISSION_LABEL, CreditNoteLink, DealDates, RATE_SOURCE_LABEL, StageButtons, useStageSetter, type DealRow } from "./DealsTable";
import { useToast } from "./Toast";

// Deals of one lead on the cockpit (CRM v2, 2026-10-18). Numbers are the ones
// stored on the deal (commission.ts computed them); managers get the same
// payout buttons as on the Commissions screen.

const eur = (n: number) => "€" + n.toLocaleString("en-US");

export function CockpitDeals({ deals, canPayout, today }: { deals: DealRow[]; canPayout: boolean; today: string }) {
  const toast = useToast();
  const onSet = useStageSetter(toast);
  return (
    <section className="crm-panel crm-ck-deals" aria-labelledby="crm-ck-deals-h">
      <h2 id="crm-ck-deals-h">Deals</h2>
      {deals.length === 0 ? (
        <p className="crm-muted">No deal yet. Moving the lead to Reserved asks for one.</p>
      ) : (
        <ul>
          {deals.map((d) => (
            <li key={d.id} className={d.status === "CANCELLED" ? "cancelled" : undefined}>
              <div className="crm-ck-dealhead">
                <b>{d.project ?? "No project"}{d.unitLabel && <span className="crm-muted"> · {d.unitLabel}</span>}</b>
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
