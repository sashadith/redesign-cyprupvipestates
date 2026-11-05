"use client";
import { useState } from "react";
import { PARTNER_MESSAGE_MAX } from "@/lib/crm/partnerClaims";
import { HINT_TEMPLATES } from "@/lib/crm/partnerPipelineDigest";
import { sendPartnerMessageAction } from "../partners/claimActions";

// "Hint to partner" under a card of the partner pipelines view: a template fills the text, which stays
// editable and is sent as written. The server action checks that the viewer is an admin or the partner's manager.

export default function HintForm({ leadId }: { leadId: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const ready = text.trim().length > 0 && text.trim().length <= PARTNER_MESSAGE_MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await sendPartnerMessageAction(leadId, text);
      if ("error" in res) setNote({ ok: false, text: res.error });
      else {
        setText("");
        setNote({ ok: true, text: "Hint sent to the partner." });
      }
    } catch {
      setNote({ ok: false, text: "Could not send. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="crm-pp-hint">
      <summary>Hint to partner</summary>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <select aria-label="Hint template" value="" onChange={(e) => { if (e.target.value) setText(e.target.value); }}>
            <option value="">Choose a template</option>
            {HINT_TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea aria-label="Hint text" rows={3} value={text} maxLength={PARTNER_MESSAGE_MAX} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="crm-btn primary" disabled={!ready}>{busy ? "Sending…" : "Send hint"}</button>
          {note && <p role={note.ok ? "status" : "alert"} className={note.ok ? "crm-muted" : "crm-ck-error"}>{note.text}</p>}
        </fieldset>
      </form>
    </details>
  );
}
