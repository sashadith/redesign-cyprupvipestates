"use client";
import { useState } from "react";
import { intakeFromTextAction } from "../leads/actions";
import type { IntakeFields, IntakeResult } from "@/lib/crm/ai/intake";

// "Paste a chat or email" on the new-lead form (Phase 2c). Claude's result only
// fills empty form fields (the parent decides which); nothing is submitted.

const MIN = 20, MAX = 8000;

export function LeadIntake({ onExtract }: { onExtract: (fields: IntakeFields) => string[] }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const len = text.trim().length;

  async function run() {
    if (busy || len < MIN) return;
    setBusy(true); setMsg(null);
    let r: IntakeResult;
    try {
      r = await intakeFromTextAction(text);
    } catch {
      r = { ok: false, error: "Could not reach the server — check your connection and try again." };
    } finally {
      setBusy(false);
    }
    if (!r.ok) { setMsg({ text: r.error, error: true }); return; }
    const filled = onExtract(r.fields);
    setMsg({ text: filled.length ? `Filled: ${filled.join(", ")}. Check them before saving.` : "Nothing new — the fields Claude found are already filled." });
  }

  return (
    <details className="crm-nl-intake">
      <summary>Paste a chat or email</summary>
      <div className="crm-nl-intakebody">
        <label className="crm-ck-field">
          <span>Claude reads it and fills the empty fields below</span>
          <textarea value={text} rows={5} maxLength={MAX} onChange={(e) => setText(e.target.value)} disabled={busy} />
        </label>
        <div className="crm-nl-intakerow">
          <span className="crm-muted">{len < MIN ? `At least ${MIN} characters` : `${len} / ${MAX}`}</span>
          <button type="button" className="crm-btn" onClick={() => void run()} disabled={busy || len < MIN}>
            {busy ? "Reading…" : "Fill the form"}
          </button>
        </div>
        <p aria-live="polite" className={msg?.error ? "crm-ck-error" : "crm-nl-intakemsg"}>{msg?.text}</p>
      </div>
    </details>
  );
}
