"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setDealStageAction } from "../commissions/actions";
import { payoutActions, type PayoutAction } from "@/lib/crm/commissionActions";
import type { CommissionStatusValue } from "@/lib/crm/commission";
import { DEALS_SHOWN, withoutRateLabel, type StatusTotal } from "@/lib/crm/commissionTotals";
import { useToast } from "./Toast";

export type DealRow = {
  id: string; leadId: string; leadName: string; project: string | null; unitLabel: string | null;
  price: number; ourRatePercent: number | null; rateSource: "PROJECT" | "DEVELOPER" | "MANUAL" | "MISSING";
  ourCommission: number | null; partnerCommission: number | null; status: CommissionStatusValue;
  expectedAt: string | null; earnedAt: string | null; developerPaidAt: string | null; paidOutAt: string | null;
  /** Set once a partner payout issued a credit note. */
  creditNote?: { id: string; number: string } | null;
};
export type { StatusTotal };

const eur = (n: number) => "€" + n.toLocaleString("en-US");
export const COMMISSION_LABEL: Record<CommissionStatusValue, string> = {
  EXPECTED: "Expected", EARNED: "Earned", DEVELOPER_PAID: "Developer paid", PAID_OUT: "Paid out", CANCELLED: "Cancelled",
};
const ACTION_LABEL: Record<PayoutAction, string> = { DEVELOPER_PAID: "Developer paid", PAID_OUT: "Paid out", CANCELLED: "Cancel" };
const ACTION_QUESTION: Record<PayoutAction, string> = {
  DEVELOPER_PAID: "Developer paid us on",
  PAID_OUT: "Commission paid out on",
  CANCELLED: "Cancel this deal's commission as of",
};
export const RATE_SOURCE_LABEL: Record<DealRow["rateSource"], string> = { PROJECT: "project", DEVELOPER: "developer", MANUAL: "manual", MISSING: "rate missing" };
const TOTAL_ORDER: CommissionStatusValue[] = ["EXPECTED", "EARNED", "DEVELOPER_PAID", "PAID_OUT"];

/** "ok" = saved; "paused" = the partner's payouts are paused and the server wants an explicit override. */
export type StageOutcome = "ok" | "paused" | "error";
export type StageSetter = (dealId: string, to: PayoutAction, date: string, override: boolean) => Promise<StageOutcome>;

/** The one save path for payout buttons (Commissions screen and lead cockpit). */
export function useStageSetter(toast: ReturnType<typeof useToast>): StageSetter {
  const router = useRouter();
  return async (dealId, to, date, override) => {
    const r = await setDealStageAction(dealId, to, date, override);
    if ("error" in r) { toast.show(r.error, "error"); return r.code === "PAYOUT_PAUSED" ? "paused" : "error"; }
    toast.show(to === "CANCELLED" ? "Deal cancelled" : r.creditNoteNumber ? `Paid out — credit note ${r.creditNoteNumber}` : "Stage saved");
    router.refresh();
    return "ok";
  };
}

export function CreditNoteLink({ deal }: { deal: DealRow }) {
  if (!deal.creditNote) return null;
  return <a className="crm-credit-note" href={`/crm/credit-notes/${deal.creditNote.id}`} download>Credit note {deal.creditNote.number}</a>;
}

export function StageButtons({ deal, today, onSet }: { deal: DealRow; today: string; onSet: StageSetter }) {
  const actions = payoutActions(deal.status);
  const [picking, setPicking] = useState<PayoutAction | null>(null);
  const [date, setDate] = useState(today);
  const [paused, setPaused] = useState(false);
  const [override, setOverride] = useState(false);
  const [pending, start] = useTransition();
  if (actions.length === 0) return deal.creditNote ? <CreditNoteLink deal={deal} /> : <span className="crm-muted">—</span>;
  const pick = (a: PayoutAction | null) => { setDate(today); setPaused(false); setOverride(false); setPicking(a); };
  if (!picking) {
    return (
      <span className="crm-deal-actions">
        {actions.map((a) => (
          <button key={a} type="button" className={`crm-btn${a === "CANCELLED" ? " quiet" : ""}`} onClick={() => pick(a)}>{ACTION_LABEL[a]}</button>
        ))}
      </span>
    );
  }
  return (
    <form className="crm-confirm" aria-label={`${ACTION_LABEL[picking]} for ${deal.leadName}`}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await onSet(deal.id, picking, date, picking === "PAID_OUT" && paused && override);
          if (r === "ok") pick(null);
          else if (r === "paused") setPaused(true);
        });
      }}>
      <label>
        <span>{ACTION_QUESTION[picking]}</span>
        <input type="date" value={date} max={today} required onChange={(e) => setDate(e.target.value)} disabled={pending} />
      </label>
      {picking === "PAID_OUT" && paused && (
        <label className="crm-pay-anyway">
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} disabled={pending} />
          <span>Pay anyway</span>
        </label>
      )}
      <button type="submit" className={`crm-btn ${picking === "CANCELLED" ? "danger" : "primary"}`} disabled={pending || !date || (paused && !override)}>Confirm</button>
      <button type="button" className="crm-btn" disabled={pending} onClick={() => pick(null)}>Back</button>
    </form>
  );
}

