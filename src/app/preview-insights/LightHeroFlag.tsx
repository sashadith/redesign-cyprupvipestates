"use client";

import { useEffect } from "react";

/* Marks <html> while a light-hero page is mounted, so the top nav shows a
   deep-green bar at the very top that slowly fades out once scrolling begins
   (the reverse of the dark-hero behaviour). Cleaned up on unmount. */
export default function LightHeroFlag() {
  useEffect(() => {
    document.documentElement.setAttribute("data-light-hero", "");
    return () => document.documentElement.removeAttribute("data-light-hero");
  }, []);
  return null;
}
