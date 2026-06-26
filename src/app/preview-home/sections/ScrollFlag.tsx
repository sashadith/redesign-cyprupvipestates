"use client";

import { useEffect } from "react";

/* Sets data-scrolled on <html> once the page leaves the very top, so the nav's
   frosted background only appears after scrolling. */
export default function ScrollFlag() {
  useEffect(() => {
    const onScroll = () => {
      document.documentElement.toggleAttribute("data-scrolled", window.scrollY > 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return null;
}