export function DealDates({ d }: { d: DealRow }) {
  const steps: [string, string | null][] = [["Expected", d.expectedAt], ["Earned", d.earnedAt], ["Dev. paid", d.developerPaidAt], ["Paid out", d.paidOutAt]];
  const shown = steps.filter(([, v]) => v);
  return <span className="crm-deal-dates">{shown.map(([k, v]) => <span key={k}>{k} <time dateTime={v ?? undefined}>{v}</time></span>)}</span>;
}

export function DealsTable({ deals, totals, today, truncated }: { deals: DealRow[]; totals: StatusTotal[]; today: string; truncated: boolean }) {
  const toast = useToast();
  const onSet = useStageSetter(toast);
  const totalOf = new Map(totals.map((t) => [t.status, t]));
  return (
    <section className="crm-comm-section" aria-labelledby="crm-deals-h">
      <div className="crm-comm-sechead">
        <div>
          <h2 id="crm-deals-h">Deals</h2>
          <p>Open and paid deals, newest first. Cancelled deals are hidden.{truncated ? ` Showing the latest ${DEALS_SHOWN}.` : ""}</p>
        </div>
      </div>
      <dl className="crm-comm-totals">
        {TOTAL_ORDER.map((s) => {
          const t = totalOf.get(s);
          const missing = withoutRateLabel(t?.withoutRate ?? 0);
          return (
            <div key={s} className={`crm-panel c-${s}`}>
              <dt>{COMMISSION_LABEL[s]} <span>{t?.count ?? 0}</span></dt>
              <dd>{eur(t?.sum ?? 0)}{missing && <small className="crm-warn">{missing}</small>}</dd>
            </div>
          );
        })}
      </dl>
      {deals.length === 0 ? (
        <p className="crm-notice">No deals yet.</p>
      ) : (
        <div className="crm-deals-wrap">
          <table className="crm-deals">
            <thead>
              <tr><th>Lead</th><th>Project / unit</th><th className="num">Price</th><th className="num">Our rate</th><th className="num">Our commission</th><th className="num">Partner</th><th>Stage</th><th>Payout</th></tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  <td data-label="Lead"><Link href={`/crm/leads/${d.leadId}`}>{d.leadName}</Link></td>
                  <td data-label="Project / unit"><span>{d.project ?? <span className="crm-muted">No project</span>}{d.unitLabel && <span className="crm-muted"> · {d.unitLabel}</span>}</span></td>
                  <td data-label="Price" className="num">{eur(d.price)}</td>
                  <td data-label="Our rate" className="num"><span>
                    {d.rateSource === "MISSING"
                      ? <span className="crm-warn">rate missing</span>
                      : <>{d.ourRatePercent != null ? `${d.ourRatePercent} % ` : ""}<span className="crm-muted">{RATE_SOURCE_LABEL[d.rateSource]}</span></>}
                  </span></td>
                  <td data-label="Our commission" className="num">{d.ourCommission != null ? eur(d.ourCommission) : <span className="crm-muted">—</span>}</td>
                  <td data-label="Partner" className="num">{d.partnerCommission != null ? eur(d.partnerCommission) : <span className="crm-muted">—</span>}</td>
                  <td data-label="Stage"><span className="crm-deal-stage"><span className={`crm-pill c-${d.status}`}>{COMMISSION_LABEL[d.status]}</span><DealDates d={d} /></span></td>
                  <td data-label="Payout"><StageButtons deal={d} today={today} onSet={onSet} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toast.node}
    </section>
  );
}
