"use client";

import Script from "next/script";
import { useTrackingAllowed } from "@/lib/useTrackingAllowed";

const LINKEDIN_PARTNER_ID = "10107329";

/**
 * LinkedIn Insight Tag.
 *
 * Only on a production hostname, for the same reason as the Meta pixel and the
 * Google Ads tag: the partner id is compiled into the bundle, so before
 * 2026-10-22 a dev server contributed to the live LinkedIn audience. And more
 * than page views did — LinkedInConversionTracker fires a LinkedIn CONVERSION
 * on every project page (27871513) and every blog page (27871521), and the
 * forms fire 27871505 on submit. All of that was reported from laptops too.
 * See useTrackingAllowed().
 *
 * Suppressing this tag cannot break those call sites: every `lintrk` caller in
 * the app is written `typeof window.lintrk === "function"`, and when this
 * component declines, the queue stub below is never created, so they no-op.
 */
export default function LinkedInPixel() {
  const allowed = useTrackingAllowed();
  if (!allowed) return null;

  return (
    <>
      <Script id="linkedin-pixel-1" strategy="afterInteractive">
        {`
          _linkedin_partner_id = "${LINKEDIN_PARTNER_ID}";
          window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
          window._linkedin_data_partner_ids.push(_linkedin_partner_id);
        `}
      </Script>

      <Script id="linkedin-pixel-2" strategy="afterInteractive">
        {`
          (function(l) {
            if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
            window.lintrk.q=[]}
            var s = document.getElementsByTagName("script")[0];
            var b = document.createElement("script");
            b.type = "text/javascript";b.async = true;
            b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
            s.parentNode.insertBefore(b, s);
          })(window.lintrk);
        `}
      </Script>
    </>
  );
}
