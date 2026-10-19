import { gsap, ScrollTrigger, SplitText } from "./gsap";
import { isRtlDoc } from "@/app/components/useIsRtl";

/* Scroll-triggered section animations of the homepage (heading line reveal, lead fade, card grids,
   checklist, image wipe). Split out of PreviewMotion so that GSAP + ScrollTrigger + SplitText
   (~110 KB raw, ~0.9 s of main-thread work in the 2026-10-19 lab trace) are fetched and run AFTER the
   page has loaded, not during hydration. Everything is created inside a gsap.context; the returned
   function reverts it all (and the SplitText instances). All of these sit below the hero. */
export function initSectionMotion(): () => void {
  const splits: Array<{ revert: () => void }> = [];
  const isRtl = isRtlDoc(document);

  const ctx = gsap.context(() => {
    const toArr = (sel: string) => gsap.utils.toArray<HTMLElement>(sel);

    // Cities cards are intentionally NOT animated — clear any stale reveal
    // transform so they sit at translate(0px, 0px).
    gsap.set(".ccard", { clearProps: "transform" });

    /* ---------- 2.3 SECTION HEADINGS — line-by-line reveal on scroll ---------- */
    const titleSel =
      ".brochure__title, .about__title, .featured__title, .cities__title, .descblock__title, .newlist__title, .casestudies__title, .faq__title, .content__title";
    toArr(titleSel).forEach((el) => {
      const split = new SplitText(el, { type: "lines", linesClass: "motion-line", aria: "none" });
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
      ".brochure__desc, .about__desc, .featured__desc, .cities__lead, .casestudies__desc, .faq__lead, .content__lead";
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
        x: isRtl ? 20 : -20,
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
}
