"use client";

import { useEffect, useState } from "react";
import { isTrackingHost } from "@/lib/trackingHost";

/**
 * May this page load third-party advertising tags?
 *
 * False until proven otherwise, because every vendor id in this app is compiled
 * into the bundle: until 2026-10-22 a `npm run dev` on a laptop reported into
 * the live Meta dataset, Google Ads account and LinkedIn pixel the moment a
 * page opened. Meta's host breakdown measured the Meta half — 310 events from
 * `localhost` in one hour on 26 September, 30 of them InitiateCheckout against
 * 69 in the whole 28-day window. See src/lib/trackingHost.ts.
 *
 * The answer can only be given after mount, and that is the load-bearing part:
 * there is no `window` during SSR, and a server-rendered <Script> is already in
 * the browser's hands before any check could refuse it. Starting at false means
 * the server and the client's first pass agree on rendering nothing, so there is
 * no hydration mismatch and nothing to reconcile a tag back in. The tags are
 * all `afterInteractive` anyway, so one effect's delay costs nothing.
 */
export function useTrackingAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(isTrackingHost(window.location.hostname));
  }, []);

  return allowed;
}
