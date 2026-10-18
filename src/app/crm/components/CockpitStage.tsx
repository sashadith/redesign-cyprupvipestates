"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FUNNEL_STATUSES, STATUS_LABEL, isLeadStatus, type LeadStatusValue } from "@/lib/crm/leadStatus";
import { useMoveFlow } from "./useMoveFlow";
import { useToast } from "./Toast";

// Stage control of the lead cockpit (CRM v2, 2026-10-18): the funnel as a
// stepper plus Keep contact / Lost. Same move rules and dialogs as the board.

export function CockpitStage({ leadId, leadName, status: initial, canEdit }: { leadId: string; leadName: string; status: string; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState(initial);
  useEffect(() => setStatus(initial), [initial]);
  // The button that started the move. It is disabled while the dialog is open,
  // so a cancelled/closed dialog leaves focus on <body>; put it back by hand.
  const trigger = useRef<HTMLButtonElement | null>(null);

  const flow = useMoveFlow({
    canMove: () => canEdit,
    apply: ({ to }) => {
      const before = status;
      setStatus(to);
      return () => setStatus(before);
    },
    moved: ({ to }) => {
      toast.show(`${leadName} → ${STATUS_LABEL[to]}`);
      router.refresh();
    },
    failed: (_req, error) => toast.show(error, "error"),
    dismissed: () => requestAnimationFrame(() => trigger.current?.focus()),
  });

  const move = (to: LeadStatusValue, from: HTMLButtonElement) => {
    if (to === status) return;
    trigger.current = from;
    flow.start({ id: leadId, to, leadName });
  };
  const current = isLeadStatus(status) ? status : null;
  const reached = current ? FUNNEL_STATUSES.indexOf(current as (typeof FUNNEL_STATUSES)[number]) : -1;
  const disabled = !canEdit || flow.busy || flow.dialogOpen;

  return (
    <section className="crm-panel crm-ck-stage" aria-labelledby="crm-ck-stage-h">
      <div className="crm-ck-sechead">
        <h2 id="crm-ck-stage-h">Stage</h2>
        {!canEdit && <span className="crm-muted">Only the owner or a manager can move this lead.</span>}
      </div>
      <ol className="crm-ck-steps">
        {FUNNEL_STATUSES.map((s, i) => (
          <li key={s} className={`s-${s}${i <= reached ? " done" : ""}`}>
            <button type="button" aria-current={s === current ? "step" : undefined} disabled={disabled || s === current} onClick={(e) => move(s, e.currentTarget)}>
              <span className="dot" />{STATUS_LABEL[s]}
            </button>
          </li>
        ))}
      </ol>
      <div className="crm-ck-side">
        {(["KEEP_CONTACT", "LOST"] as const).map((s) => (
          <button key={s} type="button" className={`crm-btn s-${s}${s === current ? " on" : ""}`} aria-pressed={s === current} disabled={disabled || s === current} onClick={(e) => move(s, e.currentTarget)}>
            <span className="dot" />{STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {flow.node}
      {toast.node}
    </section>
  );
}
