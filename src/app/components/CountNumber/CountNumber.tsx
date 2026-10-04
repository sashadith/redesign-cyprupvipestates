"use client";
import React, { FC, useState, useEffect, useRef } from "react";
import useIntersectionObserver from "@/hooks/useIntersectionObserver";

type Props = {
  children: string | number;
  /** BCP47 tag for the thousands separator. Passed explicitly rather than
      letting toLocaleString() pick the environment default, which differs
      between the server and the visitor's browser and would desync hydration. */
  locale?: string;
};

/* Fixed duration for every counter, instead of one tick per unit. The old
   implementation ran setInterval at max(1, 1000/target) ms and stepped by 1,
   which is fine at 195 but means 4,636 React renders — and over four seconds —
   for a units figure in the thousands. */
const DURATION_MS = 1200;

const CountNumber: FC<Props> = ({ children, locale }) => {
  const targetNumber =
    typeof children === "string" ? parseInt(children, 10) : children;

  // Seeded with the real value so SSR/no-JS output and the first client render
  // both show the true number (crawlers + no-JS never see "0"). The count-up
  // is a purely cosmetic client-side replay on scroll into view, below — it
  // must never leave `count` resting at 0 on any failure path.
  const [count, setCount] = useState(targetNumber);
  // A ref, not state: flipping it must NOT trigger a re-render, or the effect
  // below re-runs (its own dependency changed), tearing down the animation it
  // just started before the very first frame — the exact bug that shipped
  // once already (count set to 0, then immediately cancelled, stuck at 0).
  const hasAnimatedRef = useRef(false);

  const ref = useRef<HTMLSpanElement>(null);
  const isVisible = useIntersectionObserver(ref);

  useEffect(() => {
    if (!isVisible || hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    const end = targetNumber;
    if (!end || end <= 0) return;

    // Respect reduced-motion: skip the animation, keep the real number.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let raf = 0;
    const started = performance.now();
    const frame = (now: number) => {
      const p = Math.min(1, (now - started) / DURATION_MS);
      setCount(Math.round(end * (1 - Math.pow(1 - p, 3)))); // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    setCount(0);
    raf = requestAnimationFrame(frame);

    // Landing on the target is the whole point of this cleanup. isVisible flips
    // to false the moment the band scrolls out of view, which tears the effect
    // down mid-count; the previous version only cleared its interval, so the
    // number stayed frozen at whatever it had reached — 195 was left showing
    // 141, 360 showing 143 (reported 2026-09-29). hasAnimatedRef means it never
    // replays either, so the wrong figure was permanent until a reload.
    return () => {
      cancelAnimationFrame(raf);
      setCount(end);
    };
  }, [targetNumber, isVisible]);

  return <span ref={ref}>{locale ? count.toLocaleString(locale) : count}</span>;
};

export default CountNumber;
