"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import PxSelect from "./PxSelect";
import { projectsStrings, type ProjectsStrings } from "@/app/[lang]/projects/projectsI18n";
import ScarcityBanner from "@/app/components/ScarcityBanner/ScarcityBanner";

export type Distances = {
  beach?: string;
  restaurants?: string;
  shops?: string;
  school?: string;
  airport?: string;
  hospital?: string;
  golfCourt?: string;
  cityCenter?: string;
};

export type ProjectCardData = {
  id: string;
  title: string;
  href: string;
  image?: string;
  city: string;
  price: number | null;
  bedrooms: string;
  area: string;
  type: string;
  energy: string;
  completion: string;
  isNew: boolean;
  isFeatured: boolean;
  distances?: Distances | null;
  // null/undefined defaults to showing "+VAT" (same as the detail page) —
  // only an explicit false (admin-marked "no VAT", e.g. a renovated resale)
  // omits it.
  vatApplies?: boolean | null;
  // Development cards only (legacy Sanity-origin cards have no unit data —
  // left undefined, ScarcityBanner renders nothing without a total).
  unitsAvailable?: number;
  unitsTotal?: number;
};

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

// distance key → localized label (resolved from the active locale's strings)
const distLabel = (k: keyof Distances, s: ProjectsStrings): string =>
  ({
    beach: s.distBeach,
    airport: s.distAirport,
    school: s.distSchool,
    cityCenter: s.distCenter,
    hospital: s.distHospital,
    shops: s.distShops,
    golfCourt: s.distGolf,
    restaurants: s.distDining,
  })[k];

// key distances surfaced on the map popup, in priority order
const POPUP_DIST_ORDER: (keyof Distances)[] = ["beach", "airport", "school", "cityCenter", "hospital", "shops", "golfCourt", "restaurants"];
export const topDistances = (d: Distances | null | undefined, s: ProjectsStrings, n = 3) =>
  d ? POPUP_DIST_ORDER.filter((k) => d[k]).slice(0, n).map((k) => ({ label: distLabel(k, s), v: d[k] as string })) : [];

// Card footer distances: Beach · School · Golf · Airport (only those with a value).
const CARD_DIST_ORDER: (keyof Distances)[] = ["beach", "school", "golfCourt", "airport"];
const cardDistances = (d: Distances | null | undefined, s: ProjectsStrings) =>
  d ? CARD_DIST_ORDER.filter((k) => d[k]).map((k) => ({ label: distLabel(k, s), v: d[k] as string })) : [];

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

const fmtPrice = (p: number | null, s: ProjectsStrings) =>
  p == null ? s.priceOnRequest : `€${p.toLocaleString(s.numLocale)}`;

function Card({ c, active, onHover, s, locale }: { c: ProjectCardData; active: boolean; onHover: (id: string | null) => void; s: ProjectsStrings; locale: string }) {
  return (
    <a
      className={`prj${active ? " is-active" : ""}`}
      href={c.href}
      onMouseEnter={() => onHover(c.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="prj__media">
        {c.image ? <img className="prj__img" src={c.image} alt={c.title} loading="lazy" /> : <div className="prj__ph" />}
        <div className="prj__shade" />
        <div className="prj__badges">
          {c.isNew && <span className="prj__badge prj__badge--new">{s.badgeNew}</span>}
          {c.isFeatured && <span className="prj__badge">{s.badgeFeatured}</span>}
          {c.unitsTotal != null && <ScarcityBanner available={c.unitsAvailable ?? 0} total={c.unitsTotal} locale={locale} seedKey={c.id} />}
        </div>
        {c.type && <span className="prj__type">{c.type}</span>}
        <div className="prj__info">
          <h3 className="prj__title">{c.title}</h3>
          <p className="prj__loc">{c.city}</p>
        </div>
      </div>
      <div className="prj__footer">
        <div className="prj__specrow">
          <div className="prj__specs">
            {c.bedrooms && <span>{c.bedrooms} {s.bedUnit}</span>}
            {c.area && <span>{c.area} {s.areaUnit}</span>}
            {c.energy && <span>{s.energyPrefix} {c.energy}</span>}
            {/* c.completion is already resolved to a plain year string (or "")
                server-side — see resolveCompletionYear in src/lib/text.ts.
                Never compute a Date here: parsing the free-text completion
                values Development rows can carry ("Q1 2028", "Ready", …) is
                engine-dependent, and a mismatch between the server's parse
                and the browser's during hydration caused the year to flash
                then vanish, leaving a dangling "•" separator behind (the
                outer guard was checking the raw string, not the parsed
                result). Gating on the same already-resolved string here
                means the separator and the value can never disagree. */}
            {c.completion && <span>{c.completion}</span>}
          </div>
          <div className="prj__price">
            {c.price != null && <span className="prj__price-from">{s.priceFrom}</span>}
            {fmtPrice(c.price, s)}
          </div>
        </div>
        {cardDistances(c.distances, s).length > 0 && (
          <div className="prj__dist" aria-label="Distances">
            {cardDistances(c.distances, s).map((x) => (
              <span key={x.label}><i>{x.label}</i> {x.v}<small>{s.minShort}</small></span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

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
                <Card key={c.id} c={c} active={hoveredId === c.id} onHover={setHoveredId} s={s} locale={locale} />
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
