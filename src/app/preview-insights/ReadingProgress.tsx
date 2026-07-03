"use client";

import { useEffect, useState } from "react";

/* Reading-progress bar, fixed directly under the top menu. Rendered at page level
   (NOT inside the TOC aside) so it stays viewport-fixed — an animated/transformed
   ancestor would otherwise become its containing block and mis-position it. Tracks
   scroll through the .iart__content element. */
export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const content = document.querySelector<HTMLElement>(".iart__content");

    const onScroll = () => {
      const vh = window.innerHeight;
      const top = content ? content.offsetTop : 0;
      const height = content ? content.offsetHeight : document.documentElement.scrollHeight;
      const total = Math.max(1, height - vh);
      const p = Math.min(1, Math.max(0, (window.scrollY - top) / total));
      setProgress(p);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="iart__progress" aria-hidden>
      <div className="iart__progress-bar" style={{ width: `${(progress * 100).toFixed(2)}%` }} />
    </div>
  );
}
