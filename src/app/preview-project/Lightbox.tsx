"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { atSize } from "./imageSize";
import { developmentCopy } from "@/lib/developmentCopy";

/* Shared fullscreen image viewer: prev/next, keyboard, counter, and a clickable
   thumbnail strip that keeps the active thumb centred (clamping at the ends).
   Rendered through a portal to <body> so it can never be trapped/clipped by a
   transformed ancestor (unit cards), and it locks the page — including the
   Lenis smooth-scroll on window.lenis — so the background can't scroll. */
export default function Lightbox({
  images, index, onClose, onIndex, alt = "", lang = "en",
}: {
  images: string[]; index: number | null; onClose: () => void; onIndex: (i: number) => void; alt?: string; lang?: string;
}) {
  const t = developmentCopy(lang);
  const n = images.length;
  const activeRef = useRef<HTMLButtonElement>(null);
  const lastWheel = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // lock the page (native + Lenis) and wire keyboard nav while open
  useEffect(() => {
    if (index === null) return;
    const lenis = (window as any).lenis;
    lenis?.stop();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % n);
      if (e.key === "ArrowLeft") onIndex((index - 1 + n) % n);
    };
    // switch images by scrolling — throttled so one gesture = one image
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 20) return;
      const now = Date.now();
      if (now - lastWheel.current < 450) return;
      lastWheel.current = now;
      onIndex((index + (delta > 0 ? 1 : -1) + n) % n);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      lenis?.start();
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [index, n, onClose, onIndex]);

  // keep the active thumbnail centred; the browser clamps at the strip's ends,
  // so it sits left at the start, centred in the middle, right at the end
  useEffect(() => {
    if (index === null) return;
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [index]);

  if (index === null || n === 0 || typeof document === "undefined") return null;
  const go = (d: number) => onIndex((index + d + n) % n);

  // Rendered via a portal, but React still bubbles synthetic events through
  // the COMPONENT tree, not the DOM tree — without stopPropagation, closing
  // the lightbox here also reaches whatever ancestor component (e.g.
  // PropertyOverlay) rendered <Lightbox>, closing that too if it has its own
  // backdrop onClick={onClose}.
  const closeSelf = (e: React.SyntheticEvent) => { e.stopPropagation(); onClose(); };

  // Finger swipe on mobile — a real drag doesn't fire a click afterwards, so
  // this coexists with closeSelf's tap-to-close without extra guarding.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || n < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    go(dx < 0 ? 1 : -1);
  };

  return createPortal(
    <div className="pp-lb" role="dialog" aria-modal="true" onClick={closeSelf} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <button className="pp-lb__close" type="button" aria-label={t.close} onClick={closeSelf}>✕</button>
      <span className="pp-lb__count">{index + 1} / {n}</span>
      <div className="pp-lb__stage">
        {n > 1 && <button className="pp-lb__nav pp-lb__nav--prev" type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label={t.previous}>‹</button>}
        <img className="pp-lb__img" src={atSize(images[index], "large")} alt={alt} onClick={(e) => e.stopPropagation()} />
        {n > 1 && <button className="pp-lb__nav pp-lb__nav--next" type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label={t.next}>›</button>}
      </div>
      {n > 1 && (
        <div className="pp-lb__thumbs" onClick={(e) => e.stopPropagation()}>
          {images.map((src, i) => (
            <button key={i} ref={i === index ? activeRef : undefined} className={`pp-lb__thumb${i === index ? " is-on" : ""}`} type="button" onClick={() => onIndex(i)} aria-label={t.imageN(i + 1)}>
              <img src={atSize(src, "small")} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
