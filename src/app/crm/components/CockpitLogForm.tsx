"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LOGGABLE_TYPES, bodyRequirement, type LoggableInteractionType } from "@/lib/crm/logRule";
import { logInteractionAction } from "../leads/actions";
import { useToast } from "./Toast";

// Log a contact on the lead cockpit (CRM v2, 2026-10-18): the same six types
// and body rule as the MCP tool crm_log_interaction.

const TYPE_LABEL: Record<LoggableInteractionType, string> = {
  CALL: "Call", NOTE: "Note", WHATSAPP_OUT: "WhatsApp sent", WHATSAPP_IN: "WhatsApp received", EMAIL_OUT: "Email sent", EMAIL_IN: "Email received",
};

// <input type="datetime-local"> works in the browser's local time, without a zone.
const localInputValue = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function CockpitLogForm({ leadId, canEdit }: { leadId: string; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [type, setType] = useState<LoggableInteractionType>("CALL");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [when, setWhen] = useState("");
  const [replied, setReplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmail = type === "EMAIL_OUT" || type === "EMAIL_IN";
  const inbound = type === "WHATSAPP_IN" || type === "EMAIL_IN";
  const ready = bodyRequirement(type, body, isEmail ? subject : null).ok;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || busy || !ready) return;
    let occurredAt: string | undefined;
    if (when) {
      const d = new Date(when);
      if (Number.isNaN(d.getTime())) { setError("Pick a valid date and time."); return; }
      occurredAt = d.toISOString();
    }
    setBusy(true);
    setError(null);
    let res: { ok: true } | { error: string };
    try {
      res = await logInteractionAction(leadId, {
        type,
        body: body.trim() || undefined,
        subject: isEmail ? subject.trim() || undefined : undefined,
        occurredAt,
        leadReacted: inbound || replied || undefined,
      });
    } catch {
      res = { error: "Could not save — check your connection and try again." };
    } finally {
      setBusy(false);
    }
    if ("error" in res) { setError(res.error); return; }
    setBody(""); setSubject(""); setWhen(""); setReplied(false);
    toast.show(`${TYPE_LABEL[type]} logged`);
    router.refresh();
  }

  return (
    <section className="crm-panel crm-ck-log" aria-labelledby="crm-ck-log-h">
      <h2 id="crm-ck-log-h">Log</h2>
      {!canEdit && <p className="crm-muted">Only the owner or a manager can log on this lead.</p>}
      <form onSubmit={submit}>
        <fieldset disabled={!canEdit || busy}>
          <div className="crm-ck-types" role="radiogroup" aria-label="What happened">
            {LOGGABLE_TYPES.map((t) => (
              <label key={t} className={`crm-chip${type === t ? " on" : ""}`}>
                <input type="radio" name="crm-log-type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                {TYPE_LABEL[t]}
              </label>
            ))}
          </div>
          {isEmail && (
            <label className="crm-ck-field">
              <span>Subject</span>
              <input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} autoComplete="off" />
            </label>
          )}
          <label className="crm-ck-field">
            <span>{type === "NOTE" ? "Note" : isEmail ? "Message (optional with a subject)" : "What was said"}</span>
            <textarea value={body} maxLength={4000} rows={4} onChange={(e) => setBody(e.target.value)} />
          </label>
          <div className="crm-ck-logrow">
            <label className="crm-ck-field">
              <span>When (empty = now)</span>
              <input type="datetime-local" value={when} max={localInputValue(new Date())} onChange={(e) => setWhen(e.target.value)} />
            </label>
            {type !== "NOTE" && (
              <label className="crm-ck-check">
                <input type="checkbox" checked={inbound || replied} disabled={inbound} onChange={(e) => setReplied(e.target.checked)} />
                <span>The lead replied</span>
              </label>
            )}
            <button type="submit" className="crm-btn primary" disabled={!ready}>{busy ? "Saving…" : "Log"}</button>
          </div>
          {error && <p className="crm-ck-error" role="alert">{error}</p>}
        </fieldset>
      </form>
      {toast.node}
    </section>
  );
}
