"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "./gsap";

/* Preview-only scroll/motion orchestrator. Mounted once in the page; drives all the
   Phase-2 animations off the existing DOM by class, so NO server component changes
   are needed and SSR markup is unchanged. Renders null.

   - Fully no-ops under prefers-reduced-motion (content shown as-is).
   - All scroll animations are once:true.
   - Transform/opacity/clip-path only → no layout shift (CLS).
   - Everything is created inside a gsap.context and reverted on unmount; SplitText
     instances are reverted too (no DOM leaks); magnetic listeners are removed. */

export default function PreviewMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const splits: Array<{ revert: () => void }> = [];

    const ctx = gsap.context(() => {
      const toArr = (sel: string) => gsap.utils.toArray<HTMLElement>(sel);

      // Cities cards are intentionally NOT animated — clear any stale reveal
      // transform so they sit at translate(0px, 0px).
      gsap.set(".ccard", { clearProps: "transform" });

      /* ---------- 2.1 HERO — eyebrow + SplitText headline (on load) ---------- */
      const headline = document.querySelector<HTMLElement>(".hero__headline");
      if (headline) {
        const split = new SplitText(headline, { type: "lines", linesClass: "motion-line" });
        splits.push(split);
        gsap
          .timeline()
          .from(".hero__brand", { autoAlpha: 0, y: 14, duration: 0.5, ease: "power2.out" }, 0)
          .from(split.lines, { y: 80, autoAlpha: 0, duration: 0.9, stagger: 0.12, ease: "power3.out" }, 0.3)
          .from(".hero__stripe", { scaleX: 0, transformOrigin: "left center", autoAlpha: 0, duration: 0.6, ease: "power3.out" }, 1.2)
          .from(".hero__desc", { autoAlpha: 0, y: 22, duration: 0.6, ease: "power2.out" }, 1.6)
          .from(".hero__cta", { autoAlpha: 0, y: 16, duration: 0.5, ease: "power2.out" }, 1.75);
      }

      /* ---------- 2.3 SECTION HEADINGS — line-by-line reveal on scroll ---------- */
      const titleSel =
        ".brochure__title, .about__title, .featured__title, .cities__title, .descblock__title, .newlist__title, .casestudies__title, .faq__title, .content__title";
      toArr(titleSel).forEach((el) => {
        const split = new SplitText(el, { type: "lines", linesClass: "motion-line" });
        splits.push(split);
        gsap.from(split.lines, {
          y: 60,
          autoAlpha: 0,
          duration: 0.75,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
          onComplete: () => split.revert(), // return heading to normal flowing text
        });
      });

      /* ---------- 2.4 LEAD PARAGRAPHS — fade up ---------- */
      const leadSel =
        ".brochure__desc, .about__desc, .featured__desc, .cities__lead, .newlist__lead, .casestudies__desc, .faq__lead, .content__lead";
      toArr(leadSel).forEach((el) => {
        gsap.from(el, {
          y: 30,
          autoAlpha: 0,
          duration: 0.6,
          delay: 0.15,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        });
      });

      /* ---------- 2.5 CARD GRIDS — staggered fade up (Cities excluded: no transform) ---------- */
      toArr(".newlist__grid, .casestudies__grid").forEach((grid) => {
        const cards = grid.querySelectorAll(".pcard, .ccard, .cscard");
        if (!cards.length) return;
        gsap.from(cards, {
          y: 40,
          autoAlpha: 0,
          duration: 0.65,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: { trigger: grid, start: "top 96%", once: true },
        });
      });

      /* ---------- 2.6 CHECKLIST (Welcome) — sequential slide-in ---------- */
      const checklist = document.querySelectorAll(".brochure__list li");
      if (checklist.length) {
        gsap.from(checklist, {
          x: -20,
          autoAlpha: 0,
          duration: 0.5,
          stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: { trigger: ".brochure__list", start: "top 85%", once: true },
        });
      }

      /* ---------- 2.2 IMAGE REVEAL — clip-path wipe + Ken Burns ---------- */
      toArr(".brochure__media").forEach((img) => {
        gsap.set(img, { clipPath: "inset(0 100% 0 0)", scale: 1.08, transformOrigin: "center" });
        gsap
          .timeline({ scrollTrigger: { trigger: img, start: "top 80%", once: true } })
          .to(img, { clipPath: "inset(0 0% 0 0)", duration: 0.9, ease: "power4.inOut" })
          .to(img, { scale: 1, duration: 1.2, ease: "power2.out" }, "-=0.2");
      });
    });

    // Re-measure triggers once webfonts/layout settle.
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 350);

    return () => {
      window.clearTimeout(refresh);
      splits.forEach((s) => {
        try {
          s.revert();
        } catch {
          /* already reverted */
        }
      });
      ctx.revert();
    };
  }, []);

  return null;
}
