"use client";

import React, { useMemo, useRef, useState, useLayoutEffect } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion, lenisRef } from "../preview-home/anim/gsap";
import { Flip } from "gsap/Flip";

if (typeof window !== "undefined") gsap.registerPlugin(Flip);

export type InsightsCard = {
  id: string;
  title: string;
  excerpt: string;
  href: string;
  image?: string;
  category: string;
  date: string;
};

// Localizable UI strings + link/date behaviour. Defaults keep the EN-only
// /preview-insights route byte-identical; the live /blog route passes localized
// values (locale, strings, basePath) so the same component is fully reusable.
export type InsightsListStrings = {
  all: string;
  read: string;
  readArticle: string;
  categoriesAria: string;
  pagerAria: string;
  firstPage: string;
  lastPage: string;
  pageWord: string;
  empty: string;
};

const DEFAULT_STRINGS: InsightsListStrings = {
  all: "All",
  read: "Read",
  readArticle: "Read article",
  categoriesAria: "Categories",
  pagerAria: "Blog pagination",
  firstPage: "First page",
  lastPage: "Last page",
  pageWord: "Page",
  empty: "No articles yet.",
};

const fmtDate = (d: string, locale: string) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
};

const Arrow = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 13L13 3M13 3H6M13 3V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Card({ c, hidden, locale, readLabel }: { c: InsightsCard; hidden: boolean; locale: string; readLabel: string }) {
  return (
    <a className={`icard${hidden ? " is-hidden" : ""}`} href={c.href} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : undefined}>
      <div className="icard__media">
        {c.image ? <img src={c.image} alt={c.title} loading="lazy" /> : <div className="icard__ph" />}
        {c.category && <span className="icard__cat">{c.category}</span>}
      </div>
      <div className="icard__body">
        <h3 className="icard__title">{c.title}</h3>
        {c.excerpt && <p className="icard__excerpt">{c.excerpt}</p>}
        <div className="icard__foot">
          <time className="icard__date">{fmtDate(c.date, locale)}</time>
          <span className="icard__more">{readLabel} <Arrow /></span>
        </div>
      </div>
    </a>
  );
}

// Same slicing as the server: page 1 = items 1..15 (after the featured item 0);
// page N = the next 15. Used for client-side pagination.
const PAGE_1_TOTAL = 16;
const REGULAR_PER_PAGE = 15;
const gridIds = (all: InsightsCard[], p: number) => {
  const start = p <= 1 ? 1 : PAGE_1_TOTAL + (p - 2) * REGULAR_PER_PAGE;
  const end = p <= 1 ? PAGE_1_TOTAL : start + REGULAR_PER_PAGE;
  return new Set(all.slice(start, end).map((c) => c.id));
};

