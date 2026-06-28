"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, prefersReducedMotion, isTouchDevice } from "./gsap";

/* Smooth scroll (Lenis) synced with the GSAP ticker + ScrollTrigger, scoped to the
   /preview-home layout. Desktop only: on touch devices or when prefers-reduced-motion
   is set we keep native scrolling and just let ScrollTrigger use the native scroll. */

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Touch / reduced-motion: no smooth scroll. ScrollTrigger falls back to native
    // scroll; reveal components individually no-op under reduced-motion.
    if (prefersReducedMotion() || isTouchDevice()) {
      ScrollTrigger.refresh();
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    // Drive ScrollTrigger off Lenis's scroll position, not the native scroll event.
    lenis.on("scroll", () => ScrollTrigger.update());

    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(onTick);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
