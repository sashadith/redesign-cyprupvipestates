"use client";
import { useState } from "react";

// Result screen after a selection was created: link, QR and the share
// buttons (copy, WhatsApp, email). The QR SVG is generated server-side by the
// qrcode library from our own URL.

export type CreatedPresentation = { id: string; token: string; url: string; qrSvg: string; whatsappUrl: string | null };

export function PresentationCreated({ created, hasEmail, onEmail, onClose }: {
  created: CreatedPresentation; hasEmail: boolean; onEmail: () => void; onClose: () => void;
}) {
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);
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
        <button type="button" className="crm-btn" disabled={!hasEmail} title={hasEmail ? undefined : "No email on file"} onClick={onEmail}>Send by email</button>
        <span className="crm-pres-copied" aria-live="polite">
          {copied === "ok" ? "Copied" : copied === "error" ? <span className="crm-dialog-error">Could not copy the link.</span> : null}
        </span>
      </div>
      <div className="crm-dialog-actions">
        <button type="button" className="crm-btn primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
