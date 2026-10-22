"use client";
import { useEffect } from "react";
import { READY_TYPE, isPreviewMessage } from "./previewMessage";

// Inside the /crm-preview frames: applies the draft the owner's design page posts in.
// Same-origin messages of the exact shape only (see previewMessage.ts). The draft goes into
// <style id="ds-draft"> as `:root{…}`, which wins over the zero-specificity :where(.crm-html) /
// :where(.pp-html) fallbacks in crm.css / portal.css (controller ruling R2: no DsStyle here).
// `ds-dark` goes on <html> as well as <body> so the root scrollbar follows a dark set.
export function PreviewBridge() {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !isPreviewMessage(event.data)) return;
      let style = document.getElementById("ds-draft");
      if (!style) {
        style = document.createElement("style");
        style.id = "ds-draft";
        document.head.appendChild(style);
      }
      style.textContent = `:root{${event.data.vars}}`;
      document.documentElement.classList.toggle("ds-dark", event.data.dark);
      document.body.classList.toggle("ds-dark", event.data.dark);
    };
    window.addEventListener("message", onMessage);
    // Ask the design page for the current draft (it may have posted before we listened).
    if (window.parent !== window) window.parent.postMessage({ type: READY_TYPE }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return null;
}
