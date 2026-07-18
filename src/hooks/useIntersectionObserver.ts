import { useState, useEffect, RefObject } from "react";

// Stable identity across renders — an inline `= {}` default parameter creates a
// NEW object every render, which used to make the effect below re-run (and the
// observer disconnect/reconnect) on every single consumer re-render.
const DEFAULT_OPTIONS: IntersectionObserverInit = {};

const useIntersectionObserver = (
  ref: RefObject<Element>,
  options: IntersectionObserverInit = DEFAULT_OPTIONS
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [ref, options]);

  return isIntersecting;
};

export default useIntersectionObserver;
