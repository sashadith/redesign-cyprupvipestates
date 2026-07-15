// Standalone, zero-side-effect version of the same check in
// src/app/preview-home/anim/gsap.ts — that file is intentionally scoped to
// /preview-home (its own comment says so) and registers GSAP's SplitText
// plugin as a MODULE-LEVEL side effect the moment it's imported. Importing
// it just for this one-line helper (as src/app/c/[token]/HeroGreeting.tsx
// used to) pulled that registration into the client-presentation route too —
// if it ever throws there, the whole component fails to render, blanking the
// hero. This file has no GSAP dependency at all, so it can't fail that way.
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
