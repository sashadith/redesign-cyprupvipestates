"use client";

import { useEffect } from "react";
import { newMetaEventId } from "@/lib/metaEventId";

/**
 * Meta pixel ViewContent for one property page.
 *
 * Until 2026-10-17 this component existed but never fired on the pages that
 * matter. It sat in src/app/[lang]/projects/[slug]/page.tsx AFTER the branch
 * that renders a Development and returns — so all 370 published developments
 * rendered without it, and only the legacy Project branch behind it could
 * reach it. Meta's own numbers confirmed it before this was changed: over
 * seven days the dataset recorded ~900 PageView, 5 InitiateCheckout, 2 Lead,
 * 1 Contact and ZERO ViewContent. It now renders from ProjectPageBody, which
 * is the component the development branch actually returns.
 *
 * Three things here are load-bearing and easy to get subtly wrong:
 *
 * 1. `contentId` must be the Development row's UUID — the same key the Xellex
 *    bridge uses and the same one a Meta catalog would carry. The page's view
 *    model exposes `id` as the VENDOR's feedProjectId, which is a different
 *    string and changes when a project moves source. Pixel ids that disagree
 *    with catalog ids match nothing while both sides look healthy.
 * 2. `content_type` is "home_listing", Meta's real-estate vertical. The old
 *    value was "property", which is not a vertical Meta knows; a catalog would
 *    never have matched it.
 * 3. `eventID` belongs in fbq's FOURTH argument, not inside the event payload.
 *    Inside the payload it is just an unused custom parameter, and the
 *    deduplication it exists for — against a future Conversions API send of the
 *    same event — would silently not happen.
 */
type Props = {
  title: string;
  /** Development.id (UUID). NOT the view model's `id`, which is feedProjectId. */
  contentId: string;
  price?: number | null;
  city?: string;
  propertyType?: string;
};

// The pixel is injected with next/script strategy="afterInteractive", i.e.
// AFTER hydration — and this effect runs DURING it. So on a cold page load
// window.fbq does not exist yet when we first look, and the original
// `if (!window.fbq) return` gave up permanently at that moment.
//
// Measured over seven days before this was fixed: Meta recorded 966 PageView
// against our own 1,695 real views (57% — normal attrition from ad blockers
// and tracking protection) but only 6 ViewContent against 670 project-page
// views, which is 0.9%. The handful that did arrive were almost certainly
// client-side navigations, where fbq was already present from the previous
// page. Anyone arriving from Google — the majority — reported nothing.
//
// Polling rather than a load callback: next/script's onLoad is not reachable
// from here, and the queue stub the pixel snippet defines is itself only
// created once that script runs. 100ms for up to 10s covers a slow connection
// without keeping a timer alive on a page nobody is looking at.
const FBQ_POLL_MS = 100;
const FBQ_MAX_WAIT_MS = 10_000;

export default function MetaViewContentTracker({ title, contentId, price, city, propertyType }: Props) {
  useEffect(() => {
    if (typeof window === "undefined" || !contentId) return;
    let cancelled = false;
    let waited = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const fire = () => {
      // Read through a local so the existence check is visible to the caller
      // sweep in trackingTagCallerSafety.test.ts, which cannot see through a
      // `window.fbq!(...)` non-null assertion. This check can never be what
      // silences the event — attempt() below only calls fire() once fbq is
      // there, and keeps polling until then. Do not turn it into an early
      // return from the effect: that was the 2026-10-17 bug.
      const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
      if (typeof fbq !== "function") return;
      fbq(
        "track",
        "ViewContent",
        {
          content_name: title,
          content_ids: [contentId],
          content_type: "home_listing",
          value: typeof price === "number" ? price : 0,
          currency: "EUR",
          city: city || "",
          property_type: propertyType || "",
        },
        // Built at send time, never at render: an id baked into a cached server
        // payload would repeat across visitors (see src/lib/metaEventId.ts).
        { eventID: newMetaEventId("vc") },
      );
    };

    const attempt = () => {
      if (cancelled) return;
      if (typeof window.fbq === "function") { fire(); return; }
      waited += FBQ_POLL_MS;
      // Give up silently past the ceiling: a visitor who blocks the pixel is a
      // normal outcome, not an error worth reporting.
      if (waited >= FBQ_MAX_WAIT_MS) return;
      timer = setTimeout(attempt, FBQ_POLL_MS);
    };
    attempt();

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [title, contentId, price, city, propertyType]);

  return null;
}
