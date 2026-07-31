"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import PxSelect from "./PxSelect";
import { projectsStrings, type ProjectsStrings } from "@/app/[lang]/projects/projectsI18n";
import { ProjectCard, type ProjectCardData, type Distances } from "./ProjectCard";

export type { ProjectCardData, Distances };

export type MapMarker = {
  id: string;
  title: string;
  href: string;
  city: string;
  price: number | null;
  lat: number;
  lng: number;
  image?: string;
  distances?: Distances | null;
};

type Filters = {
  city: string;
  propertyType: string;
  priceFrom: number | null;
  priceTo: number | null;
  bedrooms: string;
  q: string;
  sort: string;
};

const ProjectsMap = dynamic(() => import("./ProjectsMap"), {
  ssr: false,
  loading: () => <div className="px-map__loading">Loading map…</div>,
});

const ProjectsMiniMap = dynamic(() => import("./ProjectsMap").then((m) => m.MiniMap), {
  ssr: false,
  loading: () => <div className="px-map__loading">Map…</div>,
});

function MapTile({ markers, total, onOpen, s }: { markers: MapMarker[]; total: number; onOpen: () => void; s: ProjectsStrings }) {
  return (
    <button type="button" className="prjmap" onClick={onOpen} aria-label={s.exploreOnMap}>
      <span className="prjmap__media">
        <span className="prjmap__bleed">
          <ProjectsMiniMap markers={markers} />
        </span>
      </span>
      <span className="prjmap__cap">
        <span className="prjmap__title">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M7.5 3 2.5 5v12l5-2 5 2 5-2V3l-5 2-5-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M7.5 3v12M12.5 5v12" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          {s.exploreOnMap}
        </span>
        <span className="prjmap__sub">{s.mapTileSub(total.toLocaleString(s.numLocale))}</span>
      </span>
    </button>
  );
}

const pageHref = (sp: URLSearchParams, n: number) => {
  const p = new URLSearchParams(sp.toString());
  if (n <= 1) p.delete("page");
  else p.set("page", String(n));
  const s = p.toString();
  return s ? `?${s}` : "?";
};

