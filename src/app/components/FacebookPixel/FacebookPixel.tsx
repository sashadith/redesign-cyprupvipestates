"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { isTrackingHost } from "@/lib/trackingHost";

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
 * The host decision has to happen after mount. `window` does not exist during
 * SSR, and a server-rendered <Script> is already in the browser's hands before
 * any check could refuse it — so the component renders nothing on the server
 * and nothing on the client's first pass (state starts false, hence no
 * hydration mismatch), then mounts the tag once the hostname is known. The tag
 * is `afterInteractive` anyway, so the delay of one effect costs nothing.
 *
 * Nothing else needs a guard: every other fbq call site in the app is written
 * `if (window.fbq) …`, and when this component declines to init, `window.fbq`
 * simply never exists.
 */
const FacebookPixel = () => {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(isTrackingHost(window.location.hostname));
  }, []);

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
