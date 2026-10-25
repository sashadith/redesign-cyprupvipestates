"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { assignLeadAction } from "../actions";
import { assignToast, type AssignResult } from "@/lib/crm/assignMessage";
import { useToast } from "./Toast";

// Owner select on the lead cockpit (managers only, CRM v2 2026-10-18).

export function CockpitAssign({ leadId, ownerId, staff }: { leadId: string; ownerId: string | null; staff: { id: string; name: string; acceptsLeads: boolean }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pick, setPick] = useState(ownerId ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => setPick(ownerId ?? ""), [ownerId]);

  async function assign() {
    if (!pick || busy) return;
    const who = staff.find((s) => s.id === pick)?.name ?? "them";
    setBusy(true);
    let res: AssignResult;
    try {
      res = await assignLeadAction(leadId, pick);
    } catch {
      res = { error: "Could not assign — check your connection and try again." };
    } finally {
      setBusy(false);
    }
    if ("ok" in res) { toast.show(assignToast(who, res)); router.refresh(); }
    else toast.show(res.error, "error");
  }

  return (
    <section className="crm-panel crm-ck-assign" aria-labelledby="crm-ck-assign-h">
      <h2 id="crm-ck-assign-h">Owner</h2>
      <div className="crm-ck-assignrow">
        <label className="sr-only" htmlFor="crm-ck-owner">Owner</label>
        <select id="crm-ck-owner" value={pick} onChange={(e) => setPick(e.target.value)} disabled={busy}>
          <option value="" disabled>Choose…</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.acceptsLeads ? "" : " (away)"}</option>)}
        </select>
        <button type="button" className="crm-btn primary" disabled={!pick || busy || pick === ownerId} onClick={() => void assign()}>Assign</button>
      </div>
      {toast.node}
    </section>
  );
}