/** Windowed page numbers: 1 … current-1 current current+1 … last */
function pageWindow(current: number, total: number): (number | "…")[] {
  const keep = new Set<number>([1, total, current - 1, current, current + 1]);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (let n = 1; n <= total; n++) {
    if (!keep.has(n)) continue;
    if (prev && n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

function Pager({
  page,
  totalPages,
  onGo,
  hrefFor,
  t,
}: {
  page: number;
  totalPages: number;
  onGo: (e: React.MouseEvent, n: number) => void;
  hrefFor: (n: number) => string;
  t: InsightsListStrings;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="ins__pager" aria-label={t.pagerAria}>
      {page > 1 ? (
        <a className="ins__pager-link ins__pager-edge" href={hrefFor(1)} onClick={(e) => onGo(e, 1)} aria-label={t.firstPage}>«</a>
      ) : (
        <span className="ins__pager-link ins__pager-edge is-disabled" aria-hidden>«</span>
      )}
      {pageWindow(page, totalPages).map((it, i) =>
        it === "…" ? (
          <span key={`e${i}`} className="ins__pager-gap" aria-hidden>…</span>
        ) : (
          <a
            key={it}
            className={`ins__pager-link${it === page ? " is-active" : ""}`}
            href={hrefFor(it)}
            onClick={(e) => onGo(e, it)}
            aria-current={it === page ? "page" : undefined}
            aria-label={`${t.pageWord} ${it}`}
          >
            {it}
          </a>
        ),
      )}
      {page < totalPages ? (
        <a className="ins__pager-link ins__pager-edge" href={hrefFor(totalPages)} onClick={(e) => onGo(e, totalPages)} aria-label={t.lastPage}>»</a>
      ) : (
        <span className="ins__pager-link ins__pager-edge is-disabled" aria-hidden>»</span>
      )}
    </nav>
  );
}

export default function InsightsList({
  allCards,
  page,
  totalPages,
  basePath = "/preview-insights",
  locale = "en-GB",
  strings,
  navSelector = ".nav",
}: {
  allCards: InsightsCard[];
  page: number;
  totalPages: number;
  basePath?: string;
  locale?: string;
  strings?: Partial<InsightsListStrings>;
  navSelector?: string;
}) {
  const t: InsightsListStrings = { ...DEFAULT_STRINGS, ...(strings ?? {}) };
  const pageHref = (n: number) => (n <= 1 ? basePath : `${basePath}/page/${n}`);

  // Categories come from the FULL language list (every category), not the
  // current page — so the filter options never depend on pagination.
  const categories = useMemo(() => {
    const set = new Set<string>();
    allCards.forEach((c) => c.category && set.add(c.category));
    return Array.from(set);
  }, [allCards]);

  const [active, setActive] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(page);
  const sectionRef = useRef<HTMLElement>(null);
  const flipState = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const prevHeight = useRef(0);
  const scrollPending = useRef(false);

  const featured = allCards[0] ?? null;
  const featuredShown = active === "all" && currentPage === 1 && !!featured;
  const pageIds = useMemo(() => gridIds(allCards, currentPage), [allCards, currentPage]);
  const isShown = (c: InsightsCard) => (active === "all" ? pageIds.has(c.id) : c.category === active);

  const snapshot = () => {
    if (!prefersReducedMotion() && sectionRef.current) {
      prevHeight.current = sectionRef.current.offsetHeight;
      flipState.current = Flip.getState(sectionRef.current.querySelectorAll(".icard, .ifeat"), { props: "opacity" });
    }
  };
  const select = (next: string) => {
    if (next === active) return;
    snapshot();
    setActive(next);
  };
  const scrollToBlock = () => {
    const section = sectionRef.current;
    if (!section) return;
    const navH = document.querySelector(navSelector)?.getBoundingClientRect().height ?? 74;
    const targetY = Math.max(0, Math.round(section.getBoundingClientRect().top + window.scrollY - (navH - 3)));
    // Prefer the LIVE global Lenis (window.lenis, set by useLenis) — it's the
    // instance actually controlling the page. On the live site the preview
    // lenisRef is null, so this used to fall back to window.scrollTo, which the
    // running Lenis immediately overrode → the page never scrolled up. Fall back
    // to the preview ref (preview routes), then native scroll (reduced-motion).
    const lenis = (typeof window !== "undefined" && (window as any).lenis) || lenisRef.current;
    if (lenis && typeof lenis.scrollTo === "function") lenis.scrollTo(targetY, { duration: 0.9 });
    else window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  const goToPage = (e: React.MouseEvent, n: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let new-tab etc. through
    e.preventDefault();
    if (n === currentPage) {
      scrollToBlock();
      return;
    }
    snapshot();
    scrollPending.current = true;
    setCurrentPage(n);
    try {
      window.history.replaceState(window.history.state, "", pageHref(n));
    } catch {
      /* URL sync is best-effort */
    }
  };

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (scrollPending.current) {
      scrollPending.current = false;
      scrollToBlock();
    }

    const state = flipState.current;
    if (!state || !section) return;
    flipState.current = null;

    gsap.killTweensOf(section);
    section.style.minHeight = "";
    const newH = section.offsetHeight;
    const oldH = prevHeight.current || newH;
    section.style.minHeight = `${oldH}px`;

    Flip.from(state, {
      duration: 0.55,
      ease: "power3.inOut",
      stagger: 0.03,
      onEnter: (els) =>
        gsap.fromTo(
          els,
          { autoAlpha: 0, scale: 0.86, y: 0 },
          { autoAlpha: 1, scale: 1, duration: 0.5, stagger: 0.03, ease: "power2.out", clearProps: "transform" },
        ),
      onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.86, duration: 0.38, ease: "power2.in" }),
    });

    gsap.to(section, {
      minHeight: newH,
      duration: 0.55,
      ease: "power3.inOut",
      onComplete: () => {
        section.style.minHeight = "";
        ScrollTrigger.refresh();
      },
    });
  }, [active, currentPage]);

  if (!allCards.length && !featured) {
    return (
      <section className="ins__list" ref={sectionRef}>
        <div className="wrap"><p className="ins__empty">{t.empty}</p></div>
      </section>
    );
  }

  return (
    <section className="ins__list" ref={sectionRef}>
      <div className="wrap">
        {categories.length > 1 && (
          <div className="ifilter" role="tablist" aria-label={t.categoriesAria}>
            <button className={`ifilter__chip ${active === "all" ? "is-active" : ""}`} onClick={() => select("all")}>
              {t.all}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`ifilter__chip ${active === cat ? "is-active" : ""}`}
                onClick={() => select(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {featured && (
          <a className={`ifeat${featuredShown ? "" : " is-hidden"}`} href={featured.href} aria-hidden={featuredShown ? undefined : true}>
            <div className="ifeat__media">
              {featured.image ? <img src={featured.image} alt={featured.title} /> : <div className="icard__ph" />}
            </div>
            <div className="ifeat__body">
              <p className="ifeat__kicker">
                {featured.category && <span className="ifeat__cat">{featured.category}</span>}
              </p>
              <h2 className="ifeat__title">{featured.title}</h2>
              {featured.excerpt && <p className="ifeat__excerpt">{featured.excerpt}</p>}
              <div className="ifeat__foot">
                <time className="icard__date">{fmtDate(featured.date, locale)}</time>
                <span className="icard__more">{t.readArticle} <Arrow /></span>
              </div>
            </div>
          </a>
        )}

        <div className="ins__grid">
          {allCards.map((c) => <Card key={c.id} c={c} hidden={!isShown(c)} locale={locale} readLabel={t.read} />)}
        </div>

        {active === "all" && <Pager page={currentPage} totalPages={totalPages} onGo={goToPage} hrefFor={pageHref} t={t} />}
      </div>
    </section>
  );
}
