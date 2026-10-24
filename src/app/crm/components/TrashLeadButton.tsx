"use client";
import { useRef, useState } from "react";
import { trashLeadAction } from "../actions";
import { TRASH_REASON_MAX, TRASH_RETENTION_DAYS } from "@/lib/crm/trashView";

// "Move to trash" on the cockpit header, with an in-page confirmation (a native
// <dialog>, no window.confirm). On success the server action redirects to the
// pipeline, which shows the toast; only a failure returns here.
export function TrashLeadButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => { setError(null); dlg.current?.showModal(); };
  const close = () => { if (!busy) dlg.current?.close(); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await trashLeadAction(leadId, reason);
      if (res && "error" in res) setError(res.error);
    } catch {
      setError("Could not move the lead to trash — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="crm-btn crm-trash-btn" onClick={open}>Move to trash</button>
      <dialog ref={dlg} className="crm-dialog" aria-labelledby="crm-trash-h" onCancel={(e) => { if (busy) e.preventDefault(); }}>
        <form onSubmit={(e) => void submit(e)}>
          <h2 id="crm-trash-h">Move {leadName} to trash?</h2>
          <p>The lead disappears from all lists. It can be restored within {TRASH_RETENTION_DAYS} days.</p>
          <label htmlFor="crm-trash-reason">Reason (optional)</label>
          <textarea id="crm-trash-reason" className="crm-trash-reason" rows={3} maxLength={TRASH_REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
          {error && <p className="crm-dialog-error" role="alert">{error}</p>}
          <div className="crm-dialog-actions">
            <button type="button" className="crm-btn" onClick={close} disabled={busy}>Cancel</button>
            <button type="submit" className="crm-btn danger" disabled={busy}>{busy ? "Moving…" : "Move to trash"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
