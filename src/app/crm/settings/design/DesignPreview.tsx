"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cssVars, isDarkSet, type GlobalSettings, type SetValues } from "@/lib/design/theme";
import { draftStyleText, toPreviewSrcdoc } from "@/app/crm-preview/previewSrcdoc";
import { previewEmailAction } from "./actions";

// The three live preview panes of the design page, showing the unsaved draft.
// CRM and portal (controller ruling R10, nginx sends X-Frame-Options: DENY): the static sample
// pages at /crm-preview/* are fetched once per mount, stripped of scripts and shown as srcdoc
// (same-origin, no sandbox). The draft is written straight into each pane as
// <style id="ds-draft"> plus `ds-dark` on <html>/<body>: on load, and debounced 100 ms on changes.
// Email: the server renders the partner "account approved" mail in the draft (debounced 400 ms)
// into a fully sandboxed srcdoc.
const FRAME_DEBOUNCE_MS = 100;
const EMAIL_DEBOUNCE_MS = 400;
const PANES = { crm: "/crm-preview/crm", portal: "/crm-preview/portal" } as const;
type Pane = keyof typeof PANES;

function applyDraft(frame: HTMLIFrameElement | null, vars: string, dark: boolean) {
  const doc = frame?.contentDocument;
  const text = draftStyleText(vars);
  if (!doc?.head || !doc.body || text === null) return;
  let style = doc.getElementById("ds-draft");
  if (!style) {
    style = doc.createElement("style");
    style.id = "ds-draft";
    doc.head.appendChild(style);
  }
  style.textContent = text;
  doc.documentElement.classList.toggle("ds-dark", dark);
  doc.body.classList.toggle("ds-dark", dark);
}

export function DesignPreview({ draft, global }: { draft: SetValues; global: GlobalSettings }) {
  const crm = useRef<HTMLIFrameElement>(null);
  const portal = useRef<HTMLIFrameElement>(null);
  const message = useMemo(() => ({ vars: cssVars(draft, global), dark: isDarkSet(draft) }), [draft, global]);
  const latest = useRef(message);
  latest.current = message;

  const apply = useCallback((frame: HTMLIFrameElement | null) => applyDraft(frame, latest.current.vars, latest.current.dark), []);

  // The sample pages, once per mount; edits only rewrite the draft style inside them.
  const [docs, setDocs] = useState<Partial<Record<Pane, string>>>({});
  const [frameError, setFrameError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    for (const pane of Object.keys(PANES) as Pane[]) {
      fetch(PANES[pane], { credentials: "same-origin", cache: "no-store" })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((html) => { if (alive) setDocs((d) => ({ ...d, [pane]: toPreviewSrcdoc(html) })); })
        .catch((e) => {
          console.error("[design preview]", pane, e);
          if (alive) setFrameError("Could not load the CRM and portal previews. Reload the page to try again.");
        });
    }
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => { apply(crm.current); apply(portal.current); }, FRAME_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [message, apply]);

  const [emailHtml, setEmailHtml] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const emailSeq = useRef(0);
  useEffect(() => {
    const seq = ++emailSeq.current;
    const t = window.setTimeout(async () => {
      try {
        const r = await previewEmailAction(draft, global);
        if (seq !== emailSeq.current) return; // a newer draft is already on its way
        if (r.ok) { setEmailHtml(r.html); setEmailError(null); }
        else setEmailError(r.error);
      } catch {
        if (seq === emailSeq.current) setEmailError("Could not render the email preview.");
      }
    }, EMAIL_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [draft, global]);

  return (
    <section className="crm-panel crm-ds-preview" aria-label="Preview">
      <h2>Preview</h2>
      <p className="crm-muted crm-ds-note">Shows the unsaved changes. Nothing changes for anyone until you save.</p>
      {frameError && <p className="crm-ck-error" role="alert">{frameError}</p>}
      <div className="crm-ds-frames">
        <figure>
          <figcaption>CRM</figcaption>
          <iframe id="ds-prev-crm" ref={crm} title="CRM preview" srcDoc={docs.crm} onLoad={() => apply(crm.current)} />
        </figure>
        <figure>
          <figcaption>Partner portal</figcaption>
          <iframe id="ds-prev-portal" ref={portal} title="Partner portal preview" srcDoc={docs.portal} onLoad={() => apply(portal.current)} />
        </figure>
        <figure>
          <figcaption>Partner email</figcaption>
          <iframe id="ds-prev-email" title="Partner email preview" sandbox="" srcDoc={emailHtml} />
          {emailError && <em className="crm-rate-err" role="alert">{emailError}</em>}
        </figure>
      </div>
    </section>
  );
}
