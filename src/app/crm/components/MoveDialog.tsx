"use client";
import { useEffect, useRef, useState } from "react";
import { LOST_REASONS, LOST_REASON_LABEL, STATUS_LABEL, type LeadStatusValue } from "@/lib/crm/leadStatus";
import { parseEuroPrice } from "@/lib/crm/parseEuroPrice";
import type { DealInput } from "@/lib/crm/moveLead";
import { searchDevelopmentsAction } from "../actions";

export type DialogNeed = { need: "deal" | "lostReason" | "confirmCancel"; leadName: string; to: LeadStatusValue; cancelCount?: number; error?: string };
export type DialogAnswer = { deal?: DealInput; lostReason?: string; confirmCancel?: boolean };

export function MoveDialog({ state, busy, onSubmit, onCancel, onClosed }: {
  state: DialogNeed; busy: boolean; onSubmit: (a: DialogAnswer) => void; onCancel: () => void;
  // Called whenever the element closes by itself (not by our own unmount).
  onClosed: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const unmounting = useRef(false);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [devId, setDevId] = useState("");
  const [devLabel, setDevLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState<string>(LOST_REASONS[0]);

  useEffect(() => {
    const d = ref.current;
    // StrictMode (next dev) runs mount, cleanup, mount: re-arm on every mount.
    unmounting.current = false;
    return () => { unmounting.current = true; if (d?.open) d.close(); };
  }, []);

  // Open on mount and after every render in which it is not open, so a retry
  // that asks the same question again (same key, no remount) shows the modal.
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  });

  useEffect(() => {
    if (state.need !== "deal") return;
    // The input text equals the chosen label: searching for it would empty the list.
    if (devId !== "" && q === devLabel) return;
    let live = true;
    const t = setTimeout(() => {
      searchDevelopmentsAction(q).then((r) => { if (live) setOptions(r); }).catch(() => { if (live) setOptions([]); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, state.need, devId, devLabel]);

  const priceNum = parseEuroPrice(price);
  const dealReady = devId !== "" && priceNum != null;
  const n = state.cancelCount ?? 1;

  return (
    <dialog ref={ref} className="crm-dialog" onCancel={(e) => { e.preventDefault(); onCancel(); }}
      onClose={() => { if (!unmounting.current) onClosed(); }} aria-labelledby="crm-dialog-title">
      <form method="dialog" onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        if (state.need === "deal" && dealReady) onSubmit({ deal: { developmentId: devId, unitLabel: unit.trim() || null, price: priceNum } });
        if (state.need === "lostReason") onSubmit({ lostReason: reason });
        if (state.need === "confirmCancel") onSubmit({ confirmCancel: true });
      }}>
        <h2 id="crm-dialog-title">{state.leadName} → {STATUS_LABEL[state.to]}</h2>
        {state.error && <p className="crm-dialog-error" role="alert">{state.error}</p>}

        {state.need === "deal" && (
          <>
            <label htmlFor="crm-dev-q">Project</label>
            <input id="crm-dev-q" value={q} onChange={(e) => { setQ(e.target.value); setDevId(""); setDevLabel(""); }} placeholder="Search published projects" autoComplete="off" autoFocus />
            <div className="crm-options" role="listbox" aria-label="Projects">
              {devId !== "" && q === devLabel
                ? <button type="button" role="option" aria-selected="true" className="on">✓ {devLabel}</button>
                : options.slice(0, 20).map((o) => (
                  <button type="button" key={o.id} role="option" aria-selected={devId === o.id} className={devId === o.id ? "on" : undefined}
                    onClick={() => { setDevId(o.id); setDevLabel(o.label); setQ(o.label); }}>{o.label}</button>
                ))}
            </div>
            <label htmlFor="crm-unit">Unit (optional)</label>
            <input id="crm-unit" value={unit} maxLength={40} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. A203" autoComplete="off" />
            <label htmlFor="crm-price">Price (EUR)</label>
            <input id="crm-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="412 000" autoComplete="off"
              aria-invalid={price.trim() !== "" && priceNum == null} />
            {price.trim() !== "" && priceNum == null && <p className="crm-dialog-error">Whole euros, e.g. 412 000.</p>}
          </>
        )}

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