export default function ProjectsExplorer({
  cards,
  markers,
  total,
  page,
  totalPages,
  filters,
  locale = "en",
  strings,
}: {
  cards: ProjectCardData[];
  markers: MapMarker[];
  total: number;
  page: number;
  totalPages: number;
  filters: Filters;
  locale?: string;
  strings?: ProjectsStrings;
}) {
  const s = strings ?? projectsStrings(locale);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [q, setQ] = useState(filters.q);
  const [mapOpen, setMapOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false); // mobile "Additional filters" disclosure
  const hasBbox = sp.get("north") != null;
  const activeMore = (filters.propertyType ? 1 : 0) + (filters.bedrooms ? 1 : 0); // active Type/Beds count
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const lessBtnRef = useRef<HTMLButtonElement>(null);
  // move focus to the control that becomes visible after the toggle (a11y)
  const openMore = () => { setMoreOpen(true); requestAnimationFrame(() => lessBtnRef.current?.focus()); };
  const closeMore = () => { setMoreOpen(false); requestAnimationFrame(() => moreBtnRef.current?.focus()); };

  // Mobile (≤768px, matches the filter-bar/FAB breakpoint): the inline map tile
  // is removed from the list; the map is reached via the .px__mapbtn modal only.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mapOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMapOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [mapOpen]);

  // Update a filter param. Changing a filter clears the map bbox + page so the
  // map re-fits to the new result set.
  const setParam = useCallback(
    (patch: Record<string, string>) => {
      const p = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      ["page", "north", "south", "east", "west"].forEach((k) => p.delete(k));
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [router, pathname, sp],
  );

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setParam({ q: q.trim() });
  };

  // Reset everything: clears the local search box and drops ALL url params —
  // filters, sort, page AND the map bbox (north/south/east/west) — so the map
  // re-fits to the full result set.
  const reset = () => {
    setQ("");
    router.replace(pathname, { scroll: false });
  };

  const pages = useMemo(() => {
    const keep = new Set([1, totalPages, page - 1, page, page + 1]);
    const out: (number | "…")[] = [];
    let prev = 0;
    for (let n = 1; n <= totalPages; n++) {
      if (!keep.has(n)) continue;
      if (prev && n - prev > 1) out.push("…");
      out.push(n);
      prev = n;
    }
    return out;
  }, [page, totalPages]);

  return (
    <div className="px__shell">
      {/* ---------- filter bar ---------- */}
      <div className="px__filters">
        <div className={`wrap px__filters-row${moreOpen ? " is-more-open" : ""}`}>
          {/* 1. City */}
          <PxSelect
            className="px__f-city"
            label={s.cityLabel}
            placeholder={s.cityPlaceholder}
            value={filters.city}
            options={s.cities}
            onChange={(v) => setParam({ city: v })}
          />

          {/* 2. Price */}
          <div className="px__price">
            <input
              key={`pf-${filters.priceFrom ?? ""}`}
              type="number"
              inputMode="numeric"
              placeholder={s.priceMin}
              defaultValue={filters.priceFrom ?? ""}
              onBlur={(e) => setParam({ priceFrom: e.target.value })}
              aria-label={s.priceMinAria}
            />
            <span className="px__price-sep">–</span>
            <input
              key={`pt-${filters.priceTo ?? ""}`}
              type="number"
              inputMode="numeric"
              placeholder={s.priceMax}
              defaultValue={filters.priceTo ?? ""}
              onBlur={(e) => setParam({ priceTo: e.target.value })}
              aria-label={s.priceMaxAria}
            />
          </div>

          {/* 3. Type */}
          <PxSelect
            id="px-f-type"
            className="px__f-type"
            label={s.typeLabel}
            placeholder={s.typePlaceholder}
            value={filters.propertyType}
            options={s.types}
            onChange={(v) => setParam({ propertyType: v })}
          />

          {/* 4. Bedrooms */}
          <PxSelect
            id="px-f-beds"
            className="px__f-beds"
            label={s.bedsLabel}
            placeholder={s.bedsPlaceholder}
            value={filters.bedrooms}
            options={s.beds}
            onChange={(v) => setParam({ bedrooms: v })}
          />

          {/* 5. Search */}
          <form className="px__search" onSubmit={submitSearch}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={s.searchPlaceholder}
              aria-label={s.searchAria}
            />
          </form>

          {/* 6. Map */}
          <button type="button" className="px__mapbtn" onClick={() => setMapOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M7.5 3 2.5 5v12l5-2 5 2 5-2V3l-5 2-5-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M7.5 3v12M12.5 5v12" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            {s.mapBtn}
          </button>

          {/* 7. Reset */}
          <button type="button" className="px__reset" onClick={reset}>{s.reset}</button>

          {/* mobile-only: reveals Type, Bedrooms, Search, Map, Reset (hidden on desktop/tablet) */}
          <button
            ref={moreBtnRef}
            type="button"
            className="px__morebtn"
            aria-expanded={moreOpen}
            aria-controls="px-f-type px-f-beds"
            onClick={openMore}
          >
            <span className="px__morebtn-label">
              {s.moreFilters}
              {activeMore > 0 && <span className="px__morebtn-badge">{activeMore}</span>}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* mobile-only: collapses the expanded filters back */}
          <button
            ref={lessBtnRef}
            type="button"
            className="px__lessbtn"
            aria-expanded={moreOpen}
            aria-controls="px-f-type px-f-beds"
            onClick={closeMore}
          >
            <span className="px__morebtn-label">{s.hideFilters}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M2.5 7.5 6 4l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ---------- full-width results ---------- */}
      <section className="px__results wrap" aria-label="Project results">
        <div className="px__results-head">
          <p className="px__count">
            <strong>{total.toLocaleString(s.numLocale)}</strong> {total === 1 ? s.projectOne : s.projectMany}
            {hasBbox && <span className="px__count-area"> {s.inThisMapArea}</span>}
          </p>
          {/* Sort lives with the results, not the filters block */}
          <select className="px__select px__select--sort" value={filters.sort} onChange={(e) => setParam({ sort: e.target.value })} aria-label={s.sortAria}>
            {s.sorts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {cards.length === 0 ? (
          <p className="px__empty">{s.empty}</p>
        ) : (
          <div className="px__grid">
            {/* The map preview takes the 3rd slot on EVERY page — replacing the 3rd
               card when there are ≥3 results, or simply appended when there are
               fewer (so it never disappears on small result sets). */}
            {cards.map((c, i) =>
              !isMobile && cards.length >= 3 && i === 2 ? (
                <MapTile key="map-tile" markers={markers} total={total} onOpen={() => setMapOpen(true)} s={s} />
              ) : (
                <ProjectCard key={c.id} c={c} active={hoveredId === c.id} onHover={setHoveredId} s={s} locale={locale} />
              ),
            )}
            {!isMobile && cards.length > 0 && cards.length < 3 && (
              <MapTile key="map-tile" markers={markers} total={total} onOpen={() => setMapOpen(true)} s={s} />
            )}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="px__pager" aria-label="Results pagination">
            {page > 1 ? <a className="px__pager-link" href={pageHref(sp, page - 1)} aria-label="Previous">‹</a> : <span className="px__pager-link is-disabled" aria-hidden>‹</span>}
            {pages.map((n, i) =>
              n === "…" ? (
                <span key={`e${i}`} className="px__pager-gap" aria-hidden>…</span>
              ) : (
                <a key={n} className={`px__pager-link${n === page ? " is-active" : ""}`} href={pageHref(sp, n)} aria-current={n === page ? "page" : undefined}>{n}</a>
              ),
            )}
            {page < totalPages ? <a className="px__pager-link" href={pageHref(sp, page + 1)} aria-label="Next">›</a> : <span className="px__pager-link is-disabled" aria-hidden>›</span>}
          </nav>
        )}
      </section>

      {/* floating map button (mobile / scroll convenience) */}
      <button type="button" className="px__mapfab" onClick={() => setMapOpen(true)} aria-label={s.mapFab}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M7.5 3 2.5 5v12l5-2 5 2 5-2V3l-5 2-5-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M7.5 3v12M12.5 5v12" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <span>{s.mapFab}</span>
      </button>

      {/* ---------- map overlay (toggled) ---------- */}
      {mapOpen && (
        <div className="px__mapoverlay" role="dialog" aria-modal="true" aria-label="Project map">
          <div className="px__mapoverlay-bar">
            <p className="px__mapoverlay-count">
              <strong>{total.toLocaleString(s.numLocale)}</strong> {total === 1 ? s.projectOne : s.projectMany}
              {hasBbox ? ` ${s.inThisArea}` : ""}
            </p>
            <button type="button" className="px__mapoverlay-close" onClick={() => setMapOpen(false)} aria-label={s.close}>
              {s.close}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="px__mapoverlay-map">
            <ProjectsMap markers={markers} hoveredId={hoveredId} onHover={setHoveredId} locale={locale} strings={s} />
          </div>
        </div>
      )}
    </div>
  );
}
