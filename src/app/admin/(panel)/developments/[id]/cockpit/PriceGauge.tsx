"use client";

import { useEffect, useRef, useState } from "react";

/* The price gauge: a semicircle spanning the cheapest-to-dearest available
   unit, with the marker on the MEDIAN rather than the mean. The median is what
   a half-sold scheme actually looks like — one 1.1m penthouse drags a mean
   upward and tells the viewer something untrue about the stock on the floor.

   The arc, the marker and the number are all derived from ONE animated value,
   so they can never disagree mid-flight: a separate count-up timer and a CSS
   arc transition drift apart on a slow frame and show a number the marker is
   not pointing at. */

const CX = 150, CY = 150, R = 120;
const ARC = Math.PI * R; // length of the semicircle stroke
const DURATION = 900;

const pointAt = (f: number) => {
  const theta = Math.PI * (1 - Math.min(Math.max(f, 0), 1)); // 180° → 0°
  return { x: CX + R * Math.cos(theta), y: CY - R * Math.sin(theta) };
};

// Ticks are decoration with a job: they give the eye something to measure the
// marker against on an arc that otherwise has no scale at all.
const TICKS = Array.from({ length: 41 }, (_, i) => i / 40);

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export default function PriceGauge({
  min, max, median, format,
}: {
  min: number; max: number; median: number;
  /** Pre-resolved on the server so the client never guesses a locale. */
  format: { prefix: string; thousands: string };
}) {
  const span = Math.max(max - min, 1);
  const target = (median - min) / span;
  const [p, setP] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setP(target); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - t0) / DURATION, 1);
      setP(easeOut(t) * target);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target]);

  const marker = pointAt(p);
  const shown = Math.round(min + p * span);

  return (
    <div className="ck__gaugeWrap">
      <svg className="ck__gaugeSvg" viewBox="0 0 300 176" role="img"
        aria-label={`Median price ${format.prefix}${median.toLocaleString(format.thousands)}, range ${format.prefix}${min.toLocaleString(format.thousands)} to ${format.prefix}${max.toLocaleString(format.thousands)}`}>
        {TICKS.map((f, i) => {
          const a = Math.PI * (1 - f);
          const long = i % 5 === 0;
          const r1 = R - 15, r2 = long ? R - 25 : R - 21;
          return (
            <line key={f}
              x1={CX + r1 * Math.cos(a)} y1={CY - r1 * Math.sin(a)}
              x2={CX + r2 * Math.cos(a)} y2={CY - r2 * Math.sin(a)}
              stroke="rgba(34,28,21,0.16)" strokeWidth={long ? 1.4 : 1} strokeLinecap="round" />
          );
        })}
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none" stroke="rgba(34,28,21,0.10)" strokeWidth="10" strokeLinecap="round" />
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none" stroke="var(--champagne, #C29A5E)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={ARC} strokeDashoffset={ARC * (1 - p)} />
        <circle cx={marker.x} cy={marker.y} r="9" fill="#FFFFFF" stroke="var(--champagne, #C29A5E)" strokeWidth="3" />
      </svg>

      <div className="ck__gaugeCentre">
        <div className="ck__gaugeNum">{format.prefix}{shown.toLocaleString(format.thousands)}</div>
        <div className="ck__gaugeLabel">Median of available units</div>
      </div>

      <div className="ck__gaugeEnds">
        <span>Lowest<b>{format.prefix}{min.toLocaleString(format.thousands)}</b></span>
        <span style={{ textAlign: "right" }}>Highest<b>{format.prefix}{max.toLocaleString(format.thousands)}</b></span>
      </div>
    </div>
  );
}
