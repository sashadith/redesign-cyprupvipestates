"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "../../preview-home/anim/gsap";

/* Scroll/motion orchestrator for the Partners page — same conventions as
   Home's own hero timeline plus FaqMotion/CaseStudiesMotion's scroll-reveal
   pattern: no-ops under prefers-reduced-motion, once:true scroll reveals,
   transform/opacity only (no CLS). The hero plays immediately on load (not
   scrollTrigger-gated, matching Hero.tsx's own choreography exactly); every
   section below it reveals on scroll, staggered card-by-card. */
export default function PartnersMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const splits: Array<{ revert: () => void }> = [];

    const ctx = gsap.context(() => {
      const toArr = (sel: string) => gsap.utils.toArray<HTMLElement>(sel);

      /* ---------- HERO (on load) — same choreography as Home's Hero ---------- */
      const headline = document.querySelector<HTMLElement>(".hero__headline");
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero__brand", { y: 18, autoAlpha: 0, duration: 0.6 }, 0);
      if (headline) {
        const split = new SplitText(headline, { type: "lines", linesClass: "motion-line" });
        splits.push(split);
        tl.from(split.lines, { y: 32, autoAlpha: 0, duration: 0.9 }, 0.1);
      }
      tl.from(".hero__stripe", { scaleX: 0, transformOrigin: "left center", duration: 0.7 }, 0.5)
        .from(".hero__desc", { y: 22, autoAlpha: 0, duration: 0.7 }, 0.56)
        .from(".hero__cta", { y: 18, autoAlpha: 0, duration: 0.6 }, 0.68)
        .from(".pnr__hero-note", { y: 14, autoAlpha: 0, duration: 0.6 }, 0.78);

      /* ---------- STATS (count-up numbers reveal together with their card) --- */
      toArr(".bstat").forEach((el, i) => {
        gsap.set(el, { y: 34, autoAlpha: 0 });
        gsap.to(el, {
          y: 0, autoAlpha: 1, duration: 0.65, delay: i * 0.06, ease: "power2.out",
          scrollTrigger: { trigger: ".pnr__stats-section", start: "top 85%", once: true },
        });
      });

      /* ---------- BENEFIT TOPIC CARDS ---------- */
      const benefitCards = document.querySelectorAll<HTMLElement>(".pnr__benefit-grid .ins__topic");
      if (benefitCards.length) {
        gsap.set(benefitCards, { y: 40, autoAlpha: 0 });
        gsap.to(benefitCards, {
          y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.09, ease: "power2.out",
          scrollTrigger: { trigger: ".pnr__benefit-grid", start: "top 82%", once: true },
        });
      }

      /* ---------- PARTNER-TYPE MEDALLIONS ---------- */
      const typeCards = document.querySelectorAll<HTMLElement>(".pnr__type");
      if (typeCards.length) {
        gsap.set(typeCards, { y: 40, autoAlpha: 0 });
        gsap.to(typeCards, {
          y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.12, ease: "power2.out",
          scrollTrigger: { trigger: ".pnr__type-grid", start: "top 82%", once: true },
        });
      }

      /* ---------- HOW-IT-WORKS STEPS ---------- */
      const steps = document.querySelectorAll<HTMLElement>(".pnr__step");
      if (steps.length) {
        gsap.set(steps, { y: 40, autoAlpha: 0 });
        gsap.to(steps, {
          y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.14, ease: "power2.out",
          scrollTrigger: { trigger: ".pnr__step-grid", start: "top 82%", once: true },
        });
      }

      /* ---------- FORM / FINAL CTA SECTION ---------- */
      toArr(".formsec__head, .formsec__form").forEach((el, i) => {
        gsap.set(el, { y: 30, autoAlpha: 0 });
        gsap.to(el, {
          y: 0, autoAlpha: 1, duration: 0.7, delay: i * 0.08, ease: "power2.out",
          scrollTrigger: { trigger: ".formsec", start: "top 85%", once: true },
        });
      });
    });

    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 350);

    return () => {
      window.clearTimeout(refresh);
      splits.forEach((s) => {
        try { s.revert(); } catch { /* already reverted */ }
      });
      ctx.revert();
    };
  }, []);

  return null;
}
