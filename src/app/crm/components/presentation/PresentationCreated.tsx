"use client";
import { useEffect, useState, useTransition } from "react";
import { presentationWhatsAppStatusAction, sendPresentationWhatsAppAction } from "@/app/crm/leads/presentationSendActions";

// Result screen after a selection was created: link, QR and the share
// buttons (copy, WhatsApp, WhatsApp via the CRM's own number, email). The QR
// SVG is generated server-side by the qrcode library from our own URL.

export type CreatedPresentation = { id: string; token: string; url: string; qrSvg: string; whatsappUrl: string | null };

type WaState =
  | { kind: "checking" }
  | { kind: "unavailable"; reason: string }
  | { kind: "ready"; text: string }
  | { kind: "confirm"; text: string }
  | { kind: "sent"; message: string };

export function PresentationCreated({ leadId, created, hasEmail, onEmail, onClose }: {
  leadId: string; created: CreatedPresentation; hasEmail: boolean; onEmail: () => void; onClose: () => void;
}) {
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);
  // "Send via WhatsApp (CRM)" is clickable only when the server's send guards
  // (phone on file, an existing chat, the daily cap) would let it through.
  const [wa, setWa] = useState<WaState>({ kind: "checking" });
  const [waError, setWaError] = useState<string | null>(null);
  const [waPending, startWa] = useTransition();
  useEffect(() => {
    let live = true;
    presentationWhatsAppStatusAction(leadId, created.token)
      .then((r) => { if (live) setWa(r.available ? { kind: "ready", text: r.text } : { kind: "unavailable", reason: r.reason }); })
      .catch(() => { if (live) setWa({ kind: "unavailable", reason: "Could not check WhatsApp right now." }); });
    return () => { live = false; };
  }, [leadId, created.token]);
  function sendWa() {
    setWaError(null);
    startWa(async () => {
      try {
        const r = await sendPresentationWhatsAppAction(leadId, created.token);
        if ("error" in r) setWaError(r.error); else setWa({ kind: "sent", message: r.ok });
      } catch { setWaError("Could not reach the server. Check your connection and try again."); }
    });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(created.url); setCopied("ok"); } catch { setCopied("error"); }
  }
  return (
    <div className="crm-pres-created">
      <h2 id="crm-pres-h">Presentation created</h2>
      <div className="crm-pres-createdrow">
        <div className="crm-pres-qr" dangerouslySetInnerHTML={{ __html: created.qrSvg }} />
        <div className="crm-pres-link">
          <span className="crm-muted">Link</span>
          <a href={created.url} target="_blank" rel="noopener noreferrer">{created.url}</a>
        </div>
      </div>
      <div className="crm-pres-share">
        <button type="button" className="crm-btn" onClick={() => void copy()}>Copy link</button>
        {created.whatsappUrl && (
          <a className="crm-btn" href={created.whatsappUrl} target="_blank" rel="noopener noreferrer">Share via WhatsApp</a>
        )}
        <button
          type="button" className="crm-btn"
          disabled={wa.kind !== "ready"}
          title={wa.kind === "unavailable" ? wa.reason : wa.kind === "checking" ? "Checking WhatsApp…" : wa.kind === "sent" ? "Already sent" : undefined}
          onClick={() => { if (wa.kind === "ready") setWa({ kind: "confirm", text: wa.text }); }}
        >Send via WhatsApp (CRM)</button>
        <button type="button" className="crm-btn" disabled={!hasEmail} title={hasEmail ? undefined : "No email on file"} onClick={onEmail}>Send by email</button>
        <span className="crm-pres-copied" aria-live="polite">
          {copied === "ok" ? "Copied" : copied === "error" ? <span className="crm-dialog-error">Could not copy the link.</span> : null}
        </span>
      </div>
      {wa.kind === "unavailable" && <p className="crm-muted crm-pres-hint">WhatsApp via CRM: {wa.reason}</p>}
      {wa.kind === "confirm" && (
        <div className="crm-pres-waconfirm">
          <span className="crm-muted">This message goes to the client from the company WhatsApp number:</span>
          <pre>{wa.text}</pre>
          {waError && <p className="crm-dialog-error" role="alert">{waError}</p>}
          <div className="crm-pres-share">
            <button type="button" className="crm-btn primary" onClick={sendWa} disabled={waPending}>{waPending ? "Sending…" : "Send now"}</button>
            <button type="button" className="crm-btn quiet" onClick={() => { setWaError(null); setWa({ kind: "ready", text: wa.text }); }} disabled={waPending}>Cancel</button>
          </div>
        </div>
      )}
      {wa.kind === "sent" && <p className="crm-pres-done">{wa.message}</p>}
      <div className="crm-dialog-actions">
        <button type="button" className="crm-btn primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
