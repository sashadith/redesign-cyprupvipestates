"use client";
import { useState } from "react";

// Result screen after an edit was saved: same link, the "updated" WhatsApp
// message, and what changed. Nothing is sent to the client automatically.

export type SavedPresentation = { url: string; whatsappUrl: string | null; summary: string };

export function PresentationSaved({ saved, onClose }: { saved: SavedPresentation; onClose: () => void }) {
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(saved.url); setCopied("ok"); } catch { setCopied("error"); }
  }
  return (
    <div className="crm-pres-created">
      <h2 id="crm-pres-h">Changes saved</h2>
      <p className="crm-pres-summary">Saved — {saved.summary}</p>
      <p className="crm-muted">No message was sent to the client. Use the buttons below to let them know, if you like.</p>
      <div className="crm-pres-link">
        <span className="crm-muted">Link</span>
        <a href={saved.url} target="_blank" rel="noopener noreferrer">{saved.url}</a>
      </div>
      <div className="crm-pres-share">
        <button type="button" className="crm-btn" onClick={() => void copy()}>Copy link</button>
        {saved.whatsappUrl && (
          <a className="crm-btn" href={saved.whatsappUrl} target="_blank" rel="noopener noreferrer">Share via WhatsApp</a>
        )}
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
