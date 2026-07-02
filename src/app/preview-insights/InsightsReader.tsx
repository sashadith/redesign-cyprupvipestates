"use client";

import React, { useEffect, useRef, useState } from "react";

type Heading = { id: string; text: string };

/* Sticky table of contents with scroll-spy. The TOC highlights the heading
   currently in view and scrolls to it on click. (The reading-progress bar lives
   in ReadingProgress, mounted at page level.) */

export default function InsightsReader({ headings, label = "On this page" }: { headings: Heading[]; label?: string }) {
  const [active, setActive] = useState<string>(headings[0]?.id ?? "");
  const navRef = useRef<HTMLElement>(null);

  // keep the active item visible inside the (scrollable) sticky TOC
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || !active) return;
    const link = nav.querySelector<HTMLElement>(`a[href="#${CSS.escape(active)}"]`);
    if (!link) return;
    const top = link.offsetTop;
    const bottom = top + link.offsetHeight;
    if (top < nav.scrollTop || bottom > nav.scrollTop + nav.clientHeight) {
      nav.scrollTo({ top: top - nav.clientHeight / 2 + link.offsetHeight / 2, behavior: "smooth" });
    }
  }, [active]);

  useEffect(() => {
    // scroll-spy: which heading is currently near the top
    const els = headings.map((h) => document.getElementById(h.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));

    return () => obs.disconnect();
  }, [headings]);

  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: y, behavior: "smooth" });
    setActive(id);
  };

  return (
    <>
      {headings.length > 1 && (
        <nav className="iart__toc" aria-label={label} ref={navRef}>
          <p className="iart__toc-label">{label}</p>
          <ul>
            {headings.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  className={`iart__toc-link ${active === h.id ? "is-active" : ""}`}
                  onClick={(e) => go(e, h.id)}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
