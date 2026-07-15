"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "../preview-home/anim/gsap";

/* Scroll/motion orchestrator for the Case Studies index — same conventions as
   InsightsMotion/FaqMotion: no-ops under prefers-reduced-motion, once:true
   scroll reveals, transform/opacity only (no CLS).

   Scroll-triggered reveals use explicit gsap.set() + .to() rather than
   .from(): a scrollTrigger-gated .from() stays PAUSED (often for a long time,
   waiting for scroll) with its "current value" resolved implicitly — under
   React 18 Strict Mode's dev-only double-effect-invoke, the revert()/recreate
   cycle can leave that implicit capture pointing at the wrong (already-0)
   state, so the reveal never visibly plays (hit this exact bug building the
   FAQ page). set()+to() animates toward an explicit target instead, so it's
   correct regardless of how many times the effect re-runs. The hero timeline
   below stays .from() safely — it plays immediately on load, not
   scrollTrigger-gated, so it isn't exposed to this. */
export default function CaseStudiesMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const splits: Array<{ revert: () => void }> = [];

    const ctx = gsap.context(() => {
      const toArr = (sel: string) => gsap.utils.toArray<HTMLElement>(sel);

      /* ---------- HERO (on load) — same choreography as InsightsMotion ---------- */
      const headline = document.querySelector<HTMLElement>(".ins__hero-title");
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".ins__eyebrow", { y: 18, autoAlpha: 0, duration: 0.6 }, 0);
      if (headline) {
        const split = new SplitText(headline, { type: "lines", linesClass: "motion-line" });
        splits.push(split);
        tl.from(split.lines, { y: 32, autoAlpha: 0, duration: 0.9 }, 0.08);
      }
      tl.from(".ins__hero-lead", { y: 22, autoAlpha: 0, duration: 0.7 }, 0.42)
        .from(".ins__hero-meta", { y: 16, autoAlpha: 0, duration: 0.6 }, 0.58)
        .from(".ins__hero-art", { y: 64, autoAlpha: 0, duration: 1.1, ease: "power4.out" }, 0.3);

      /* ---------- STORY BLOCKS (reveal on scroll, one at a time) ---------- */
      toArr(".csstory").forEach((story) => {
        gsap.set(story, { y: 40, autoAlpha: 0 });
        gsap.to(story, {
          y: 0,
          autoAlpha: 1,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: { trigger: story, start: "top 85%", once: true },
        });
      });

      /* ---------- SEO GUIDE (same treatment as Insights' own guide section) ---------- */
      toArr(".ins__guide-head, .ins__guide-intro").forEach((el) => {
        gsap.set(el, { y: 34, autoAlpha: 0 });
        gsap.to(el, {
          y: 0,
          autoAlpha: 1,
          duration: 0.75,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
      const topics = document.querySelectorAll<HTMLElement>(".ins__topic");
      if (topics.length) {
        gsap.set(topics, { y: 38, autoAlpha: 0 });
        gsap.to(topics, {
          y: 0,
          autoAlpha: 1,
          duration: 0.6,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: ".ins__topics", start: "top 90%", once: true },
        });
      }
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
