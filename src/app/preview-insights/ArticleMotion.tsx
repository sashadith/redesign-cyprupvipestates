"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "../preview-home/anim/gsap";

/* Load + scroll motion for an Insights article. Mounted once; drives reveals off
   the existing DOM by class. No-ops under prefers-reduced-motion (content shown
   as-is, nothing is hidden). Transform/opacity only. */
export default function ArticleMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      /* ---------- HERO (on load) ---------- */
      // slow cinematic settle of the cover image (ends at the CSS resting 1.06)
      gsap.fromTo(
        ".iart__hero-bg img",
        { scale: 1.16 },
        { scale: 1.06, duration: 1.8, ease: "power2.out" },
      );
      gsap.from(".iart__hero-bg", { autoAlpha: 0, duration: 1.2, ease: "power1.out" });

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".iart__kicker", { y: 20, autoAlpha: 0, duration: 0.6 }, 0.25)
        .from(".iart__title", { y: 36, autoAlpha: 0, duration: 0.95 }, 0.35)
        .from(".iart__meta", { y: 22, autoAlpha: 0, duration: 0.7 }, 0.7);

      /* ---------- TOC aside ---------- */
      gsap.from(".iart__aside", { autoAlpha: 0, x: -18, duration: 0.8, delay: 0.5, ease: "power2.out" });

      /* ---------- ARTICLE BODY — block-by-block fade up on scroll ---------- */
      const blocks = gsap.utils.toArray<HTMLElement>(".iart__content > *");
      if (blocks.length) {
        gsap.set(blocks, { autoAlpha: 0, y: 26 });
        ScrollTrigger.batch(blocks, {
          start: "top 94%",
          once: true,
          onEnter: (els) =>
            gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08, ease: "power2.out", overwrite: true }),
        });
      }

      /* ---------- RELATED cards ---------- */
      const related = gsap.utils.toArray<HTMLElement>(".iart__related .icard");
      if (related.length) {
        gsap.from(related, {
          y: 40,
          autoAlpha: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: { trigger: ".iart__related", start: "top 82%", once: true },
        });
      }
    });

    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 350);

    return () => {
      window.clearTimeout(refresh);
      ctx.revert();
    };
  }, []);

  return null;
}
