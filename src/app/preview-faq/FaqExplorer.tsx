"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion, lenisRef } from "../preview-home/anim/gsap";
import { faqRevealAllRef } from "./FaqMotion";
import type { FaqCategory } from "./faqData";

/* The FAQ browser: category chips, one accordion section per category,
   multi-open items (unlike the single-open article FaqAccordion — here
   readers reasonably want to compare two answers side by side).

   Filtering (active category) is CSS-only (grid-template-rows 0fr↔1fr
   collapse on .faqp__item, same technique as the open/close answer panel)
   rather than GSAP Flip — a single column just needs a height collapse
   (Flip earns its cost in InsightsList's card GRID, which actually reflows
   into new positions). */

const Chevron = () => (
  <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden>
    <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function FaqExplorer({ categories }: { categories: FaqCategory[] }) {
  const [activeCat, setActiveCat] = useState<string>("all");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const visibleCats = activeCat === "all" ? categories : categories.filter((c) => c.slug === activeCat);
  const totalVisible = visibleCats.reduce((n, c) => n + c.items.length, 0);
  const totalAll = categories.reduce((n, c) => n + c.items.length, 0);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allVisibleIds = useMemo(
    () => visibleCats.flatMap((c) => c.items.map((it) => it.id)),
    [visibleCats],
  );
  const allExpanded = allVisibleIds.length > 0 && allVisibleIds.every((id) => openIds.has(id));
  const toggleAll = () => setOpenIds(allExpanded ? new Set() : new Set(allVisibleIds));

  const navSelector = ".nav";
  const scrollTo = (el: HTMLElement | null) => {
    if (!el) return;
    // Only the top nav is fixed/sticky now — the toolbar scrolls away with the
    // page, so its height is no longer reserved space to subtract here.
    const navH = document.querySelector(navSelector)?.getBoundingClientRect().height ?? 74;
    const targetY = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - (navH + 16)));
    const lenis = (typeof window !== "undefined" && (window as any).lenis) || lenisRef.current;
    if (lenis && typeof lenis.scrollTo === "function") lenis.scrollTo(targetY, { duration: 0.9 });
    else window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  const selectCat = (slug: string) => {
    setActiveCat(slug);
    try {
      window.history.replaceState(window.history.state, "", slug === "all" ? "#" : `#${slug}`);
    } catch { /* best-effort */ }
    if (slug !== "all") window.setTimeout(() => scrollTo(listRef.current), 60);
  };

  // Deep-link on load: a category slug (#costs) or a specific question id
  // (#what-is-off-plan-property-mean, matching FaqItem.id) opens straight to it.
  useEffect(() => {
    setHydrated(true);
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!hash) return;
    if (categories.some((c) => c.slug === hash)) {
      setActiveCat(hash);
      window.setTimeout(() => scrollTo(listRef.current), 400);
      return;
    }
    const owner = categories.find((c) => c.items.some((it) => it.id === hash));
    if (owner) {
      setActiveCat(owner.slug);
      setOpenIds(new Set([hash]));
      window.setTimeout(() => {
        const el = document.getElementById(`faq-${hash}`);
        scrollTo(el);
      }, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The instant a category filter is active, force-complete every pending
  // category entrance animation (see faqRevealAllRef in FaqMotion) —
  // otherwise a category the user hasn't scrolled to yet would be switched
  // into view but still invisible under its own pending scroll-reveal opacity.
  useEffect(() => {
    if (activeCat !== "all") faqRevealAllRef.current?.();
  }, [activeCat]);

  // Re-measure ScrollTrigger after any filter/expand change reshapes the page.
  useEffect(() => {
    if (!hydrated || prefersReducedMotion()) return;
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 380);
    return () => window.clearTimeout(t);
  }, [activeCat, hydrated]);

  return (
    <>
      <div className="faqp__toolbar">
        <div className="wrap faqp__toolbar-row">
          <div className="faqp__chips" role="tablist" aria-label="FAQ categories">
            <button className={`faqp__chip ${activeCat === "all" ? "is-active" : ""}`} onClick={() => selectCat("all")}>
              All <span className="faqp__chip-n">{totalAll}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                className={`faqp__chip ${activeCat === c.slug ? "is-active" : ""}`}
                onClick={() => selectCat(c.slug)}
              >
                {c.label} <span className="faqp__chip-n">{c.items.length}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="wrap faqp__meta-row">
        <p className="faqp__count" aria-live="polite">{totalVisible} questions</p>
        {allVisibleIds.length > 1 && (
          <button type="button" className="faqp__toggleall" onClick={toggleAll}>
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      <div className="faqp__list" ref={listRef}>
        {visibleCats.map((cat) => (
          <section className="faqp__cat" id={cat.slug} key={cat.slug}>
            <div className="wrap">
              <div className="faqp__cat-head">
                <h2 className="faqp__cat-title">{cat.label}</h2>
                <p className="faqp__cat-desc">{cat.description}</p>
              </div>
              <div className="faqp__items">
                {cat.items.map((it) => {
                  const isOpen = openIds.has(it.id);
                  const panelId = `faqp-a-${it.id}`;
                  const btnId = `faqp-q-${it.id}`;
                  return (
                    <div className={`faqp__item${isOpen ? " is-open" : ""}`} id={`faq-${it.id}`} key={it.id}>
                      <h3 className="faqp__q-wrap">
                        <button
                          type="button"
                          id={btnId}
                          className="faqp__q"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          onClick={() => toggle(it.id)}
                        >
                          <span>{it.question}</span>
                          <span className={`faqp__q-ic ${isOpen ? "is-open" : ""}`}><Chevron /></span>
                        </button>
                      </h3>
                      <div className="faqp__a-wrap" id={panelId} role="region" aria-labelledby={btnId}>
                        <div className="faqp__a">
                          {it.answer.map((p, i) => <p key={i}>{p}</p>)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
