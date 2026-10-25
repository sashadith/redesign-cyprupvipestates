"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Meta pixel `PageView` for client-side navigations.
 *
 * The pixel's own `PageView` sits inline in the snippet FacebookPixel renders,
 * so it runs exactly once per document load. On this site most page changes are
 * not document loads — they are App Router navigations, where the snippet never
 * runs again — so Meta heard about the landing page and nothing after it, while
 * our own first-party tracker (AnalyticsTracker) beacons on every navigation.
 *
 * That difference was measurable and it was being misread. Over the full day of
 * 2026-10-23 Meta recorded 129 `PageView` against our 188 real views (69 %), and
 * the shortfall was attributed to ad blockers and tracking protection. Part of
 * it is simply this: views the pixel was never asked to report. Until both sides
 * count the same thing, any comparison between them measures the gap in the
 * instrument rather than anything about visitors — which matters now, because
 * that comparison is about to decide whether a Conversions API gets built.
 *
 * No `eventID` here, deliberately. A deduplication key is only worth carrying
 * when a server-side copy of the same event could arrive, and `PageView` is the
 * one event never going through the Conversions API: Meta advises against
 * duplicating it, and its value lies in the conversions, not the traffic.
 *
 * Renders next to FacebookPixel in both trees — `[lang]/layout.tsx` and
 * ConsentScripts for the static homepage — because the consent gate and the
 * host guard both live there, and a tag that outlives either of them is the
 * bug this repo spent 2026-10-22 removing.
 */
export default function MetaPageViewTracker() {
  const pathname = usePathname();
  /** The last path reported, or null before this component has seen one. */
  const reported = useRef<string | null>(null);

  useEffect(() => {
    // usePathname() returns null without the router context; the effect must
    // not treat that as a navigation.
    if (!pathname) return;

    // The first path this component sees belongs to the document the inline
    // snippet already reported. Record it and send nothing — otherwise every
    // cold load counts twice, which is worse than the gap being fixed.
    if (reported.current === null) {
      reported.current = pathname;
      return;
    }
    if (reported.current === pathname) return;
    reported.current = pathname;

    // Read through a local, like trackBrochureOpen: when the host guard or the
    // consent gate declined, window.fbq simply never exists.
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (typeof fbq !== "function") return;
    fbq("track", "PageView");
  }, [pathname]);

  return null;
}
