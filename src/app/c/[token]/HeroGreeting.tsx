"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap, safeReveal, focusRevealVars, deepFadeVars, isMobileViewport } from "./anim";

/* "Coming into focus" entrance: elements emerge from darkness/blur into
   sharp focus, staggered over <3s. Deliberately NOT SplitText-based — this
   page renders via React's streaming SSR (property descriptions arrive as
   separate RSC payload chunks), and SplitText physically rewraps text into
   new DOM nodes; doing that while React is still finalizing/replacing the
   same streamed subtree raced with reconciliation and corrupted the tree in
   the past. Animating whole elements in place (opacity/filter/transform
   only, no DOM restructuring) can't conflict with React's own node
   management. See ./anim.ts for the fail-safe wrapper this relies on: every
   hidden-state here is applied by GSAP itself, never by static CSS, so any
   animation failure leaves the hero fully visible instead of stuck blank. */
export default function HeroGreeting({
  eyebrowTag, greetingWord, name, introLine, requirementsTitle, requirementChips, note, advisorName, districtImage,
}: {
  eyebrowTag: string;
  greetingWord: string;
  name: string;
  introLine: string;
  requirementsTitle: string;
  requirementChips?: string[];
  note?: string | null;
  advisorName?: string | null;
  districtImage?: string | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    return safeReveal(rootRef.current, (root, track) => {
      const mobile = isMobileViewport();
      const tl = gsap.timeline();

      const bg = root.querySelector<HTMLElement>('[data-fx="bg"]');
      const cloud = root.querySelector<HTMLElement>('[data-fx="cloud"]');
      const logo = root.querySelector<HTMLElement>('[data-fx="logo"]');
      const eyebrow = root.querySelector<HTMLElement>('[data-fx="eyebrow"]');
      const greeting = root.querySelector<HTMLElement>('[data-fx="greeting"]');
      const intro = root.querySelectorAll<HTMLElement>('[data-fx="intro"]');
      const reqsTitle = root.querySelector<HTMLElement>('[data-fx="reqstitle"]');
      const chips = root.querySelectorAll<HTMLElement>('[data-fx="chip"]');

      // Mobile keeps its exact original timing/opacity untouched. Desktop
      // gets a deeper image (0.7 vs 0.1), the sea-deep cloud layer, and the
      // whole text stagger shifted later so the depth order reads as
      // image → cloud → text (with a slight parallel overlap, not a hard
      // sequential wait — see the class comment above).
      const pos = mobile
        ? { logo: 0.3, eyebrow: 0.6, greeting: 0.8, intro: 1.2, reqsTitle: 1.5, chips: 1.5 }
        : { cloud: 0.8, logo: 1.0, eyebrow: 1.3, greeting: 1.5, intro: 1.9, reqsTitle: 2.2, chips: 2.2 };

      if (bg) {
        // Mobile settles at 0.1 opacity (unchanged). Desktop settles at 0.7
        // — the harbor image reads clearly — legibility now comes from the
        // sea-deep cloud behind the text, not from darkening the whole image.
        const { from, to } = deepFadeVars(mobile, { duration: mobile ? 1.6 : 1.4, brightness: true, opacity: mobile ? 0.1 : 0.7 });
        gsap.set(track(bg), from);
        tl.to(bg, to, 0);
      }
      if (!mobile && cloud) {
        gsap.set(track(cloud), { opacity: 0 });
        tl.to(cloud, { opacity: 1, duration: 0.8, ease: "power2.out" }, pos.cloud);
      }
      if (logo) {
        const { from, to } = focusRevealVars(mobile);
        gsap.set(track(logo), from);
        tl.to(logo, to, pos.logo);
      }
      if (eyebrow) {
        const { from, to } = focusRevealVars(mobile);
        gsap.set(track(eyebrow), from);
        tl.to(eyebrow, to, pos.eyebrow);
      }
      if (greeting) {
        // The hero moment — a longer blur and duration than the rest.
        const { from, to } = focusRevealVars(mobile, { blur: 18, duration: 1.3 });
        gsap.set(track(greeting), from);
        tl.to(greeting, to, pos.greeting);
      }
      if (intro.length) {
        const { from, to } = focusRevealVars(mobile);
        gsap.set(track(intro), from);
        tl.to(intro, to, pos.intro);
      }
      if (reqsTitle) {
        const { from, to } = focusRevealVars(mobile);
        gsap.set(track(reqsTitle), from);
        tl.to(reqsTitle, to, pos.reqsTitle);
      }
      if (chips.length) {
        const { from, to } = focusRevealVars(mobile);
        gsap.set(track(chips), from);
        tl.to(chips, { ...to, stagger: 0.08 }, pos.chips);
      }
    });
  }, []);

  return (
    <div className="cp-hero" ref={rootRef}>
      {districtImage && <div className="cp-hero__bg" data-fx="bg" style={{ backgroundImage: `url(${districtImage})` }} />}
      {districtImage && <div className="cp-hero__cloud" data-fx="cloud" aria-hidden="true" />}
      <div className="cp-hero__inner">
        <img src="/uploads/images/05ff9b6142e3a98fa0ef44ae36b302a20bba2e60-2048x2048.png" alt="Cyprus VIP Estates" className="cp-hero__logo" data-fx="logo" />
        <p className="eyebrow cp-hero__tag" data-fx="eyebrow">{eyebrowTag}</p>
        <p className="cp-hero__eyebrow" data-fx="greeting">{greetingWord}, <span className="it">{name}!</span></p>
        <p className="cp-hero__intro" data-fx="intro">{introLine}</p>
        {advisorName && <cite className="cp-hero__signature" data-fx="intro">- {advisorName} -</cite>}
        {requirementChips && requirementChips.length > 0 && (
          <div className="cp-hero__reqs">
            <p className="cp-hero__reqsTitle" data-fx="reqstitle">{requirementsTitle}</p>
            <div className="cp-hero__reqchips">
              {requirementChips.map((r) => <span key={r} className="cp-hero__reqchip" data-fx="chip">{r}</span>)}
            </div>
          </div>
        )}
        {note && (
          <blockquote className="cp-hero__note">
            “{note}”
            {advisorName && <cite className="cp-hero__signature">- {advisorName} -</cite>}
          </blockquote>
        )}
      </div>
    </div>
  );
}

