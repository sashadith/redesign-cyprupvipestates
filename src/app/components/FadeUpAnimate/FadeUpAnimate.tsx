"use client";
import React, { useEffect, ReactElement, useState } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

type Props = {
  children: ReactElement;
  delay?: number;
};

const FadeUpAnimate = ({ children, delay = 0 }: Props) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    AOS.init({ once: true });

    // определить ширину при монтировании
    if (typeof window !== "undefined") {
      setIsMobile(window.innerWidth < 768);
    }
  }, []);

  const effectiveDelay = isMobile ? 0 : delay;

  return React.cloneElement(children, {
    "data-aos": "fade-up",
    "data-aos-delay": effectiveDelay,
  });
};

export default FadeUpAnimate;
