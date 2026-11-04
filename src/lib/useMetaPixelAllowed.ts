"use client";

import { useEffect, useState } from "react";
import { isTrackingHost } from "@/lib/trackingHost";
import { isAutomatedVisitor, metaPixelEnabled } from "@/lib/metaPixelGate";

/**
 * May this page load the Meta pixel? The host guard of useTrackingAllowed()
 * plus the build switch and the bot check from metaPixelGate.ts.
 *
 * Same shape and same reason as useTrackingAllowed: false on the server and on
 * the client's first pass, decided in an effect, so nothing is rendered that
 * would have to be taken back. Consent is decided by the caller's parent (the
 * consent branch of [lang]/layout.tsx and ConsentScripts).
 */
export function useMetaPixelAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(
      metaPixelEnabled() &&
        isTrackingHost(window.location.hostname) &&
        !isAutomatedVisitor(window.navigator),
    );
  }, []);

  return allowed;
}
