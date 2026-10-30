"use client";

import React, { FC, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import styles from "./HeroVideoSection.module.scss";
import { Image as SanityImage } from "@/types/homepage";
import { urlFor } from "@/sanity/sanity.client"; // <-- подставь свой импорт urlFor

type Props = {
  video?: {
    _type: "file";
    asset?: {
      _ref: string;
      url: string;
    };
  };
  posterImage?: SanityImage;
  heroTitle?: string;
};

const HeroVideoSection: FC<Props> = ({ video, posterImage, heroTitle }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);

  const videoSrc = video?.asset?.url;

  // Постер лучше рендерить как отдельный img-слой.
  // Ты сказал, что URL берёшь через urlFor — делаем так:
  const posterUrl = useMemo(() => {
    if (!posterImage) return undefined;
    try {
      // подстрой ширину под свой hero (например 1920)
      return urlFor(posterImage).width(1920).quality(80).url();
    } catch {
      return undefined;
    }
  }, [posterImage]);

  useEffect(() => {
    if (!videoSrc) return;
    const el = videoRef.current;
    if (!el) return;

    const markReady = () => setIsVideoReady(true);
    const markError = () => setHasVideoError(true);

    // 1) Если уже готово — скрываем сразу
    if (el.readyState >= 2) markReady();

    // 2) Быстрые события
    const onLoadedData = () => markReady();
    const onPlaying = () => markReady();

    // 3) Самый надёжный: как только видео реально пошло
    const onTimeUpdate = () => {
      if (el.currentTime > 0) markReady();
    };

    el.addEventListener("loadeddata", onLoadedData);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("error", markError);

    // Operator decision 2026-10-30: the hero video plays at once on every device, phones included (it
    // was poster-only on phones and delayed 4 s on desktop since 2026-10-19 for PageSpeed — the accepted
    // cost is a lower lab score). `autoPlay` starts it at parse time; this call only covers browsers that
    // ignored the attribute. Blocked autoplay (e.g. iOS Low Power Mode) keeps the poster.
    el.play().catch(() => {});

    return () => {
      el.removeEventListener("loadeddata", onLoadedData);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("error", markError);
    };
  }, [videoSrc]);

  const showPosterOverlay = !isVideoReady || hasVideoError;

  return (
    <div
      className={styles.heroVideoSection}
      aria-label={heroTitle ?? "Hero video"}
    >
      {/* POSTER OVERLAY */}
      {posterUrl && (
        <Image
          className={`${styles.poster} ${showPosterOverlay ? styles.posterVisible : styles.posterHidden}`}
          src={posterUrl}
          alt={heroTitle ?? "Cyprus VIP Estates"}
          fill
          sizes="100vw"
          quality={80}
          priority
        />
      )}

      {/* VIDEO */}
      {videoSrc && !hasVideoError && (
        <video
          ref={videoRef}
          className={styles.video}
          muted
          loop
          playsInline
          autoPlay
          // "auto" (2026-10-30): the video is wanted at once on every device. Until 2026-10-30 this was
          // "none" so the 6+ MB file did not compete with the poster (the LCP element) for bandwidth.
          preload="auto"
          // No `poster` attribute: the next/image overlay above already is the poster. The attribute made the
          // browser fetch the raw 1920 px JPEG a second time (146 KB, High priority) in the CSS window (2026-10-19).
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}
    </div>
  );
};

export default HeroVideoSection;
