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
  }, [pathname, locale]);

  return null;
}
