"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { developmentCopy } from "@/lib/developmentCopy";
import { isPlayableVideoUrl, type ExtraLink } from "@/lib/developmentExtraLinks";
import ExtraLinkIcon, { ExtraLinkArrow } from "./ExtraLinkIcon";

/* The media tiles under the description. A tile whose link is a video FILE
   (our own /uploads) opens VideoModal on the page; everything else — YouTube,
   360° viewers, camera portals — opens the developer's page in a new tab. The
   video tile stays an <a href> so a middle-click, a long-press "open in new
   tab" or a page without JS still reaches the file. */
export default function ExtraLinks({ links, lang, title, poster }: { links: ExtraLink[]; lang: string; title: string; poster?: string }) {
  const t = developmentCopy(lang);
  const en = developmentCopy("en");
  const [playing, setPlaying] = useState<ExtraLink | null>(null);
  if (!links.length) return null;
  return (
    <>
      <div className="pp-extras">
        {links.map((l) => {
          const inPage = isPlayableVideoUrl(l.url);
          return (
            <a
              key={l.kind}
              className="pp-extra"
              href={l.url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              onClick={inPage ? (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setPlaying(l); } : undefined}
            >
              <span className="pp-extra__ic"><ExtraLinkIcon kind={l.kind} /></span>
              <span className="pp-extra__t">{t.extraLinks[l.kind]}</span>
              <span className="pp-extra__s">
                <span>{t.extraLinkCtas?.[l.kind] ?? ""}</span>
                <span className={`pp-extra__go${inPage ? " pp-extra__go--play" : ""}`}><ExtraLinkArrow /></span>
              </span>
              <span className="pp-sr">{` (${inPage ? t.extraLinkPlaysHere ?? en.extraLinkPlaysHere : t.extraLinkNewTab})`}</span>
            </a>
          );
        })}
      </div>
      {playing && (
        <VideoModal
          src={playing.url}
          caption={`${title} · ${t.extraLinks[playing.kind]}`}
          poster={poster}
          closeLabel={t.close}
          fullscreenLabel={t.videoFullscreen ?? en.videoFullscreen ?? "Full screen"}
          onClose={() => setPlaying(null)}
        />
      )}
    </>
  );
}

/* Same contract as Lightbox.tsx: portal to <body>, page (and Lenis) locked
   while open, Escape and a backdrop click close it. The fullscreen button
   takes the VIDEO fullscreen — iOS Safari only allows that on the <video>
   element itself (webkitEnterFullscreen), not on a wrapper. */
function VideoModal({ src, caption, poster, closeLabel, fullscreenLabel, onClose }: {
  src: string; caption: string; poster?: string; closeLabel: string; fullscreenLabel: string; onClose: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const lenis = (window as any).lenis;
    lenis?.stop();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.fullscreenElement) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      lenis?.start();
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const fullscreen = () => {
    const v = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="pp-vm" role="dialog" aria-modal="true" aria-label={caption} onClick={onClose}>
      <div className="pp-vm__box" onClick={(e) => e.stopPropagation()}>
        <div className="pp-vm__bar">
          <span className="pp-vm__cap">{caption}</span>
          <span className="pp-vm__btns">
            <button type="button" className="pp-vm__btn" onClick={fullscreen} aria-label={fullscreenLabel} title={fullscreenLabel}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
            </button>
            <button type="button" className="pp-vm__btn" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </span>
        </div>
        <video ref={ref} className="pp-vm__video" src={src} poster={poster} controls autoPlay playsInline preload="metadata" />
      </div>
    </div>,
    document.body,
  );
}
