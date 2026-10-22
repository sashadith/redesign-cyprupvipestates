"use client";

import { GoogleTagManager } from "@next/third-parties/google";
import { useTrackingAllowed } from "@/lib/useTrackingAllowed";

const GTM_ID = "GTM-MQNF6L9V";

/**
 * The GTM container, on a production hostname only.
 *
 * A thin wrapper exists because `<GoogleTagManager>` comes from
 * @next/third-parties and cannot carry the guard itself, and because the two
 * places that render it are a SERVER component ([lang]/layout.tsx) and a client
 * one (ConsentScripts) — a hook cannot go in the former.
 *
 * This is the container that matters most of the three tags: GA4
 * (G-WLD3B6GN9P) runs exclusively through GTM, the direct gtag wrapper having
 * been removed to stop duplicate page_views. So until 2026-10-22 every
 * developer's `npm run dev` was also writing into GA4, the same way it was
 * writing into the Meta dataset — see src/lib/trackingHost.ts for the hour on
 * 26 September where `localhost` produced 310 Meta events, 30 of them
 * InitiateCheckout against 69 in the whole 28-day window.
 *
 * Suppressing the container cannot break a caller: GTM is what creates
 * `window.dataLayer`, and all 19 `dataLayer.push` sites in the app check for it
 * first (asserted in trackingTagCallerSafety.test.ts). Their events are simply
 * not collected on a dev machine, which is the point.
 */
export default function GoogleTagManagerScript() {
  const allowed = useTrackingAllowed();
  if (!allowed) return null;

  return <GoogleTagManager gtmId={GTM_ID} />;
}
