"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureAttribution } from "@/lib/attribution";

// Cookieless first-party page-view beacon. Fires on first load and on every
// client navigation. No cookies, no consent required (no PII is stored).
export default function AnalyticsTracker({ locale }: { locale: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    const send = () => {
      captureAttribution(); // first-touch UTM / click-id / referrer, persisted for the session
      const payload = JSON.stringify({
        path: pathname,
        locale,
        referrer: document.referrer || "",
      });
      try {
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/analytics/track",
            new Blob([payload], { type: "application/json" }),
          );
        } else {
          fetch("/api/analytics/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          });
        }
      } catch {
        /* analytics must never break the page */
      }
    };

    // Prerendering API: Chrome/Google Search speculatively prerenders top search
    // results — real JS executes, including this effect, before any user has
    // actually arrived. A prerender that's never activated (user clicked a
    // different result, or never clicked at all) must never count as a view; one
    // the user does land on should count exactly once, at the moment it becomes
    // real. `document.prerendering` + the 'prerenderingchange' event are the
    // standard way to distinguish the two — not typed in TS DOM lib yet, hence
    // the cast. Server-side Sec-Purpose/Purpose header detection in the track
    // route is the fallback for browsers/proxies without this API.
    if (typeof document !== "undefined" && (document as unknown as { prerendering?: boolean }).prerendering) {
      const onActivate = () => send();
      document.addEventListener("prerenderingchange", onActivate, { once: true });
      return () => document.removeEventListener("prerenderingchange", onActivate);
    }

    send();
  }, [pathname, locale]);

  return null;
}
