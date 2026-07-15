import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/lib/prefersReducedMotion";

/* Isolated animation setup for THIS route only — deliberately not imported
   from src/app/preview-home/anim/gsap.ts. That file registers SplitText as a
   module-level side effect the instant it's imported, and a prior outage on
   this exact page traced back to exactly that: a component here imported one
   helper from it, silently inherited the plugin registration, and when that
   registration misbehaved the whole hero went blank. This file registers
   only ScrollTrigger (which this page's scroll reveals actually need) and
   never touches SplitText — and the registration itself is try/caught, so
   even a ScrollTrigger failure can't crash an importer at module-load time. */
if (typeof window !== "undefined") {
  try {
    gsap.registerPlugin(ScrollTrigger);
  } catch (e) {
    console.warn("GSAP ScrollTrigger failed to register — scroll animations disabled, content stays visible:", e);
  }
}

export { gsap, ScrollTrigger };

export const MOBILE_BREAKPOINT = 768;
export const isMobileViewport = () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

type Vars = Record<string, any>;
type GsapContext = ReturnType<typeof gsap.context>;

// ---------- the two core effects ----------

// FOCUS REVEAL — for text: blur + slight rise into sharp focus.
export function focusRevealVars(mobile: boolean, opts: { blur?: number; duration?: number } = {}): { from: Vars; to: Vars } {
  const blur = mobile ? 8 : (opts.blur ?? 14); // mobile caps blur outright — GPUs choke on large blur radii
  const baseDuration = opts.duration ?? 1.1;
  const duration = mobile ? baseDuration * 0.8 : baseDuration;
  return {
    from: { opacity: 0, filter: `blur(${blur}px)`, y: 12, willChange: "filter" },
    to: { opacity: 1, filter: "blur(0px)", y: 0, duration, ease: "power2.out", clearProps: "willChange,filter" },
  };
}

// DEEP FADE — for images/blocks: fade + very slight scale, no blur (blur on
// large containers/images is the expensive, janky case this avoids).
export function deepFadeVars(mobile: boolean, opts: { duration?: number; brightness?: boolean; opacity?: number } = {}): { from: Vars; to: Vars } {
  const baseDuration = opts.duration ?? 1.3;
  const duration = mobile ? baseDuration * 0.8 : baseDuration;
  const from: Vars = { opacity: 0, scale: 1.015 };
  const to: Vars = { opacity: opts.opacity ?? 1, scale: 1, duration, ease: "power2.out" };
  if (opts.brightness) {
    from.filter = "brightness(0.6)";
    to.filter = "brightness(1)";
  }
  return { from, to };
}

// ---------- fail-safe wrapper ----------
//
// gsap.context(fn, scope) only constructs a real Context if fn is truthy — if
// fn throws partway through, the whole `new Context(...)` call throws too, so
// a caught exception here can't rely on gsap's own ctx.revert() to clean up
// (there may be no ctx reference to call it on: the assignment itself never
// completed). So the actual fail-safe doesn't depend on gsap.context() at
// all: `setup` calls track(el) for every element it's about to gsap.set() to
// a hidden state, and that array lives OUTSIDE the try block — synchronous
// pushes always complete even if the very next line throws. If anything in
// `setup` throws, the catch block force-clears every tracked element back to
// its plain CSS state (visible, since nothing here is ever hidden by static
// CSS) regardless of how far the setup got, and kills any ScrollTrigger that
// was orphaned mid-creation. gsap.context/ctx.revert() is still used for the
// HAPPY path's cleanup (kills timelines/ScrollTriggers on unmount).
export function safeReveal(
  rootEl: Element | null,
  setup: (root: Element, track: <T>(el: T) => T) => void
): () => void {
  if (!rootEl || typeof window === "undefined") return () => {};
  if (prefersReducedMotion()) return () => {};

  const hidden: any[] = [];
  const track = <T,>(el: T): T => { hidden.push(el); return el; };
  const stBefore = ScrollTrigger.getAll().length;
  let ctx: GsapContext | null = null;

  try {
    ctx = gsap.context(() => setup(rootEl, track), rootEl);
  } catch (e) {
    console.warn("Reveal animation failed — showing content immediately:", e);
    if (hidden.length) gsap.set(hidden, { clearProps: "all" });
    ScrollTrigger.getAll().slice(stBefore).forEach((st) => st.kill());
  }
  return () => { try { ctx?.revert(); } catch { /* already gone */ } };
}

export { prefersReducedMotion };
