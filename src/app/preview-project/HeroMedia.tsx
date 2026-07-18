"use client";

import React, { useState } from "react";
import { atSize } from "./imageSize";
import Lightbox from "./Lightbox";

/* Full-bleed hero — a looping video if provided, otherwise the selected main
   image; either way a "View N photos" button opens the whole gallery lightbox
   (with a thumbnail strip). Main image index 0 is the admin-selected cover. */
export default function HeroMedia({ images, alt, galleryLabel, videoUrl }: { images: string[]; alt: string; galleryLabel: string; videoUrl?: string }) {
  const imgs = images.filter(Boolean);
  const [lb, setLb] = useState<number | null>(null);

  return (
    <>
      {videoUrl ? (
        <div className="pp-hero__img pp-hero__img--video">
          <video className="pp-hero__video" src={videoUrl} poster={atSize(imgs[0] ?? "", "large")} autoPlay muted loop playsInline preload="metadata" />
        </div>
      ) : (
        <button className="pp-hero__img" type="button" onClick={() => setLb(0)} aria-label="Open gallery">
          {/* Plain <img>, not next/image (external CDN URLs) — fetchPriority is
              the equivalent of next/image's `priority` for this element, the
              page's LCP candidate. Missing on every Development detail page
              until this fix (2026-07-19, same CWV rollout as the homepage/blog
              hero fixes). */}
          {imgs[0] ? <img src={atSize(imgs[0], "large")} alt={alt} fetchPriority="high" decoding="async" /> : <span className="pp-hero__ph" />}
        </button>
      )}
      {imgs.length > 1 && (
        <button className="pp-hero__galbtn" type="button" onClick={() => setLb(0)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          {galleryLabel.replace("{n}", String(imgs.length))}
        </button>
      )}
      <Lightbox images={imgs} index={lb} onIndex={setLb} onClose={() => setLb(null)} alt={alt} />
    </>
  );
}
