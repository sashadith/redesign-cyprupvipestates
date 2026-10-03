"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureAttribution } from "@/lib/attribution";

/* First-touch partner/campaign capture for the page trees that have their own
   root <html>/<body> and therefore no AnalyticsTracker ([lang]/layout.tsx is the
   only one that mounts it). Without this, a visitor arriving on e.g.
   /partners?utm_source=x and moving on lost the attribution (2026-09-28).
   Renders nothing. */
export default function AttributionCapture() {
  const pathname = usePathname();
  useEffect(() => {
    captureAttribution();
  }, [pathname]);
  return null;
}
