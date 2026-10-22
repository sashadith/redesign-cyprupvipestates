"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cssVars, isDarkSet, type GlobalSettings, type SetValues } from "@/lib/design/theme";
import { PREVIEW_TYPE, isPreviewReady, type PreviewMessage } from "@/app/crm-preview/previewMessage";
import { previewEmailAction } from "./actions";

// The three live preview panes of the design page, showing the unsaved draft.
// CRM and portal: same-origin frames at /crm-preview/*; the draft goes in by postMessage
// (debounced 100 ms, and once more whenever a frame has loaded or its bridge says it is ready).
// Email: the server renders the partner "account approved" mail in the draft (debounced 400 ms)
// into a fully sandboxed srcdoc.
const FRAME_DEBOUNCE_MS = 100;
const EMAIL_DEBOUNCE_MS = 400;

export function DesignPreview({ draft, global }: { draft: SetValues; global: GlobalSettings }) {
  const crm = useRef<HTMLIFrameElement>(null);
  const portal = useRef<HTMLIFrameElement>(null);
  const message = useMemo<PreviewMessage>(() => ({ type: PREVIEW_TYPE, vars: cssVars(draft, global), dark: isDarkSet(draft) }), [draft, global]);
  const latest = useRef(message);
  latest.current = message;

  const post = useCallback((frame: HTMLIFrameElement | null) => {
    frame?.contentWindow?.postMessage(latest.current, window.location.origin);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => { post(crm.current); post(portal.current); }, FRAME_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [message, post]);

  // A frame whose bridge started listening asks for the draft; answer only our own two frames.
  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !isPreviewReady(event.data)) return;
      for (const f of [crm.current, portal.current]) if (f && f.contentWindow === event.source) post(f);
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, [post]);

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
      <div className="crm-ds-frames">
        <figure>
          <figcaption>CRM</figcaption>
          <iframe id="ds-prev-crm" ref={crm} title="CRM preview" src="/crm-preview/crm" onLoad={() => post(crm.current)} />
        </figure>
        <figure>
          <figcaption>Partner portal</figcaption>
          <iframe id="ds-prev-portal" ref={portal} title="Partner portal preview" src="/crm-preview/portal" onLoad={() => post(portal.current)} />
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
