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
  // is a purely client-side replay triggered on scroll into view, below.
  const [count, setCount] = useState(targetNumber);
  const [hasCounted, setHasCounted] = useState(false);

  const ref = useRef<HTMLParagraphElement>(null);
  const isVisible = useIntersectionObserver(ref);

  useEffect(() => {
    if (!isVisible || hasCounted) return;
    setHasCounted(true);

    const end = targetNumber;
    if (!end || end <= 0) return;

    let start = 0;
    setCount(0);
    const incrementTime = Math.max(1, Math.floor(1000 / end)); // duration of animation (~1 second)

    const timer = setInterval(() => {
      start += 1;
      setCount(start);
      if (start >= end) clearInterval(timer);
    }, incrementTime);

    return () => clearInterval(timer);
  }, [targetNumber, isVisible, hasCounted]);

  return <span ref={ref}>{count}</span>;
};

export default CountNumber;
