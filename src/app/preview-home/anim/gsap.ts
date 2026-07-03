/* Preview-only GSAP setup. Registers ScrollTrigger + SplitText once (client side)
   and re-exports them so every animation component shares one registration.
   Scoped to /preview-home so the live site's bundle/behaviour is unaffected. */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

/** True when the user asked the OS to reduce motion — skip animations entirely. */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Coarse pointer ⇒ treat as touch (smooth scroll / magnetic effects disabled). */
export const isTouchDevice = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** Shared handle to the active Lenis instance (set by LenisProvider) so other
   components can drive smooth programmatic scrolls instead of fighting it with
   native window.scrollTo. Null on touch / reduced-motion (native scroll). */
export const lenisRef: { current: any } = { current: null };

export { gsap, ScrollTrigger, SplitText };
