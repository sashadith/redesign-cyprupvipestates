"use client";
import React, { FC, useState, useEffect, useRef } from "react";
import useIntersectionObserver from "@/hooks/useIntersectionObserver";

type Props = {
  children: string | number;
};

const CountNumber: FC<Props> = ({ children }) => {
  const targetNumber =
    typeof children === "string" ? parseInt(children, 10) : children;

  // Seeded with the real value so SSR/no-JS output and the first client render
  // both show the true number (crawlers + no-JS never see "0"). The count-up
  // is a purely cosmetic client-side replay on scroll into view, below — it
  // must never leave `count` resting at 0 on any failure path.
  const [count, setCount] = useState(targetNumber);
  // A ref, not state: flipping it must NOT trigger a re-render, or the effect
  // below re-runs (its own dependency changed), tearing down the interval it
  // just started before the very first tick — the exact bug that shipped
  // once already (count set to 0, then immediately cancelled, stuck at 0).
  const hasAnimatedRef = useRef(false);

  const ref = useRef<HTMLParagraphElement>(null);
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

    let start = 0;
    setCount(0);
    const incrementTime = Math.max(1, Math.floor(1000 / end)); // duration of animation (~1 second)

    const timer = setInterval(() => {
      start += 1;
      setCount(start);
      if (start >= end) clearInterval(timer);
    }, incrementTime);

    return () => clearInterval(timer);
  }, [targetNumber, isVisible]);

  return <span ref={ref}>{count}</span>;
};

export default CountNumber;
