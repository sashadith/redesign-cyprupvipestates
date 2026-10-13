"use client";

import { useEffect } from "react";

/**
 * Prints one line to the browser console on every admin page load, splitting the
 * wait into the part the server owns and the part the browser owns.
 *
 * It exists because "the admin is slow" was, until it was measured, equally
 * consistent with a slow VPS, slow queries, a slow render and a heavy bundle.
 * The server side turned out to be the Action Center (~2 s per page, now moved
 * off the critical path). This keeps the other half visible instead of assumed:
 * if the panel still feels slow after that, the numbers below say whether the
 * remaining time is the server rendering, the network, or JavaScript in the
 * browser — and nobody has to guess again.
 *
 * Console only, no UI, no network call of its own. `serverMs` is how long the
 * layout's own data gathering took; the rest comes from the Navigation Timing
 * API, which the browser has already recorded whether we read it or not.
 */
export default function AdminPerfProbe({ serverMs }: { serverMs: number }) {
  useEffect(() => {
    // requestAnimationFrame: measure after the browser has actually painted,
    // otherwise "interactive" is reported before anything is on screen.
    const id = requestAnimationFrame(() => {
      try {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (!nav) return;
        const ms = (n: number) => `${Math.round(n)}ms`;
        // ttfb covers server render + network; subtracting the layout's own
        // data time leaves render + transit, which is the part we cannot
        // instrument from inside React.
        const parts = [
          `layout-daten ${ms(serverMs)}`,
          `ttfb ${ms(nav.responseStart - nav.requestStart)}`,
          `html ${ms(nav.responseEnd - nav.responseStart)}`,
          `dom ${ms(nav.domContentLoadedEventEnd - nav.responseEnd)}`,
          `bis-paint ${ms(performance.now())}`,
        ];
        // eslint-disable-next-line no-console
        console.info(`[admin-perf] ${parts.join("  ·  ")}`);
      } catch {
        /* Navigation Timing is best-effort — never let a measurement break a page. */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [serverMs]);

  return null;
}
