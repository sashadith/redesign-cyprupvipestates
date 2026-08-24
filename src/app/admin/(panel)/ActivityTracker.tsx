"use client";
import { useEffect } from "react";

// Working-hours heartbeat (2026-08-24). Beats POST /api/admin/activity-ping
// once a minute, but ONLY while both hold:
//   1. the tab is actually visible (a backgrounded/minimized admin tab is
//      not work, even if something on the page is technically running), and
//   2. the user produced real input — pointer, keyboard, scroll, touch —
//      within the last IDLE_MS. This is the agreed rule: no interaction for
//      3 minutes means the tab is dead and stops counting, even if it stays
//      open all day.
// Consequence for the report (src/lib/adminActivityReport.ts): beats stop at
// most IDLE_MS after the last real input, so an abandoned tab adds at most
// those 3 minutes before its session closes — it can never accumulate hours.
//
// Mounted once in PanelLayout; App Router keeps the layout instance alive
// across client-side navigation, so the interval and listeners persist and
// navigation itself lands as pointer/keyboard input like everything else.
const IDLE_MS = 3 * 60_000;
const BEAT_MS = 60_000;
// mousemove fires continuously; sampling it every few seconds is plenty to
// register "hand on mouse" without doing work on every pixel of travel.
const MOVE_SAMPLE_MS = 5_000;

export default function ActivityTracker() {
  useEffect(() => {
    let lastInput = Date.now();
    let lastMove = 0;
    const markInput = () => { lastInput = Date.now(); };
    const onMove = () => {
      const now = Date.now();
      if (now - lastMove >= MOVE_SAMPLE_MS) { lastMove = now; lastInput = now; }
    };
    const listeners: [string, EventListener][] = [
      ["pointerdown", markInput],
      ["keydown", markInput],
      ["wheel", markInput],
      ["touchstart", markInput],
      ["mousemove", onMove],
    ];
    listeners.forEach(([ev, fn]) => window.addEventListener(ev, fn, { passive: true }));

    const beat = () => {
      // keepalive so a beat fired right before tab close still goes out.
      fetch("/api/admin/activity-ping", { method: "POST", keepalive: true }).catch(() => {});
    };

    beat(); // opening the panel is itself activity — start the session at t=0, not t=1min
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInput >= IDLE_MS) return; // dead-tab rule
      beat();
    }, BEAT_MS);

    return () => {
      clearInterval(interval);
      listeners.forEach(([ev, fn]) => window.removeEventListener(ev, fn));
    };
  }, []);
  return null;
}
