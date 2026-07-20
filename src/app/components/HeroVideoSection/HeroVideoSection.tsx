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

    // Важно: пробуем play сразу после монтирования
    (async () => {
      try {
        await el.play();
      } catch {
        // autoplay может быть заблокирован — тогда постер останется (это ок)
      }
    })();

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
          autoPlay
          muted
          loop
          playsInline
          // Was "auto": the browser started eagerly downloading the ENTIRE
          // hero video (10.5MB, confirmed via a live PSI run 2026-07-20) at
          // high priority from parse time, competing for bandwidth with the
          // poster image (this page's actual LCP element, already `priority`
          // via next/image below) and every other above-the-fold asset —
          // under Lighthouse's throttled mobile network simulation this
          // showed up as the dominant contributor to a ~10-20s LCP. "none"
          // means the browser doesn't fetch until the `el.play()` call in
          // the effect below actually runs, at normal (not elevated) request
          // priority — no visual change: the poster overlay already covers
          // the video until `isVideoReady` flips, exactly as before.
          preload="none"
          // poster можно оставить как фоллбек, но главный контроль у overlay:
          poster={posterUrl}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}
    </div>
  );
};

export default HeroVideoSection;
