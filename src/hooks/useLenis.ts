// src/hooks/useLenis.ts
"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export const useLenis = () => {
  useEffect(() => {
    // Respect the OS "reduce motion" preference: keep smooth scrolling disabled (native scroll).
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Больше не нужно указывать smooth*, всё работает по умолчанию
    });

    // Expose the live instance globally so components that need to drive the
    // page's smooth scroll can reach it (the blog pager's scroll-to-top and the
    // ROI modal's scroll lock both read window.lenis). Without this, callers fall
    // back to window.scrollTo, which Lenis's RAF loop immediately overrides — so
    // the page doesn't actually scroll up while Lenis is running.
    (window as any).lenis = lenis;

    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };

    requestAnimationFrame(raf);

    return () => {
      if ((window as any).lenis === lenis) (window as any).lenis = undefined;
      lenis.destroy();
    };
  }, []);
};
