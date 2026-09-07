"use client";

import React, { useState } from "react";
import { atSize } from "./imageSize";
import Lightbox from "./Lightbox";

/* Full-bleed hero — a looping video if provided, otherwise the selected main
   image; either way a "View N photos" button opens the whole gallery lightbox
   (with a thumbnail strip). Main image index 0 is the admin-selected cover. */
export default function HeroMedia({
  images, alt, galleryLabel, openGalleryLabel, lang = "en", videoUrl,
}: {
  images: string[]; alt: string; galleryLabel: string; openGalleryLabel: string; lang?: string; videoUrl?: string;
}) {
  const imgs = images.filter(Boolean);
  const [lb, setLb] = useState<number | null>(null);
  const hasMultiple = imgs.length > 1;

  return (
    <>
      {videoUrl ? (
        <div className="pp-hero__img pp-hero__img--video">
          <video className="pp-hero__video" src={videoUrl} poster={atSize(imgs[0] ?? "", "large")} autoPlay muted loop playsInline preload="metadata" />
        </div>
      ) : (
        <>
          {/* Desktop: unchanged — single static image, click opens the
              lightbox. Hidden below the mobile breakpoint (in favour of the
              swipe strip below) only when there's more than one photo; with
              just one, this is the only markup rendered for every viewport —
              a one-item "carousel" isn't one. */}
          <button
            className={`pp-hero__img${hasMultiple ? " pp-hero__img--desktop" : ""}`}
            type="button"
            onClick={() => setLb(0)}
            aria-label={openGalleryLabel}
          >
            {/* Plain <img>, not next/image (external CDN URLs) — fetchPriority is
                the equivalent of next/image's `priority` for this element, the
                page's LCP candidate. Missing on every Development detail page
                until this fix (2026-07-19, same CWV rollout as the homepage/blog
                hero fixes). */}
            {imgs[0] ? <img src={atSize(imgs[0], "large")} alt={alt} fetchPriority="high" decoding="async" /> : <span className="pp-hero__ph" />}
          </button>

          {hasMultiple && (
            // Mobile only (CSS-hidden at desktop widths): native horizontal
            // scroll + snap, no JS carousel. Each slide is its own button so
            // swipe-to-browse and tap-to-enlarge both work, matching what the
            // desktop button already does. Only the first image is eager
            // (fetchPriority) and unset loading; the rest are loading="lazy"
            // and, being laid out off the initial viewport, don't fetch until
            // swiped near.
            <div className="pp-hero__strip" role="group" aria-label={galleryLabel}>
              {imgs.map((src, i) => (
                <button
                  key={src + i}
                  className="pp-hero__slide"
                  type="button"
                  onClick={() => setLb(i)}
                  aria-label={openGalleryLabel}
                >
                  <img
                    src={atSize(src, "large")}
                    alt={alt}
                    decoding="async"
                    {...(i === 0 ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {imgs.length > 1 && (
        <button className="pp-hero__galbtn" type="button" onClick={() => setLb(0)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          {galleryLabel}
        </button>
      )}
      <Lightbox images={imgs} index={lb} onIndex={setLb} onClose={() => setLb(null)} alt={alt} lang={lang} />
    </>
  );
}
