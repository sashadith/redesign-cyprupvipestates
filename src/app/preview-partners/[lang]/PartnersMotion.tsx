"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "../../preview-home/anim/gsap";

/* Scroll/motion orchestrator for the Partners page — same conventions as
   FaqMotion/CaseStudiesMotion's scroll-reveal
   pattern: no-ops under prefers-reduced-motion, once:true scroll reveals,
   transform/opacity only (no CLS). The hero is CSS-only (see below); every
   section below it reveals on scroll, staggered card-by-card. */
export default function PartnersMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const toArr = (sel: string) => gsap.utils.toArray<HTMLElement>(sel);

      /* HERO: no GSAP here. The hero intro is the CSS keyframes in preview-home/tokens.css
         (heroRise/heroStripeIn, `backwards` fill); a GSAP .from() on the same elements read their
         CSS start state (opacity 0) as the end state and left stripe, lead and button invisible.
         The two partner-only lines below the button get the same keyframes in partners.css. */

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

      /* ---------- FAQ ITEMS ---------- */
      const faqItems = document.querySelectorAll<HTMLElement>(".pnr__faq-section .faq__item");
      if (faqItems.length) {
        gsap.set(faqItems, { y: 24, autoAlpha: 0 });
        gsap.to(faqItems, {
          y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.08, ease: "power2.out",
          scrollTrigger: { trigger: ".pnr__faq-section", start: "top 85%", once: true },
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
      ctx.revert();
    };
  }, []);

  return null;
}
