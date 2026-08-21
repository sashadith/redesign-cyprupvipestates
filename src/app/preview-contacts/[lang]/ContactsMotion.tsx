"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from "../../preview-home/anim/gsap";

/* Scroll/motion orchestrator for the Contacts page. Same contract as the
   homepage's PreviewMotion and the About page's AboutMotion: class-driven off
   the SSR'd DOM, no-ops entirely under prefers-reduced-motion, every scroll
   trigger once:true, transform/opacity only, reverted on unmount.

   The H1 animates without autoAlpha for the same LCP reason documented in
   PreviewMotion — the slide-up is kept, the opacity gate is not. */

export default function ContactsMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const splits: Array<{ revert: () => void }> = [];

    const ctx = gsap.context(() => {
      const toArr = (sel: string) => gsap.utils.toArray<HTMLElement>(sel);

      /* ---------------- HERO (on load) ---------------- */
      const headline = document.querySelector<HTMLElement>(".cnt__hero .hero__headline");
      if (headline) {
        const split = new SplitText(headline, { type: "lines", linesClass: "motion-line" });
        splits.push(split);
        gsap
          .timeline()
          .from(".cnt__hero .hero__brand", { autoAlpha: 0, y: 14, duration: 0.5, ease: "power2.out" }, 0)
          .from(split.lines, { y: 70, duration: 0.85, stagger: 0.1, ease: "power3.out" }, 0.2)
          .from(".cnt__hero .hero__stripe", { scaleX: 0, transformOrigin: "left center", autoAlpha: 0, duration: 0.6, ease: "power3.out" }, 0.95)
          .from(".cnt__hero-lead", { autoAlpha: 0, y: 20, duration: 0.55, ease: "power2.out" }, 1.2)
          .from(".cnt__hours", { autoAlpha: 0, y: 16, duration: 0.5, ease: "power2.out" }, 1.35);
      }

      /* ---------------- SECTION HEADINGS ---------------- */
      toArr(".cnt__title").forEach((el) => {
        // The form section reuses .cnt__title inside the shared Form heading;
        // splitting an element that Form re-renders on state change would
        // strip its own markup, so only split headings we own outright.
        if (el.closest(".formsec")) return;
        const split = new SplitText(el, { type: "lines", linesClass: "motion-line" });
        splits.push(split);
        gsap.from(split.lines, {
          y: 55,
          autoAlpha: 0,
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
          onComplete: () => split.revert(),
        });
      });

      /* ---------------- EYEBROWS + LEADS ---------------- */
      toArr(".cnt__channels .cnt__eyebrow, .cnt__finder-sec .cnt__eyebrow, .cnt__lead").forEach((el) => {
        gsap.from(el, {
          y: 22,
          autoAlpha: 0,
          duration: 0.55,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });

      /* ---------------- CHANNEL CARDS ---------------- */
      const channelCards = toArr(".cnt__channel");
      if (channelCards.length) {
        gsap.from(channelCards, {
          y: 36,
          autoAlpha: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: { trigger: ".cnt__channel-grid", start: "top 85%", once: true },
        });
      }

      /* ---------------- FINDER: chips, then people ----------------
         Only the initial reveal is animated. Filtering afterwards is a
         class toggle in ConsultantFinder — deliberately NOT re-animated, so
         changing the language filter feels instant rather than replaying a
         stagger every click. */
      const chips = toArr(".cnt__chip");
      if (chips.length) {
        gsap.from(chips, {
          y: 16,
          autoAlpha: 0,
          duration: 0.45,
          stagger: 0.04,
          ease: "power2.out",
          scrollTrigger: { trigger: ".cnt__chips", start: "top 90%", once: true },
        });
      }
      const people = toArr(".cnt__person");
      if (people.length) {
        gsap.from(people, {
          y: 34,
          autoAlpha: 0,
          duration: 0.55,
          stagger: 0.06,
          ease: "power2.out",
          scrollTrigger: { trigger: ".cnt__people", start: "top 88%", once: true },
        });
      }

      ScrollTrigger.refresh();
    });

    return () => {
      splits.forEach((s) => s.revert());
      ctx.revert();
    };
  }, []);

  return null;
}
