"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreLeadAction } from "../actions";
import type { TrashRow } from "@/lib/crm/trashView";
import { useToast } from "./Toast";

export function TrashList({ rows }: { rows: TrashRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function restore(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await restoreLeadAction(id);
      if ("ok" in res) { toast.show("Lead restored"); router.refresh(); }
      else toast.show(res.error, "error");
    } catch {
      toast.show("Could not restore — check your connection and try again.", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (!rows.length) return <p className="crm-muted">The trash is empty.</p>;
  return (
    <div className="crm-panel crm-trash-wrap">
      <table className="crm-trash-table">
        <thead>
          <tr><th>Lead</th><th>Source</th><th>Status</th><th>Trashed</th><th>By</th><th><span className="sr-only">Action</span></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td><td>{r.source}</td><td>{r.status}</td><td>{r.trashedAt}</td><td>{r.trashedBy}</td>
              <td><button type="button" className="crm-btn" disabled={busyId !== null} onClick={() => void restore(r.id)}>{busyId === r.id ? "Restoring…" : "Restore"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {toast.node}
    </div>
  );
}
