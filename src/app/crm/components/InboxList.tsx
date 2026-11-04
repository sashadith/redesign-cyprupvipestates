"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { assignLeadAction } from "../actions";
import { assignToast, type AssignResult } from "@/lib/crm/assignMessage";
import { useToast } from "./Toast";

export type InboxItem = {
  id: string; name: string; lang: string | null; source: string; isPartner: boolean; partnerBadge: boolean; isFix: boolean; interest: string | null; createdAt: string;
  suggestion: { userId: string; name: string; reason: string } | null;
};

function waited(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export function InboxList({ items, staff }: { items: InboxItem[]; staff: { id: string; name: string; acceptsLeads: boolean }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [leaving, setLeaving] = useState<string | null>(null);
  // Rows assigned in this view stay faded out until the refreshed list drops them.
  const [assigned, setAssigned] = useState<ReadonlySet<string>>(new Set());
  const [choice, setChoice] = useState<Record<string, string>>({});

  async function assign(item: InboxItem, userId: string) {
    const who = staff.find((s) => s.id === userId)?.name ?? "them";
    setLeaving(item.id);
    let res: AssignResult;
    try {
      res = await assignLeadAction(item.id, userId);
    } catch {
      res = { error: "Could not assign — check your connection and try again." };
    }
    // Reset either way: a stuck `leaving` would hide a row that is still there.
    setLeaving(null);
    if ("ok" in res) {
      setAssigned((s) => new Set(s).add(item.id));
      toast.show(assignToast(who, res));
      router.refresh();
    }
    else toast.show(res.error, "error");
  }

  if (!items.length) return <div className="crm-panel crm-empty">Inbox zero. New leads land here first.</div>;
  return (
    <>
      <div className="crm-inbox">
        {items.map((it) => {
          const pick = choice[it.id] ?? it.suggestion?.userId ?? "";
          const gone = leaving === it.id || assigned.has(it.id);
          return (
            <article key={it.id} className={`crm-ib${gone ? " leaving" : ""}`}>
              <div className="t"><a href={`/crm/leads/${it.id}`}>{it.name}</a>{it.lang && <span className="lang">{it.lang}</span>}<span className="wait">{waited(it.createdAt)}</span></div>
              <div className="s">
                <span className={`src${it.isPartner ? " partner" : ""}`}>{it.source}</span>
                {it.partnerBadge && <> <span className="src partner">Partner</span></>}
                {it.isFix && <> <span className="src partner fix">Fix</span></>}
                {it.interest && <> · {it.interest}</>}
              </div>
              <div className="sug">
                {it.isFix
                  ? <span className="why">Fix — assign the developer-registration owner</span>
                  : it.suggestion ? <span><b>{it.suggestion.name}</b> <span className="why">{it.suggestion.reason}</span></span> : <span className="why">Nobody is taking leads right now</span>}
                <label className="sr-only" htmlFor={`own-${it.id}`}>Owner</label>
                <select id={`own-${it.id}`} value={pick} onChange={(e) => setChoice((c) => ({ ...c, [it.id]: e.target.value }))}>
                  <option value="" disabled>Choose…</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.acceptsLeads ? "" : " (away)"}</option>)}
                </select>
                <button type="button" className="crm-btn primary" disabled={!pick || gone} onClick={() => void assign(it, pick)}>Assign</button>
              </div>
            </article>
          );
        })}
      </div>
      {toast.node}
    </>
  );
}
