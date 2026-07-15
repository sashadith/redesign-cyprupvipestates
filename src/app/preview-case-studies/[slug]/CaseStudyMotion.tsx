"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "../../preview-home/anim/gsap";

/* Load + scroll motion for a Case Study detail page — adapted from
   preview-insights/ArticleMotion.tsx (same hero/TOC/content-block choreography,
   since the header explicitly reuses Insights' .iart__hero structure), plus two
   sections ArticleMotion doesn't have: the client-overview stat band and the
   related-properties grid (.pcard, not .icard). No-ops under
   prefers-reduced-motion. Transform/opacity only. */
export default function CaseStudyMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      /* ---------- HERO (on load) ---------- */
      gsap.fromTo(".iart__hero-bg img", { scale: 1.16 }, { scale: 1.06, duration: 1.8, ease: "power2.out" });
      gsap.from(".iart__hero-bg", { autoAlpha: 0, duration: 1.2, ease: "power1.out" });

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".iart__kicker", { y: 20, autoAlpha: 0, duration: 0.6 }, 0.25)
        .from(".iart__title", { y: 36, autoAlpha: 0, duration: 0.95 }, 0.35)
        .from(".csd__hero-excerpt", { y: 22, autoAlpha: 0, duration: 0.7 }, 0.7);

      /* ---------- STAT BAND (on load, right after hero) ---------- */
      const stats = gsap.utils.toArray<HTMLElement>(".csd__stats-row > *");
      if (stats.length) {
        gsap.from(stats, { y: 18, autoAlpha: 0, duration: 0.6, stagger: 0.08, ease: "power2.out", delay: 0.15 });
      }

      /* ---------- TOC aside ---------- */
      gsap.from(".iart__aside", { autoAlpha: 0, x: -18, duration: 0.8, delay: 0.4, ease: "power2.out" });

      /* ---------- CONTENT — block-by-block fade up on scroll (journey stages + lessons) ---------- */
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

      /* ---------- RELATED PROPERTIES (reuses Insights' .iart__related section) ---------- */
      const related = gsap.utils.toArray<HTMLElement>(".iart__related .pcard");
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
