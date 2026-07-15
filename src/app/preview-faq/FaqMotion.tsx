"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "../preview-home/anim/gsap";

/* Scroll/motion orchestrator for the FAQ page — same conventions as
   InsightsMotion/PreviewMotion: no-ops under prefers-reduced-motion, once:true
   scroll reveals, transform/opacity only (no CLS). Filtering itself (search,
   category chips) is handled by plain CSS transitions in FaqExplorer — this
   component only owns the one-time entrance choreography.

   faqRevealAllRef: even with the reveal split onto whole category blocks (see
   below), a category the user hasn't scrolled to yet is still sitting at
   autoAlpha:0 pending its own scroll trigger — so a search match inside it
   would be un-hidden by the filter but still invisible under that pending
   block-level opacity. FaqExplorer calls this the moment a search/category
   filter becomes active, instantly completing every pending reveal so
   filtering is never at the mercy of scroll position. */
export const faqRevealAllRef: { current: (() => void) | null } = { current: null };

export default function FaqMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const splits: Array<{ revert: () => void }> = [];

    const ctx = gsap.context(() => {
      const toArr = (sel: string) => gsap.utils.toArray<HTMLElement>(sel);

      /* ---------- HERO (on load) ---------- */
      const headline = document.querySelector<HTMLElement>(".faqp__hero-title");
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".faqp__eyebrow", { y: 18, autoAlpha: 0, duration: 0.6 }, 0);
      if (headline) {
        const split = new SplitText(headline, { type: "lines", linesClass: "motion-line" });
        splits.push(split);
        tl.from(split.lines, { y: 40, autoAlpha: 0, duration: 0.8, stagger: 0.1 }, 0.1);
      }
      tl.from(".faqp__hero-lead", { y: 22, autoAlpha: 0, duration: 0.7 }, 0.42)
        .from(".faqp__hero-meta", { y: 16, autoAlpha: 0, duration: 0.6 }, 0.58)
        .from(".faqp__hero-art", { y: 32, autoAlpha: 0, duration: 0.9, ease: "power4.out" }, 0.3)
        /* ---------- TOOLBAR (search + chips, on load right after hero) ---------- */
        .from(".faqp__toolbar", { y: 20, autoAlpha: 0, duration: 0.6, ease: "power2.out" }, 0.75);

      /* ---------- CATEGORY SECTIONS (reveal on scroll) ----------
         Animates .faqp__cat-head and .faqp__items as TWO whole blocks, never
         individual .faqp__item elements. FaqExplorer's search/category filter
         also controls opacity/height on individual .faqp__item nodes (to show
         hidden matches instantly, regardless of scroll position) — if GSAP
         also owned that same property on the same elements, a category the
         user hasn't scrolled to yet would still be sitting at its pending
         inline opacity:0 from this entrance animation, which beats the
         filter's CSS class on specificity and hides genuine search matches.
         Animating the parent blocks instead keeps the two systems on
         non-overlapping elements, so a category can be revealed by either
         scroll OR by search/filter matching, independently and correctly.

         set()+to() rather than .from(): a scrollTrigger-gated .from() stays
         PAUSED (often for a long time, waiting for scroll) with its "current
         value" resolved implicitly — under React 18 Strict Mode's dev-only
         double-effect-invoke, the revert()/recreate cycle can leave that
         implicit capture pointing at the wrong (already-0) state, so the
         tween has nothing left to animate and the reveal never visibly plays.
         set()+to() animates toward an explicit target instead, so it's
         correct regardless of how many times the effect re-runs. (The hero
         timeline above stays .from() safely — it plays immediately, not
         scrollTrigger-gated, so it isn't exposed to this.) */
      const catTriggers: ScrollTrigger[] = [];
      toArr(".faqp__cat").forEach((section) => {
        const head = section.querySelector(".faqp__cat-head");
        const items = section.querySelector(".faqp__items");
        const targets = [head, items].filter(Boolean) as HTMLElement[];
        if (!targets.length) return;
        gsap.set(targets, { y: 26, autoAlpha: 0 });
        const tween = gsap.to(targets, {
          y: 0,
          autoAlpha: 1,
          duration: 0.6,
          stagger: 0.12,
          ease: "power2.out",
          scrollTrigger: { trigger: section, start: "top 88%", once: true },
        });
        if (tween.scrollTrigger) catTriggers.push(tween.scrollTrigger);
      });

      faqRevealAllRef.current = () => catTriggers.forEach((st) => st.animation?.progress(1));
    });

    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 350);

    return () => {
      window.clearTimeout(refresh);
      faqRevealAllRef.current = null;
      splits.forEach((s) => {
        try { s.revert(); } catch { /* already reverted */ }
      });
      ctx.revert();
    };
  }, []);

  return null;
}
