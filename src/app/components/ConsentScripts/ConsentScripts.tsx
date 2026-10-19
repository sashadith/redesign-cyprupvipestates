"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { GoogleTagManager } from "@next/third-parties/google";
import MicrosoftClarity from "../MicrosoftClarity/MicrosoftClarity";
import GoogleAdsScript from "../GoogleAdsScript/GoogleAdsScript";
import FacebookPixel from "../FacebookPixel/FacebookPixel";
import LinkedInPixel from "../LinkedInPixel/LinkedInPixel";

/* Consent-gated tracking tags for the STATIC homepage tree (home-static). The dynamic [lang] layout
   picks the same set on the server from the cookieConsent cookie; a statically generated page cannot
   read cookies, so the choice is made here after mount. CustomCookieConsent dispatches
   CONSENT_EVENT when the visitor answers the banner (router.refresh() cannot re-render a cached page). */
export const CONSENT_EVENT = "cvp:consent-changed";

function readAnalytics(): boolean {
  try {
    const raw = Cookies.get("cookieConsent");
    return raw ? JSON.parse(raw)?.analytics === true : false;
  } catch {
    return false;
  }
}

export default function ConsentScripts({ disableTracking }: { disableTracking: boolean }) {
  const [ready, setReady] = useState(false);
  const [hasAnalytics, setHasAnalytics] = useState(false);

  useEffect(() => {
    const sync = () => {
      setHasAnalytics(readAnalytics());
      setReady(true);
    };
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  if (!ready) return null;

  return hasAnalytics ? (
    <>
      {!disableTracking && <MicrosoftClarity hasConsent={true} />}
      <GoogleTagManager gtmId="GTM-MQNF6L9V" />
      <GoogleAdsScript />
      {!disableTracking && <FacebookPixel />}
      <LinkedInPixel />
    </>
  ) : (
    // Without consent Clarity still initialises, in its "no consent" mode (same as the dynamic layout).
    !disableTracking && <MicrosoftClarity hasConsent={false} />
  );
}
