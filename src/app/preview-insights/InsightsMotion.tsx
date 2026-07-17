"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "../preview-home/anim/gsap";

/* Scroll/motion orchestrator for the Insights index. Mounted once; drives reveals
   off the existing DOM by class, so the server markup is unchanged. No-ops under
   prefers-reduced-motion. All scroll reveals are once:true and use transform/opacity
   only. Note: the hero tablet keeps its CSS 3D tilt — we animate the .ins__hero-art
   wrapper, never the .ins__device itself. */
export default function InsightsMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const toArr = (sel: string) => gsap.utils.toArray<HTMLElement>(sel);

      /* ---------- HERO (on load) ---------- */
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".ins__eyebrow", { y: 18, autoAlpha: 0, duration: 0.6 }, 0)
        .from(".ins__hero-title", { y: 32, autoAlpha: 0, duration: 0.9 }, 0.08)
        .from(".ins__hero-lead", { y: 22, autoAlpha: 0, duration: 0.7 }, 0.42)
        .from(".ins__hero-meta", { y: 16, autoAlpha: 0, duration: 0.6 }, 0.58)
        .from(".ins__hero-art", { y: 64, autoAlpha: 0, duration: 1.1, ease: "power4.out" }, 0.3);

      /* ---------- FILTER + FEATURED (on scroll) ---------- */
      toArr(".ifilter, .ifeat").forEach((el) => {
        gsap.from(el, {
          y: 30,
          autoAlpha: 0,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });

      /* ---------- CARD GRID (staggered fade-up on scroll) ---------- */
      const grid = document.querySelector<HTMLElement>(".ins__grid");
      if (grid) {
        // only the cards visible on this page; off-page cards (shown later by the
        // category filter) must NOT be gated to autoAlpha:0 or they'd stay hidden
        const cards = grid.querySelectorAll(".icard:not(.is-hidden)");
        if (cards.length) {
          gsap.from(cards, {
            y: 42,
            autoAlpha: 0,
            duration: 0.6,
            stagger: 0.07,
            ease: "power3.out",
            scrollTrigger: { trigger: ".ins__list", start: "top 78%", once: true },
          });
        }
      }

      /* ---------- SEO GUIDE (on scroll) ---------- */
      toArr(".ins__guide-head, .ins__guide-intro, .ins__guide-outro").forEach((el) => {
        gsap.from(el, {
          y: 34,
          autoAlpha: 0,
          duration: 0.75,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
      const topics = document.querySelectorAll(".ins__topic");
      if (topics.length) {
        gsap.from(topics, {
          y: 38,
          autoAlpha: 0,
          duration: 0.6,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: ".ins__topics", start: "top 90%", once: true },
        });
      }
    });

    // re-measure once webfonts/layout settle
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 350);

    return () => {
      window.clearTimeout(refresh);
      ctx.revert();
    };
  }, []);

  return null;
}
