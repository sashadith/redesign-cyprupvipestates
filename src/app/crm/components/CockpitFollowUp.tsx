"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { dayKey } from "@/lib/crm/today";
import { FOLLOW_UP_QUICK_DAYS, dayPlus, followUpLabel } from "@/lib/crm/followUp";
import { setFollowUpAction } from "../leads/actions";
import { useToast } from "./Toast";

// Next follow-up of the lead (2026-11-01): any date, three shortcuts, or clear.
// The server re-checks the date (resolveFollowUp) and logs the change.
// Sits inside the Contact panel, under the enquiry, as one compact block.

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
    <div className="crm-ck-follow">
      <div className="crm-ck-follow-head">
        <h3>Next follow-up</h3>
        <span className={`crm-ck-follow-now${overdue ? " overdue" : ""}`}>
          {current ? <>{followUpLabel(current)}{overdue && " · overdue"}</> : <span className="crm-muted">Not set</span>}
        </span>
        {canEdit && current && <button type="button" className="crm-linkbtn" disabled={busy} onClick={() => void save({ clear: true })}>Clear</button>}
      </div>
      {canEdit && (
        <form className="crm-ck-follow-row" onSubmit={(e) => { e.preventDefault(); if (day) void save({ day }); }}>
          {FOLLOW_UP_QUICK_DAYS.map((n) => (
            <button key={n} type="button" className="crm-btn" disabled={busy} onClick={() => void save({ days: n })}>{QUICK_LABEL[n]}</button>
          ))}
          <input type="date" aria-label="Pick a date" value={day} min={today} max={dayPlus(now, 730)} onChange={(e) => setDay(e.target.value)} disabled={busy} />
          <button type="submit" className="crm-btn primary" disabled={busy || !day}>Set</button>
        </form>
      )}
      {toast.node}
    </div>
  );
}
