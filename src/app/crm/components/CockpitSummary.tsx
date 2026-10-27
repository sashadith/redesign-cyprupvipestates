"use client";
import { useState } from "react";
import { setSummaryLocaleAction, summariseLeadAction } from "../leads/actions";
import type { SummaryResult } from "@/lib/crm/ai/summary";
import { SUMMARY_LOCALES, type SummaryLocale } from "@/lib/crm/summaryLocale";

// "Summarise with Claude" on the lead cockpit (Phase 2c). Read-only: generated
// on demand, never stored, never sent to the lead. The language picker remembers
// the user's last choice on the server (User.crmSummaryLocale).

export function CockpitSummary({ leadId, initialLocale }: { leadId: string; initialLocale: SummaryLocale }) {
  const [busy, setBusy] = useState(false);
  const [locale, setLocale] = useState<SummaryLocale>(initialLocale);
  const [res, setRes] = useState<SummaryResult | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    let r: SummaryResult;
    try {
      r = await summariseLeadAction(leadId, locale);
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
        <div className="crm-ck-sumctl">
          <select
            className="crm-ck-sumlang" aria-label="Summary language" value={locale} disabled={busy}
            onChange={(e) => {
              const l = e.target.value as SummaryLocale;
              setLocale(l);
              void setSummaryLocaleAction(l).catch(() => {});
            }}
          >
            {SUMMARY_LOCALES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
          <button type="button" className="crm-btn" onClick={() => void run()} disabled={busy}>
            {busy ? "Summarising…" : res?.ok ? "Summarise again" : "Summarise with Claude"}
          </button>
        </div>
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
