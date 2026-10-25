"use client";
import { useState } from "react";
import { summariseLeadAction } from "../leads/actions";
import type { SummaryResult } from "@/lib/crm/ai/summary";

// "Summarise with Claude" on the lead cockpit (Phase 2c). Read-only: generated
// on demand, never stored, never sent to the lead.

export function CockpitSummary({ leadId }: { leadId: string }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<SummaryResult | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    let r: SummaryResult;
    try {
      r = await summariseLeadAction(leadId);
    } catch {
      r = { ok: false, error: "Could not reach the server — check your connection and try again." };
    } finally {
      setBusy(false);
    }
    setRes(r);
  }

  return (
    <section className="crm-panel crm-ck-summary" aria-labelledby="crm-ck-summary-h" aria-busy={busy}>
      <div className="crm-ck-sechead">
        <h2 id="crm-ck-summary-h">Summary</h2>
        <button type="button" className="crm-btn" onClick={() => void run()} disabled={busy}>
          {busy ? "Summarising…" : res?.ok ? "Summarise again" : "Summarise with Claude"}
        </button>
      </div>
      <div aria-live="polite">
        {res && !res.ok && <p className="crm-ck-error" role="alert">{res.error}</p>}
        {res?.ok && (
          <>
            <ul className="crm-ck-sumlist">
              {res.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
            <p className="crm-ck-next"><b>Next step:</b> {res.nextStep}</p>
            <p className="crm-muted crm-ck-sumnote">Generated from the lead&apos;s data — check before acting.</p>
          </>
        )}
      </div>
    </section>
  );
}
