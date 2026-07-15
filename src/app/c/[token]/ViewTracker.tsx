"use client";

import { useEffect, useRef } from "react";

/* Records the page-level PresentationView on mount and sends the viewed
   duration via sendBeacon when the tab is hidden/closed (best effort — a
   beacon can't guarantee delivery, but it's the standard way to catch
   "closed the tab" that a normal fetch in an unmount handler would miss). */
export default function ViewTracker({ token }: { token: string }) {
  const viewIdRef = useRef<string | null>(null);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    let alive = true;
    fetch(`/api/c/${token}/view`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ developmentId: null }) })
      .then((r) => r.json())
      .then((d) => { if (alive && d?.id) viewIdRef.current = d.id; })
      .catch(() => {});

    const sendDuration = () => {
      if (!viewIdRef.current) return;
      const durationSec = Math.round((Date.now() - startRef.current) / 1000);
      const payload = JSON.stringify({ viewId: viewIdRef.current, durationSec });
      navigator.sendBeacon?.(`/api/c/${token}/view`, new Blob([payload], { type: "application/json" }));
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") sendDuration(); };
    window.addEventListener("pagehide", sendDuration);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      window.removeEventListener("pagehide", sendDuration);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token]);

  return null;
}
