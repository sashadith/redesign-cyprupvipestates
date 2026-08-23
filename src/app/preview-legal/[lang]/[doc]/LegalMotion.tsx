"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "../../../preview-home/anim/gsap";

/* Scroll/motion for the legal pages — deliberately the quietest of the three
   redesigned page types. A privacy policy that animates as theatrically as a
   landing page reads as unserious, and anyone on this page is usually looking
   for one specific clause rather than admiring the composition.

   So: the header gets the same line reveal every page uses, and each section
   fades up once as it enters. Nothing staggers, nothing slides sideways.
   Same contract as elsewhere — no-ops under prefers-reduced-motion, once:true,
   transform/opacity only, fully reverted on unmount. */

export default function LegalMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const splits: Array<{ revert: () => void }> = [];

    const ctx = gsap.context(() => {
      const headline = document.querySelector<HTMLElement>(".lgl__title");
      if (headline) {
        const split = new SplitText(headline, { type: "lines", linesClass: "motion-line" });
        splits.push(split);
        gsap
          .timeline()
          .from(".lgl__eyebrow", { autoAlpha: 0, y: 12, duration: 0.45, ease: "power2.out" }, 0)
          // No autoAlpha on the H1 — same LCP reasoning as every other page here.
          .from(split.lines, { y: 50, duration: 0.7, stagger: 0.09, ease: "power3.out" }, 0.18)
          .from(".lgl__intro", { autoAlpha: 0, y: 18, duration: 0.5, ease: "power2.out" }, 0.8)
          .from(".lgl__updated", { autoAlpha: 0, y: 12, duration: 0.45, ease: "power2.out" }, 0.95);
      }

      gsap.from(".lgl__toc", {
        autoAlpha: 0,
        x: -16,
        duration: 0.6,
        delay: 0.3,
        ease: "power2.out",
      });

      gsap.utils.toArray<HTMLElement>(".lgl__section, .lgl__contact").forEach((el) => {
        gsap.from(el, {
          y: 26,
          autoAlpha: 0,
          duration: 0.55,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });

      ScrollTrigger.refresh();
    });

    return () => {
      splits.forEach((s) => s.revert());
      ctx.revert();
    };
  }, []);

  return null;
}
