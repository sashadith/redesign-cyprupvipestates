"use client";

import { useEffect, useState } from "react";

/* Sticky table of contents with scroll-spy.

   Legal pages are scanned, not read — people arrive looking for one clause
   ("how long do they keep my data?"). The TOC is the primary navigation, so
   it highlights the section currently in view and stays put while you scroll.

   Rendered as real anchor links, so it works with JS disabled and is
   keyboard-navigable by default; the highlighting is the only enhancement. */

export default function LegalToc({
  label,
  sections,
}: {
  label: string;
  sections: { id: string; title: string }[];
}) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!targets.length) return;

    // rootMargin pulls the trigger line to roughly a third down the viewport,
    // so a heading counts as "current" once it has actually settled into
    // reading position rather than the instant it clips the top edge.
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav className="lgl__toc" aria-label={label}>
      <p className="lgl__toc-label">{label}</p>
      <ol className="lgl__toc-list">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              className={`lgl__toc-link${active === s.id ? " is-active" : ""}`}
              href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
            >
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
