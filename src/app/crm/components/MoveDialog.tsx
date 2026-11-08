"use client";
import { useEffect, useRef, useState } from "react";
import { LOST_REASONS, LOST_REASON_LABEL, STATUS_LABEL, type LeadStatusValue } from "@/lib/crm/leadStatus";
import type { DealInput } from "@/lib/crm/moveLead";
import { DealFields } from "./DealFields";

export type DialogNeed = { need: "deal" | "lostReason" | "confirmCancel"; leadName: string; to: LeadStatusValue; cancelCount?: number; error?: string };
export type DialogAnswer = { deal?: DealInput; lostReason?: string; confirmCancel?: boolean };

export function MoveDialog({ state, busy, onSubmit, onCancel, onClosed }: {
  state: DialogNeed; busy: boolean; onSubmit: (a: DialogAnswer) => void; onCancel: () => void;
  // Called whenever the element closes by itself (not by our own unmount).
  onClosed: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const unmounting = useRef(false);
  const [deal, setDeal] = useState<DealInput | null>(null);
  const [reason, setReason] = useState<string>(LOST_REASONS[0]);

  useEffect(() => {
    // StrictMode (next dev) runs mount, cleanup, mount: re-arm on every mount.
    // The cleanup must not call close(): its close event is queued and would
    // arrive after the re-run has reopened the dialog. Unmounting the element is enough.
    unmounting.current = false;
    return () => { unmounting.current = true; };
  }, []);

  // Open on mount and after every render in which it is not open, so a retry
  // that asks the same question again (same key, no remount) shows the modal.
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  });

  const dealReady = deal != null;
  const n = state.cancelCount ?? 1;

  return (
    <dialog ref={ref} className={state.need === "deal" ? "crm-dialog crm-deal-dialog" : "crm-dialog"} onCancel={(e) => { e.preventDefault(); onCancel(); }}
      onClose={() => { if (unmounting.current || ref.current?.open) return; onClosed(); }} aria-labelledby="crm-dialog-title">
      <form method="dialog" onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        if (state.need === "deal" && deal) onSubmit({ deal });
        if (state.need === "lostReason") onSubmit({ lostReason: reason });
        if (state.need === "confirmCancel") onSubmit({ confirmCancel: true });
      }}>
        <h2 id="crm-dialog-title">{state.leadName} → {STATUS_LABEL[state.to]}</h2>
        {state.error && <p className="crm-dialog-error" role="alert">{state.error}</p>}

        {state.need === "deal" && <DealFields autoFocus onChange={(d) => setDeal(d)} />}

        {state.need === "lostReason" && (
          <>
            <label htmlFor="crm-reason">Why was the lead lost?</label>
            <select id="crm-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus>
              {LOST_REASONS.map((r) => <option key={r} value={r}>{LOST_REASON_LABEL[r]}</option>)}
            </select>
          </>
        )}

        {state.need === "confirmCancel" && (
          <p>This cancels {n} open deal{n === 1 ? "" : "s"}. The commission becomes Cancelled and stays on record.</p>
        )}

        <div className="crm-dialog-actions">
          <button type="button" className="crm-btn" onClick={onCancel}>{state.need === "confirmCancel" ? "Keep as is" : "Cancel"}</button>
          <button type="submit" className="crm-btn primary" disabled={busy || (state.need === "deal" && !dealReady)}>
            {state.need === "confirmCancel" ? "Cancel deal and move" : state.need === "deal" ? "Save deal and move" : "Move"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
