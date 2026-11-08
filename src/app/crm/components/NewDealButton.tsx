"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DealInput } from "@/lib/crm/dealInput";
import { shouldMoveToReserved } from "@/lib/crm/addDealRules";
import { addDealAction } from "../actions";
import { DealFields } from "./DealFields";

// Cockpit "New deal" (operator, 2026-11-08): developer and project from our
// lists or typed in, sale price, optional rate. While the lead is still before
// Reserved, a pre-ticked box moves it there with the deal.

export function NewDealButton({ leadId, leadName, status, onDone }: { leadId: string; leadName: string; status: string; onDone: (msg: string, warn?: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="crm-btn" onClick={() => setOpen(true)}>New deal</button>
      {open && <NewDealDialog leadId={leadId} leadName={leadName} status={status} onClose={() => setOpen(false)} onDone={(m, warn) => { setOpen(false); onDone(m, warn); }} />}
    </>
  );
}

function NewDealDialog({ leadId, leadName, status, onClose, onDone }: { leadId: string; leadName: string; status: string; onClose: () => void; onDone: (msg: string, warn?: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [deal, setDeal] = useState<DealInput | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const canMove = shouldMoveToReserved(status, true);
  const [move, setMove] = useState(canMove);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);

  async function save() {
    setTried(true);
    if (!deal || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await addDealAction(leadId, deal, canMove && move);
      if ("error" in res) { setError(res.error); return; }
      router.refresh();
      if (res.warning) { onDone(res.warning, true); return; }
      onDone(res.moved ? "Deal saved, lead moved to Reserved." : "Deal saved.");
    } catch {
      setError("The deal was not saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="crm-dialog crm-deal-dialog" onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }} aria-labelledby="crm-newdeal-h">
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <h2 id="crm-newdeal-h">New deal · {leadName}</h2>
        {error && <p className="crm-dialog-error" role="alert">{error}</p>}
        <DealFields autoFocus onChange={(d, p) => { setDeal(d); setProblem(p); }} />
        {canMove && (
          <label className="crm-deal-move">
            <input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} /> Move the lead to Reserved
          </label>
        )}
        {tried && problem && <p className="crm-dialog-error">{problem}</p>}
        <div className="crm-dialog-actions">
          <button type="button" className="crm-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="crm-btn primary" disabled={busy}>{busy ? "Saving…" : "Save deal"}</button>
        </div>
      </form>
    </dialog>
  );
}
