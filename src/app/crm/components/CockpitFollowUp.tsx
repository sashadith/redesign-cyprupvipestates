"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { dayKey } from "@/lib/crm/today";
import { FOLLOW_UP_QUICK_DAYS, dayPlus, followUpLabel } from "@/lib/crm/followUp";
import { setFollowUpAction } from "../leads/actions";
import { useToast } from "./Toast";

// Next follow-up of the lead (2026-11-01): any date, three shortcuts, or clear.
// The server re-checks the date (resolveFollowUp) and logs the change.

const QUICK_LABEL: Record<(typeof FOLLOW_UP_QUICK_DAYS)[number], string> = { 1: "Tomorrow", 3: "+3 days", 7: "+1 week" };

export function CockpitFollowUp({ leadId, at: initial, canEdit }: { leadId: string; at: string | null; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [at, setAt] = useState<string | null>(initial);
  useEffect(() => setAt(initial), [initial]);
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const today = dayKey(now);
  const current = at ? new Date(at) : null;
  const overdue = !!current && dayKey(current) < today;

  async function save(input: { day?: string; days?: number; clear?: boolean }) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await setFollowUpAction(leadId, input);
      if ("error" in r) { toast.show(r.error, "error"); return; }
      setAt(r.at);
      setDay("");
      toast.show(r.at ? `Follow-up ${followUpLabel(new Date(r.at))}` : "Follow-up cleared");
      router.refresh();
    } catch {
      toast.show("Could not save — check your connection and try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="crm-panel crm-ck-follow" aria-labelledby="crm-ck-follow-h">
      <h2 id="crm-ck-follow-h">Next follow-up</h2>
      <p className={`crm-ck-follow-now${overdue ? " overdue" : ""}`}>
        {current ? <>{followUpLabel(current)}{overdue && " · overdue"}</> : <span className="crm-muted">Not set</span>}
      </p>
      {canEdit && (
        <>
          <div className="crm-ck-follow-quick">
            {FOLLOW_UP_QUICK_DAYS.map((n) => (
              <button key={n} type="button" className="crm-btn" disabled={busy} onClick={() => void save({ days: n })}>{QUICK_LABEL[n]}</button>
            ))}
            {current && <button type="button" className="crm-linkbtn" disabled={busy} onClick={() => void save({ clear: true })}>Clear</button>}
          </div>
          <form className="crm-ck-follow-pick" onSubmit={(e) => { e.preventDefault(); if (day) void save({ day }); }}>
            <label className="crm-ck-field">
              <span>Pick a date</span>
              <input type="date" value={day} min={today} max={dayPlus(now, 730)} onChange={(e) => setDay(e.target.value)} disabled={busy} />
            </label>
            <button type="submit" className="crm-btn primary" disabled={busy || !day}>Set</button>
          </form>
        </>
      )}
      {toast.node}
    </section>
  );
}
