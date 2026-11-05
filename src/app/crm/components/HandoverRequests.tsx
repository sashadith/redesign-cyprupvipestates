"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptHandoverAction } from "../partners/handoverActions";
import { adminDateTime as when } from "@/lib/adminTime";
import { useToast } from "./Toast";
import type { HandoverRequestCard } from "@/lib/crm/handoverReview";

// "Handover requests" on /crm/today and /crm/inbox (partner pipeline, 2026-11-05): a partner
// asks the manager to take over a FIX client he works himself. Accept makes the client ours
// (owner = whoever accepts); "Accept and keep Fix" also keeps the partner's Fix share on an
// early handover. Admins see every open request, a manager only his partners'.

export type HandoverRequestView = HandoverRequestCard;

function Card({ r, onDone }: { r: HandoverRequestView; onDone: (id: string, message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(keepFix: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    let res: { ok: true } | { error: string };
    try {
      res = await acceptHandoverAction(r.id, keepFix);
    } catch {
      res = { error: "Could not save — check your connection and try again." };
    } finally {
      setBusy(false);
    }
    if ("error" in res) { setError(res.error); return; }
    onDone(r.id, keepFix ? `${r.client} is yours — the partner keeps the Fix share` : `${r.client} is yours now`);
  }

  return (
    <article className="crm-panel crm-cr" id={`handover-${r.id}`} aria-labelledby={`handover-h-${r.id}`}>
      <header className="crm-cr-head">
        <h3 id={`handover-h-${r.id}`}><a href={`/crm/leads/${r.leadId}`}>{r.client}</a></h3>
        {r.downgrade && <span className="crm-pill">Fix to Handover on accept</span>}
        <span className="crm-muted" title={when(r.createdAt)}>requested {r.age}</span>
      </header>
      <dl className="crm-ck-facts">
        <div><dt>Partner</dt><dd>{r.partner}</dd></div>
        <div><dt>Stage</dt><dd>{r.stage}</dd></div>
      </dl>
      {r.note && <p className="crm-ck-text">{r.note}</p>}
      <div className="crm-cr-actions">
        {r.downgrade && <p className="crm-muted">Requested before the viewing: on Accept the client becomes Handover. Accept and keep Fix leaves the partner the Fix share.</p>}
        {r.hasLiveDeal && <p className="crm-muted">A deal exists: the commission share is fixed and stays as it is.</p>}
        {error && <p className="crm-ck-error" role="alert">{error}</p>}
        <div className="crm-cr-buttons">
          {r.downgrade && !r.hasLiveDeal && <button type="button" className="crm-btn" disabled={busy} onClick={() => void run(true)}>Accept and keep Fix</button>}
          <button type="button" className="crm-btn primary" disabled={busy} onClick={() => void run(false)}>Accept</button>
        </div>
      </div>
    </article>
  );
}

export function HandoverRequests({ items, total }: { items: HandoverRequestView[]; total: number }) {
  const router = useRouter();
  // One toast for the whole list: a card's own toast would unmount with the card.
  const toast = useToast();
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const open = items.filter((r) => !done.has(r.id));
  if (!open.length) return <>{toast.node}</>;
  return (
    <section className="crm-cr-list" aria-labelledby="crm-ho-h" id="handovers">
      <h2 id="crm-ho-h">Handover requests <span className="crm-muted">{total > items.length ? `${total} open, showing the oldest ${items.length}` : `${total} open`}</span></h2>
      <p className="crm-muted">A partner asks you to take over a client they work themselves. Until you accept, the client stays with the partner and is read only.</p>
      {open.map((r) => (
        <Card key={r.id} r={r} onDone={(id, message) => { setDone((s) => new Set(s).add(id)); toast.show(message); router.refresh(); }} />
      ))}
      {toast.node}
    </section>
  );
}
