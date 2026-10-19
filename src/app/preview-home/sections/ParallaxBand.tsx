"use client";

import { useEffect, useRef, useState } from "react";
import { urlFor } from "@/sanity/sanity.client";
import type { Image as ImageType } from "@/types/homepage";
import { optUrl } from "./OptImg";

/* Parallax band — a full-bleed visual breather. The preview passes a looping
   background video (sunset.mp4, under /preview-assets); production passes the
   uploaded copy, or omits it and uses the CMS `parallaxImage` as the fixed
   background image. Same `.parallax` pinned-background effect either way.

   The video sits far below the fold but used to start downloading (3.9 MB) with the
   page because of `autoPlay`. It now gets its `src` only when the band is about to
   scroll into view, and never on Save-Data connections (poster only). */

const safeUrl = (img: unknown) => {
  try {
    return urlFor(img as never).url();
  } catch {
    return undefined;
  }
};

export default function ParallaxBand({ image, videoSrc }: { image?: ImageType; videoSrc?: string }) {
  const rawPoster = image ? safeUrl(image) : undefined;
  const poster = rawPoster ? optUrl(rawPoster, 1080) : undefined;
  const ref = useRef<HTMLVideoElement | null>(null);
  const [src, setSrc] = useState<string | undefined>();

  useEffect(() => {
    const el = ref.current;
    if (!videoSrc || !el) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSrc(videoSrc);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [videoSrc]);

  useEffect(() => {
    if (src) ref.current?.play().catch(() => {});
  }, [src]);

  return (
    <section className="parallax">
      {videoSrc ? (
        <video
          ref={ref}
          className="parallax__video"
          src={src}
          poster={poster}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          aria-hidden
        />
      ) : (
        poster && <img className="parallax__video" src={poster} alt="" aria-hidden loading="lazy" decoding="async" />
      )}
      <span className="parallax__scrim" aria-hidden />
    </section>
  );
}
