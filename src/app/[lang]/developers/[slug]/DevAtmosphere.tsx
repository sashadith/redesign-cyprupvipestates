"use client";

import { useEffect, useRef, useState } from "react";

type Cloud = {
  id: number;
  top: number;
  left: string;
  size: number;
  opacity: number;
  animationName?: string;
  animationDuration?: string;
};

// Opaque sections a cloud (z-index:-1) would be invisible behind — placing one
// there would just waste it. .dev-catalog__mapwrap's own CSS bg is transparent
// but the Leaflet tiles rendered inside it are visually opaque all the same.
const AVOID_SELECTORS = [".dev-hero", ".dev-catalog__mapwrap", ".formsec"];
const CONTAINER_HALF_WIDTH = 680; // half of --maxw (1360px, tokens.css)
const MIN_GAP = 500;
const MAX_GAP = 700;
const MAX_CLOUDS = 30;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function buildClouds(mainEl: HTMLElement): Cloud[] {
  const height = mainEl.scrollHeight;
  const vw = mainEl.clientWidth || window.innerWidth;
  const containerHalf = Math.min(CONTAINER_HALF_WIDTH, vw / 2);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mainTop = mainEl.getBoundingClientRect().top;

  const avoidRects = AVOID_SELECTORS.map((sel) => mainEl.querySelector(sel))
    .filter((el): el is HTMLElement => !!el)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top - mainTop, bottom: r.bottom - mainTop };
    });

  const clearOpaque = (y: number) => {
    for (const r of avoidRects) {
      if (y >= r.top - 60 && y <= r.bottom + 60) return r.bottom + 80;
    }
    return y;
  };

  const clouds: Cloud[] = [];
  let y = clearOpaque(rand(120, 260));
  let side: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  let id = 0;

  while (y < height - 150 && id < MAX_CLOUDS) {
    const size = Math.round(rand(520, 760));
    const jitter = rand(-140, 140);
    const x = side * (containerHalf + jitter);
    clouds.push({
      id: id++,
      top: Math.round(y),
      left: `calc(50% + ${Math.round(x - size / 2)}px)`,
      size,
      opacity: Number(rand(0.75, 0.95).toFixed(2)),
      animationName: reducedMotion ? undefined : side === 1 ? "cloudDriftB" : "cloudDriftA",
      animationDuration: reducedMotion ? undefined : `${Math.round(rand(24, 34))}s`,
    });
    y = clearOpaque(y + rand(MIN_GAP, MAX_GAP));
    side = side === 1 ? -1 : 1;
  }

  return clouds;
}

// Golden clouds spaced 500-700px down the page, alternating either side of the
// 1360px main container (never a fixed left/right x, never a fixed diameter —
// see buildClouds' jitter/rand calls). Positions are generated client-side
// because they depend on this page's actual rendered height, which varies
// hugely by developer (number of projects).
export default function DevAtmosphere() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [clouds, setClouds] = useState<Cloud[]>([]);

  useEffect(() => {
    const mainEl = rootRef.current?.closest(".dev-atmos-root") as HTMLElement | null;
    if (!mainEl) return;

    let raf = 0;
    const generate = () => setClouds(buildClouds(mainEl));

    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(generate);
    }, 200);

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(generate, 300);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(resizeTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="dev-atmos" aria-hidden="true" ref={rootRef}>
      {clouds.map((c) => (
        <span
          key={c.id}
          style={{
            top: c.top,
            left: c.left,
            width: c.size,
            opacity: c.opacity,
            animationName: c.animationName,
            animationDuration: c.animationDuration,
            animationTimingFunction: c.animationName ? "ease-in-out" : undefined,
            animationIterationCount: c.animationName ? "infinite" : undefined,
            animationDirection: c.animationName ? "alternate" : undefined,
          }}
        />
      ))}
    </div>
  );
}
