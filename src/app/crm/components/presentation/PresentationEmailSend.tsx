"use client";
import { useState, useTransition } from "react";
import { confirmPresentationEmailAction, requestPresentationEmailCodeAction } from "@/app/crm/leads/presentationSendActions";

// "Send by email" for a freshly created selection, in the CRM's own look
// (replaces the white admin ComposeEmailModal here). Two steps since
// 2026-11-03: Send mails the operator a preview with a 6-character approval
// code; only that code, typed back here, sends the email to the client.

type Step = { kind: "compose" } | { kind: "code"; draftId: string; codeSentTo: string } | { kind: "done"; message: string };

export function PresentationEmailSend({ leadId, leadEmail, token, initialSubject, initialBody, onBack, onSent }: {
  leadId: string; leadEmail: string; token: string; initialSubject: string; initialBody: string;
  onBack: () => void; onSent: () => void;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>({ kind: "compose" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function requestCode() {
    setError(null);
    start(async () => {
      try {
        const r = await requestPresentationEmailCodeAction(leadId, { subject: subject.trim(), body: body.trim(), presentationToken: token });
        if ("error" in r) { setError(r.error); return; }
        setCode("");
        setStep({ kind: "code", draftId: r.draftId, codeSentTo: r.codeSentTo });
      } catch { setError("Could not reach the server. Check your connection and try again."); }
    });
  }

  function confirm(draftId: string) {
    setError(null);
    start(async () => {
      try {
        const r = await confirmPresentationEmailAction(leadId, { draftId, code, presentationToken: token });
        if ("error" in r) { setError(r.error); return; }
        setStep({ kind: "done", message: r.ok });
        onSent();
      } catch { setError("Could not reach the server. Check your connection and try again."); }
    });
  }

  return (
    <div className="crm-pres-created crm-pres-mail">
      <h2 id="crm-pres-h">Send by email</h2>
      <div className="crm-pres-mailto"><span className="crm-muted">To</span> {leadEmail}</div>

      {step.kind === "compose" && (
        <>
          <label htmlFor="crm-pres-subj">Subject</label>
          <input id="crm-pres-subj" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <label htmlFor="crm-pres-body">Message</label>
          <textarea id="crm-pres-body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="crm-muted crm-pres-hint">Your email signature is added when it is sent. Send first mails you a preview with an approval code; the email goes to the client only after you enter that code here.</p>
        </>
      )}

      {step.kind === "code" && (
        <>
          <p>The preview with the approval code went to <strong>{step.codeSentTo}</strong>. Check it, then enter the code to send the email to the client.</p>
          <label htmlFor="crm-pres-code">Approval code</label>
          <input
            id="crm-pres-code" className="crm-pres-code" value={code} autoFocus autoComplete="one-time-code" maxLength={9}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter" && code.trim()) { e.preventDefault(); confirm(step.draftId); } }}
          />
        </>
      )}

      {step.kind === "done" && <p className="crm-pres-sent">{step.message}</p>}

      {error && <p className="crm-dialog-error" role="alert">{error}</p>}

      <div className="crm-dialog-actions">
        {step.kind === "compose" && (
          <>
            <button type="button" className="crm-btn quiet" onClick={onBack} disabled={pending}>Back</button>
            <button type="button" className="crm-btn primary" onClick={requestCode} disabled={pending || !subject.trim() || !body.trim()}>
              {pending ? "Sending code…" : "Send"}
            </button>
          </>
        )}
        {step.kind === "code" && (
          <>
            <button type="button" className="crm-btn quiet" onClick={() => { setError(null); setStep({ kind: "compose" }); }} disabled={pending}>Edit email</button>
            <button type="button" className="crm-btn primary" onClick={() => confirm(step.draftId)} disabled={pending || !code.trim()}>
              {pending ? "Sending…" : "Send to client"}
            </button>
          </>
        )}
        {step.kind === "done" && <button type="button" className="crm-btn primary" onClick={onBack}>Back</button>}
      </div>
    </div>
  );
}
