"use client";

import Script from "next/script";
import { useTrackingAllowed } from "@/lib/useTrackingAllowed";

const GOOGLE_ADS_ID = "AW-16992138077";

/**
 * Google Ads global site tag.
 *
 * Only on a production hostname, for the same reason as the Meta pixel: the
 * conversion id is compiled into the bundle, so before 2026-10-22 any `npm run
 * dev` added the laptop's page views to the live Google Ads account — which is
 * what remarketing audiences are built from. See useTrackingAllowed().
 *
 * Nothing in the app calls `gtag()` itself — there are no conversion events
 * from this tag, only `config` — so suppressing it cannot break a call site.
 * `window.dataLayer`, which several components push to, is created by the GTM
 * container (GTM-MQNF6L9V) independently of this tag, and every one of those
 * push sites is written `if (window.dataLayer) …` regardless.
 */
export default function GoogleAdsScript() {
  const allowed = useTrackingAllowed();
  if (!allowed) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`} strategy="afterInteractive" />
      <Script id="google-ads-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GOOGLE_ADS_ID}');
        `}
      </Script>
    </>
  );
}
