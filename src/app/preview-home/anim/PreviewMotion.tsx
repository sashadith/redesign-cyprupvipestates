"use client";

import { useEffect } from "react";
import { prefersReducedMotion } from "@/lib/prefersReducedMotion";

/* Homepage motion orchestrator. The hero intro is plain CSS (tokens.css, .hero__* keyframes), so no
   animation library is needed for the first paint. The scroll-driven section animations live in
   ./sectionMotion (GSAP + ScrollTrigger + SplitText) and are imported only once the page has loaded
   and the browser is idle — or at the visitor's first scroll/touch/key, whichever comes first.
   Fully no-ops under prefers-reduced-motion (content shown as-is). Renders null. */
export default function PreviewMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    let cancelled = false;
    let started = false;
    let cleanup: (() => void) | undefined;
    let idleHandle: number | undefined;
    const inputs = ["scroll", "wheel", "touchstart", "keydown", "pointerdown"] as const;

    const detach = () => inputs.forEach((ev) => window.removeEventListener(ev, start));
    function start() {
      if (started) return;
      started = true;
      detach();
      import("./sectionMotion").then((m) => {
        if (!cancelled) cleanup = m.initSectionMotion();
      });
    }
    const onLoad = () => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) idleHandle = w.requestIdleCallback(start, { timeout: 3500 });
      else idleHandle = window.setTimeout(start, 1500);
    };

    inputs.forEach((ev) => window.addEventListener(ev, start, { passive: true, once: true }));
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      cancelled = true;
      detach();
      window.removeEventListener("load", onLoad);
      if (idleHandle !== undefined) {
        const w = window as Window & { cancelIdleCallback?: (h: number) => void };
        if (w.cancelIdleCallback) w.cancelIdleCallback(idleHandle);
        window.clearTimeout(idleHandle);
      }
      cleanup?.();
    };
  }, []);

  return null;
}
