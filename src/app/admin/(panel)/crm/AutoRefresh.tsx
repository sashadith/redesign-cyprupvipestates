"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* Re-runs the page's server components on an interval, so a lead changed
 * elsewhere — the MCP connector, another operator, a form submission — appears
 * without anyone pressing reload.
 *
 * Polling rather than server-sent events on purpose: the app runs under pm2
 * with two Node processes, so an event raised in one of them never reaches a
 * browser connected to the other. Pushing properly would mean routing events
 * through Postgres LISTEN/NOTIFY, which is the right answer if seconds ever
 * turn out to be too slow — but it is a lot of machinery for an internal tool
 * with a handful of users, and this is twenty lines.
 *
 * Two guards keep it from being a nuisance:
 *
 * - It stops entirely while the tab is hidden, and refreshes once immediately
 *   when it comes back. A background tab left open overnight costs nothing.
 * - It skips a tick while the focus is inside a field. router.refresh() keeps
 *   client state, but a server-rendered defaultValue re-arriving under a
 *   half-typed follow-up date is exactly the kind of small betrayal that makes
 *   people stop trusting a screen.
 */
export default function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable
      );
    };

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (isTyping()) return;
      router.refresh();
    };

    const start = () => {
      stop();
      timer = setInterval(tick, Math.max(3, seconds) * 1000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, seconds]);

  return null;
}
