"use client";

import Script from "next/script";
import { useTrackingAllowed } from "@/lib/useTrackingAllowed";

const FACEBOOK_PIXEL_ID = "1238429281352397";

/**
 * Meta pixel: init + PageView.
 *
 * Only on a production hostname. The id below is compiled into the bundle, so
 * before 2026-10-22 every checkout of this repo reported into the live dataset
 * as soon as a page was opened — and Meta's host breakdown shows what that
 * cost: on 26 September, 10:00 PDT, `localhost` alone produced 310 events,
 * among them 30 InitiateCheckout, against 69 InitiateCheckout in the entire
 * 28-day window. Roughly two in five of that conversion's volume was a
 * developer clicking through modals, and the audiences and optimisations built
 * on it were trained on exactly that.
 *
 * The host decision has to happen after mount — see useTrackingAllowed() for
 * why, and for the same guard on the Google Ads and LinkedIn tags.
 *
 * Nothing else needs a guard: every other fbq call site in the app is written
 * `if (window.fbq) …`, and when this component declines to init, `window.fbq`
 * simply never exists.
 */
const FacebookPixel = () => {
  // Hook first, then the early return — a hook inside the `if` condition is
  // legal but invites the next person to add one below the return.
  const allowed = useTrackingAllowed();
  if (!allowed) return null;

  return (
    <Script id="facebook-pixel" strategy="afterInteractive">
      {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${FACEBOOK_PIXEL_ID}');
          fbq('track', 'PageView');
        `}
    </Script>
  );
};

export default FacebookPixel;
