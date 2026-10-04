"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasUnsavedEdit } from "@/lib/admin/unsavedEdit";

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
 * - It skips a tick while a focused field holds an unsaved edit (see
 *   hasUnsavedEdit). router.refresh() keeps client state, but a server-rendered
 *   defaultValue re-arriving under a half-typed follow-up date is exactly the
 *   kind of small betrayal that makes people stop trusting a screen. Merely
 *   having the cursor in a field — the search box after a search — must not
 *   pause the refresh: that is how a lead trashed from the MCP connector went
 *   unnoticed until a manual reload (2026-09-09).
 */
export default function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (hasUnsavedEdit(document.activeElement as HTMLInputElement | null)) return;
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
