"use client";
import { useState, useTransition } from "react";
import { acceptTierProposalAction, declineTierProposalAction, saveTierConfigAction } from "../partners/tierActions";
import { useToast } from "./Toast";

export type TierSettingsRow = { key: string; name: string; minClosedDeals: number; handoverShare: number; fixShare: number; active: boolean };
export type TierProposalRow = {
  id: string; partnerName: string; company: string | null; fromLabel: string; toLabel: string; closedDeals: number; created: string;
};

type Draft = { key: string; name: string; minClosedDeals: string; handoverShare: string; fixShare: string; active: boolean };
const toDraft = (r: TierSettingsRow): Draft => ({
  key: r.key, name: r.name, minClosedDeals: String(r.minClosedDeals), handoverShare: String(r.handoverShare), fixShare: String(r.fixShare), active: r.active,
});

/** All tiers in one table, saved together (the server validates thresholds and shares as a whole). */
function TierSettings({ tiers }: { tiers: TierSettingsRow[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Draft[]>(() => tiers.map(toDraft));
  const set = (i: number, patch: Partial<Draft>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = () => start(async () => {
    const r = await saveTierConfigAction(rows);
    if ("error" in r) toast.show(r.error, "error"); else toast.show(r.notice ?? "Saved");
  });
  return (
    <section className="crm-panel crm-pt-tiers" aria-labelledby="pt-tiers-title" aria-busy={pending}>
      <div className="crm-pt-bot-head">
        <h2 id="pt-tiers-title">Partner tiers</h2>
        <span className="crm-pt-bot-count">Closed deals in the last 12 months · new shares apply to deals created after a tier change</span>
      </div>
      <fieldset disabled={pending} className="crm-pt-tierset">
        <div className="crm-in-tablewrap">
          <table className="crm-in-table">
            <thead>
              <tr><th scope="col">Tier</th><th scope="col">Name</th><th scope="col">From closed deals</th><th scope="col">Handover, %</th><th scope="col">Fix, %</th><th scope="col">Active</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <th scope="row">{r.key}</th>
                  <td><input value={r.name} maxLength={40} onChange={(e) => set(i, { name: e.target.value })} aria-label={`Name of tier ${r.key}`} /></td>
                  <td><input inputMode="numeric" value={r.minClosedDeals} onChange={(e) => set(i, { minClosedDeals: e.target.value })} aria-label={`Threshold of tier ${r.key}`} /></td>
                  <td><input inputMode="decimal" value={r.handoverShare} onChange={(e) => set(i, { handoverShare: e.target.value })} aria-label={`Handover share of tier ${r.key}`} /></td>
                  <td><input inputMode="decimal" value={r.fixShare} onChange={(e) => set(i, { fixShare: e.target.value })} aria-label={`Fix share of tier ${r.key}`} /></td>
                  <td><input type="checkbox" checked={r.active} onChange={(e) => set(i, { active: e.target.checked })} aria-label={`Tier ${r.key} active`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="crm-pt-actions">
          <button type="button" className="crm-btn primary" onClick={save}>Save tiers</button>
          <button type="button" className="crm-btn quiet" onClick={() => setRows(tiers.map(toDraft))}>Reset</button>
        </div>
      </fieldset>
    </section>
  );
}

function Proposal({ p }: { p: TierProposalRow }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false); // stays disabled until the refreshed list drops the row
  const run = (fn: (id: string) => Promise<{ ok: true; notice?: string } | { error: string }>) => {
    if (pending || done) return;
    start(async () => {
      const r = await fn(p.id);
      if ("error" in r) toast.show(r.error, "error");
      else {
        setDone(true);
        toast.show(r.notice ?? "Done");
      }
    });
  };
  return (
    <tr aria-busy={pending}>
      <th scope="row">{p.partnerName}{p.company && <span className="crm-muted"> · {p.company}</span>}</th>
      <td>{p.fromLabel} → <b>{p.toLabel}</b></td>
      <td className="num">{p.closedDeals}</td>
      <td>{p.created}</td>
      <td>
        <span className="crm-pt-actions">
          <button type="button" className="crm-btn primary" disabled={pending || done} onClick={() => run(acceptTierProposalAction)}>Accept</button>
          <button type="button" className="crm-btn" disabled={pending || done} onClick={() => run(declineTierProposalAction)}>Decline</button>
        </span>
      </td>
    </tr>
  );
}

function OpenProposals({ proposals }: { proposals: TierProposalRow[] }) {
  return (
    <section className="crm-panel crm-pt-tiers" aria-labelledby="pt-proposals-title">
      <div className="crm-pt-bot-head">
        <h2 id="pt-proposals-title">Open tier proposals</h2>
        <span className="crm-pt-bot-count">{proposals.length} open · Accept sets the tier and its shares and notifies the partner</span>
      </div>
      {proposals.length === 0 ? (
        <p>No open proposals.</p>
      ) : (
        <div className="crm-in-tablewrap">
          <table className="crm-in-table">
            <thead>
              <tr><th scope="col">Partner</th><th scope="col">Tier</th><th scope="col" className="num">Closed deals</th><th scope="col">Created</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>{proposals.map((p) => <Proposal key={p.id} p={p} />)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function PartnerTiersPanel({ tiers, proposals }: { tiers: TierSettingsRow[]; proposals: TierProposalRow[] }) {
  // Keyed on the stored values: after a save (revalidated page) the inputs start from the new config.
  const key = tiers.map((t) => `${t.key}:${t.name}:${t.minClosedDeals}:${t.handoverShare}:${t.fixShare}:${t.active}`).join("|");
  return (
    <>
      <OpenProposals proposals={proposals} />
      <TierSettings key={key} tiers={tiers} />
    </>
  );
}
