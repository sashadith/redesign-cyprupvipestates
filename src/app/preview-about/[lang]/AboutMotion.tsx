"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "../../preview-home/anim/gsap";

/* Scroll/motion orchestrator for the About page — same approach as the
   homepage's PreviewMotion: drives everything off the SSR'd DOM by class, so
   no server component needs to become a client component. Renders null.

   - Fully no-ops under prefers-reduced-motion (content shown as-is).
   - All scroll animations are once:true.
   - Transform/opacity only → no layout shift.
   - Everything lives in a gsap.context and is reverted on unmount; SplitText
     instances are reverted too, so no DOM leaks.

   The H1 deliberately animates WITHOUT autoAlpha (see the same note in
   PreviewMotion): autoAlpha hides the LCP element synchronously when the
   timeline is built, which measured as a 20s+ LCP under throttled mobile CPU.
   The slide-up is kept; the opacity gate is not. */

export default function AboutMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const splits: Array<{ revert: () => void }> = [];

    const ctx = gsap.context(() => {
      const toArr = (sel: string) => gsap.utils.toArray<HTMLElement>(sel);

      /* ---------------- HERO (on load) ---------------- */
      const headline = document.querySelector<HTMLElement>(".abt__hero .hero__headline");
      if (headline) {
        const split = new SplitText(headline, { type: "lines", linesClass: "motion-line" });
        splits.push(split);
        gsap
          .timeline()
          .from(".abt__hero .hero__brand", { autoAlpha: 0, y: 14, duration: 0.5, ease: "power2.out" }, 0)
          .from(split.lines, { y: 80, duration: 0.9, stagger: 0.12, ease: "power3.out" }, 0.25)
          .from(".abt__hero .hero__stripe", { scaleX: 0, transformOrigin: "left center", autoAlpha: 0, duration: 0.6, ease: "power3.out" }, 1.1)
          .from(".abt__hero-lead", { autoAlpha: 0, y: 22, duration: 0.6, ease: "power2.out" }, 1.45)
          .from(".abt__hero .hero__cta", { autoAlpha: 0, y: 16, duration: 0.5, ease: "power2.out" }, 1.6);
      }

      /* ---------------- SECTION HEADINGS (line-by-line) ---------------- */
      toArr(".abt__title").forEach((el) => {
        const split = new SplitText(el, { type: "lines", linesClass: "motion-line" });
        splits.push(split);
        gsap.from(split.lines, {
          y: 60,
          autoAlpha: 0,
          duration: 0.75,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
          onComplete: () => split.revert(), // back to normal flowing text
        });
      });

      /* ---------------- EYEBROWS + LEADS (fade up) ---------------- */
      toArr(".abt__eyebrow, .abt__lead").forEach((el) => {
        gsap.from(el, {
          y: 24,
          autoAlpha: 0,
          duration: 0.55,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });

      /* ---------------- STANCE paragraphs ---------------- */
      const stanceParas = toArr(".abt__stance-p");
      if (stanceParas.length) {
        gsap.from(stanceParas, {
          y: 30,
          autoAlpha: 0,
          duration: 0.6,
          stagger: 0.12,
          ease: "power2.out",
          scrollTrigger: { trigger: ".abt__stance-body", start: "top 85%", once: true },
        });
      }

      /* ---------------- NUMBERED STEPS (slide in from left) ---------------- */
      toArr(".abt__step").forEach((el) => {
        gsap.from(el, {
          x: -40,
          autoAlpha: 0,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });

      /* ---------------- CARD / VALUE / MEMBER GRIDS (stagger up) ---------------- */
      ([
        [".abt__cards", ".abt__card"],
        [".abt__values-grid", ".abt__value"],
        [".abt__team-grid", ".abt__member"],
        [".abt__quotes", ".abt__quote"],
      ] as const).forEach(([gridSel, itemSel]) => {
        toArr(gridSel).forEach((grid) => {
          const items = grid.querySelectorAll(itemSel);
          if (!items.length) return;
          gsap.from(items, {
            y: 40,
            autoAlpha: 0,
            duration: 0.6,
            stagger: 0.07,
            ease: "power2.out",
            scrollTrigger: { trigger: grid, start: "top 85%", once: true },
          });
        });
      });

      /* ---------------- CTA ---------------- */
      gsap.from(".abt__cta .cnt__channel-grid", {
        y: 24,
        autoAlpha: 0,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: { trigger: ".abt__cta-inner", start: "top 88%", once: true },
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
