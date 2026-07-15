"use client";

import { useRef, useState } from "react";

// Native horizontal scroll-snap track (no JS gesture library) so touch drag
// feels native and vertical page scroll is untouched. A tap that didn't move
// the scroll position opens the full lightbox; a tap that ended a swipe does
// not — the scroll-flag below distinguishes the two.
export default function OverlayGallery({
  gallery, alt, onOpen,
}: {
  gallery: string[];
  alt: string;
  onOpen: (index: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const scrolledRef = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const n = gallery.length;

  const handleScroll = () => {
    scrolledRef.current = true;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => { scrolledRef.current = false; }, 150);
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(Math.max(0, Math.min(n - 1, i)));
  };

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: ((i + n) % n) * el.clientWidth, behavior: "smooth" });
  };

  const handleSlideClick = (i: number) => {
    if (scrolledRef.current) return; // a swipe just happened — don't open the lightbox
    onOpen(i);
  };

  if (n === 0) return null;

  const maxDots = 8;
  const dotCount = Math.min(n, maxDots);

  return (
    <div className="cp-overlay__gallery">
      <div className="cp-overlay__track" ref={trackRef} onScroll={handleScroll}>
        {gallery.map((src, i) => (
          <div key={i} className="cp-overlay__slide">
            <button type="button" className="cp-overlay__slidebtn" onClick={() => handleSlideClick(i)} aria-label={`Open image ${i + 1}`}>
              <img src={src} alt={i === 0 ? alt : ""} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
            </button>
          </div>
        ))}
      </div>
      {n > 1 && (
        <>
          <span className="cp-overlay__heroCount">{index + 1} / {n}</span>
          <button type="button" className="cp-overlay__navbtn cp-overlay__navbtn--prev" onClick={() => goTo(index - 1)} aria-label="Previous">‹</button>
          <button type="button" className="cp-overlay__navbtn cp-overlay__navbtn--next" onClick={() => goTo(index + 1)} aria-label="Next">›</button>
          <div className="cp-overlay__dots">
            {Array.from({ length: dotCount }).map((_, di) => {
              const isActive = dotCount === n ? di === index : di === Math.round((index / (n - 1)) * (dotCount - 1));
              return <span key={di} className={`cp-overlay__dot${isActive ? " is-on" : ""}`} />;
            })}
          </div>
        </>
      )}
    </div>
  );
}
