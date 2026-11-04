"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { extendPresentationAction } from "../leads/presentationActions";

// "Extend 7 days" on an expiring selection in the Today list.
export function ExtendSelectionButton({ presentationId }: { presentationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="crm-today-hotext">
      <button
        type="button"
        className="crm-btn"
        disabled={pending}
        onClick={() => {
          setErr(null);
          start(async () => {
            const r = await extendPresentationAction(presentationId, 7);
            if ("error" in r) setErr(r.error);
            else router.refresh();
          });
        }}
      >
        {pending ? "Extending…" : "Extend 7 days"}
      </button>
      {err && <span role="alert" className="crm-today-hoterr">{err}</span>}
    </div>
  );
}
