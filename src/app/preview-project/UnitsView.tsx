"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { atSize } from "./imageSize";
import Lightbox from "./Lightbox";
import { developmentCopy, type DevelopmentStrings } from "@/lib/developmentCopy";
import { roundArea } from "@/lib/formatArea";
import { listedUnits } from "@/lib/developmentAvailability";

export type UnitVM = {
  id?: string; // DevelopmentUnit.id — only populated by the DB-backed path (developmentRender.ts); optional so the live-feed adapters (feeds.ts), which have no DB row yet, are unaffected
  ref: string;
  name: string;
  label: string; // clean display label built per feed (e.g. "Block C · Nr. 504")
  type: string;
  // "unlisted" — no longer in the developer's feed, kept in the DB with its
  // full row (price/area/photos) but never shown on the public site (see the
  // filter in UnitsView() below). It has no localized statusLabel because it
  // never reaches a public renderer to display one.
  status: "available" | "sold" | "reserved" | "unlisted";
  statusLabel: string;
  price: number | null;
  currency: string;
  beds: string;
  baths: string;
  areaBuilt: string;
  areaPlot: string;
  areaVeranda: string;
  floor: string;
  orientation?: string; // dedicated DevelopmentUnit.orientation column — not every adapter populates this yet
  attrs: { name: string; value: string }[];
  features: string[];
  photos: string[];
  plans: string[];
  coords: { lat: number; lng: number } | null;
  description: string;
};

const statusClass = (s: string) => (s === "sold" ? "sold" : s === "reserved" || s === "unlisted" ? "warn" : "ok");
const unitLabel = (u: UnitVM) => u.label || u.name || u.ref;
// numeric value → "123 m²" — feed/price-list data isn't always suffixed
// consistently (Island Blue's own raw attrs ship a bare ASCII "m2"; the
// xml2u/aristo/medousa/qubehub adapters already format "m²" via areaM2() in
// feeds.ts). Whatever unit symbol is already present gets normalized to the
// locale's own (Cyrillic "м²" for ru, Latin "m²" elsewhere) rather than left
// as-is, so the same page never mixes symbols. 2026-07-26.
const sqm = (v: string, unit: string) => {
  if (!v) return v;
  // Anchored to end-of-string, not \b — the superscript "²" isn't a \w
  // character, so a \b-based pattern silently failed to match "m²"/"м²"
  // (only matched the ASCII-digit "m2" variant), leaving those strings
  // un-normalized. Caught via simulation before deploy, 2026-07-26.
  return /(m²|m2|м²)\s*$/i.test(v) ? v.replace(/\s*(m²|m2|м²)\s*$/i, ` ${unit}`) : `${v} ${unit}`;
};
// Extract the leading numeric value from an already-formatted area string
// ("77 m²" -> 77) so Covered Area can be computed as areaBuilt +
// areaVeranda at display time, never stored.
const areaNum = (v: string): number | null => {
  const m = (v || "").trim().match(/^[\d.]+/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmtPrice = (n: number | null, cur = "EUR", priceOnRequest = "Price on request") =>
  n == null ? priceOnRequest : `${cur === "EUR" ? "€" : cur + " "}${n.toLocaleString("en-US")}`;
// Sold → a muted dash (the status pill already says "Sold"). Reserved → the word
// itself in the price slot, not "Price on request" or the actual figure.
const priceCell = (u: UnitVM, t: DevelopmentStrings) =>
  u.status === "sold" ? <span className="pp-price-na">—</span>
  : u.status === "reserved" ? <span className="pp-price-na">{t.unitStatus.reserved}</span>
  : <>{fmtPrice(u.price, u.currency, t.priceOnRequest)}{u.price != null && <span className="pp-vat">{t.vatSuffix}</span>}</>;

function StatusPill({ u }: { u: UnitVM }) {
  return <span className={`pp-pill pp-pill--${statusClass(u.status)}`}>{u.statusLabel || u.status}</span>;
}

// Branded factsheet download — generation is built in the backend phase.
function PdfButton({ t }: { t: DevelopmentStrings }) {
  return (
    <button type="button" className="pp-pdf" title="Branded PDF factsheet (built in the backend phase)" onClick={(e) => e.stopPropagation()}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t.factsheetPdf} <small>{t.soon}</small>
    </button>
  );
}

// Expanded detail — `withPhotos` for the card view; the table view shows every
// other field but no images (per request).
function UnitDetails({ u, t, withPhotos = true, withFeatures = false, onOpenPhoto }: { u: UnitVM; t: DevelopmentStrings; withPhotos?: boolean; withFeatures?: boolean; onOpenPhoto?: (i: number) => void }) {
  // strip shows up to 8 tiles; if there are more, the 8th becomes a "+N more" tile
  const stripCount = u.photos.length > 8 ? 7 : Math.min(u.photos.length, 8);
  const extra = u.photos.length - stripCount;
  return (
    <div className="pp-uc__more">
      {u.attrs.length > 0 && (
        <dl className="pp-spec">
          {u.attrs.map((a) => (
            <div key={a.name}>
              <dt>{a.name}</dt>
              <dd>{/^https?:\/\//i.test(a.value) ? <a href={a.value} target="_blank" rel="noopener noreferrer">{/matterport/i.test(a.value) ? t.viewTour : t.watch}</a> : a.value || "—"}</dd>
            </div>
          ))}
        </dl>
      )}
      {withFeatures && u.features.length > 0 && (
        <div className="pp-uc__feat">
          {u.features.map((f) => <span key={f} className="pp-chip"><i className="pp-chip__tick" aria-hidden>✓</i>{f}</span>)}
        </div>
      )}
      {withPhotos && u.photos.length > 1 && (
        <div className="pp-uc__strip">
          {u.photos.slice(0, stripCount).map((s, i) => (
            <button key={i} type="button" className="pp-uc__thumb" onClick={() => onOpenPhoto?.(i)} aria-label={t.enlargePhotoN(i + 1)}>
              <img src={atSize(s, "small")} alt="" loading="lazy" />
            </button>
          ))}
          {extra > 0 && (
            <button type="button" className="pp-uc__thumb pp-uc__thumb--more" onClick={() => onOpenPhoto?.(stripCount)} aria-label={t.showAllPhotos(u.photos.length)}>
              <img src={atSize(u.photos[stripCount], "small")} alt="" loading="lazy" />
              <span>+{extra}</span>
            </button>
          )}
        </div>
      )}
      <PdfButton t={t} />
    </div>
  );
}

function UnitCard({ u, t, open, onToggle }: { u: UnitVM; t: DevelopmentStrings; open: boolean; onToggle: () => void }) {
  const [lb, setLb] = useState<number | null>(null);
  // Covered Area is never stored — computed here from areaBuilt + areaVeranda
  // so it stays correct if a manual edit later adds/changes the veranda
  // figure. Only shown when a veranda figure actually exists (Domenica/
  // Pafilia/Square One have none) — no "+0 m²" line otherwise.
  const builtNum = areaNum(u.areaBuilt), verandaNum = areaNum(u.areaVeranda);
  // roundArea guards against IEEE 754 drift in the sum (e.g. 125.6 + 9.7 ===
  // 135.29999999999998 in JS) — see src/lib/formatArea.ts.
  const covered = builtNum != null && verandaNum != null ? roundArea(builtNum + verandaNum) : null;
  const facts = [
    u.beds && { k: t.factBeds, v: u.beds },
    u.baths && { k: t.factBaths, v: u.baths },
    u.areaBuilt && { k: t.factBuilt, v: sqm(u.areaBuilt, t.unitM2) },
    u.areaVeranda && { k: t.factVeranda, v: sqm(u.areaVeranda, t.unitM2) },
    covered != null && { k: t.factCovered, v: `${covered} ${t.unitM2}` },
    u.areaPlot && { k: t.factPlot, v: sqm(u.areaPlot, t.unitM2) },
    u.floor && { k: t.factFloor, v: u.floor },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <article className={`pp-uc pp-uc--${statusClass(u.status)}`}>
      <button type="button" className={`pp-uc__media${u.photos.length ? " is-zoomable" : ""}`} onClick={() => u.photos.length > 0 && setLb(0)} aria-label={u.photos.length ? t.enlargePhotos : undefined}>
        {u.photos[0] ? <img src={atSize(u.photos[0], "medium")} alt={u.name} loading="lazy" /> : <span className="pp-uc__ph" />}
        <StatusPill u={u} />
        {u.type && <span className="pp-uc__type">{u.type}</span>}
        {u.photos.length > 1 && <span className="pp-uc__count"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>{u.photos.length}</span>}
      </button>
      <div className="pp-uc__body">
        <div className="pp-uc__row">
          <h3 className="pp-uc__name">{unitLabel(u)}</h3>
          <span className="pp-uc__price">{priceCell(u, t)}</span>
        </div>
        {facts.length > 0 && (
          <div className="pp-uc__facts">
            {facts.map((f) => (
              <span key={f.k}><i>{f.k}</i> {f.v}</span>
            ))}
          </div>
        )}
        {u.features.length > 0 && (
          <div className="pp-uc__feat">
            {u.features.slice(0, open ? u.features.length : 4).map((f) => (
              <span key={f} className="pp-chip"><i className="pp-chip__tick" aria-hidden>✓</i>{f}</span>
            ))}
            {!open && u.features.length > 4 && <span className="pp-chip pp-chip--more">+{u.features.length - 4}</span>}
          </div>
        )}
        <div className="pp-uc__actions">
          {(u.attrs.length > 0 || u.description || u.photos.length > 1) && (
            <button className="pp-uc__toggle" type="button" onClick={onToggle} aria-expanded={open}>
              {open ? t.showLess : t.allDetails}
            </button>
          )}
          {!open && <PdfButton t={t} />}
        </div>
        {open && <UnitDetails u={u} t={t} withPhotos withFeatures={false} onOpenPhoto={setLb} />}
      </div>
      <Lightbox images={u.photos} index={lb} onIndex={setLb} onClose={() => setLb(null)} alt={u.name} />
    </article>
  );
}

function UnitsTable({ units, t }: { units: UnitVM[]; t: DevelopmentStrings }) {
  const [open, setOpen] = useState<string | null>(null);
  const COLS = 8;
  return (
    <div className="pp-tbl-wrap">
      <table className="pp-tbl">
        <thead>
          <tr>
            <th>{t.colUnit}</th><th>{t.colType}</th><th>{t.colFloor}</th><th className="r">{t.colBeds}</th><th className="r">{t.colBuilt}</th>
            <th className="r">{t.colPlot}</th><th className="r">{t.colPrice}</th><th>{t.colStatus}</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const key = u.ref || u.name;
            const isOpen = open === key;
            return (
              <React.Fragment key={key}>
                <tr
                  className={`pp-tbl__row${u.status === "sold" ? " is-sold" : u.status === "reserved" ? " is-reserved" : ""}${isOpen ? " is-open" : ""}`}
                  onClick={() => setOpen(isOpen ? null : key)}
                  aria-expanded={isOpen}
                >
                  <td className="pp-tbl__name"><span className="pp-tbl__chev" aria-hidden>{isOpen ? "▾" : "▸"}</span>{unitLabel(u)}<small>{u.ref}</small></td>
                  <td>{u.type || "—"}</td>
                  <td>{u.floor || "—"}</td>
                  <td className="r">{u.beds || "—"}</td>
                  <td className="r">{u.areaBuilt ? sqm(u.areaBuilt, t.unitM2) : "—"}</td>
                  <td className="r">{u.areaPlot ? sqm(u.areaPlot, t.unitM2) : "—"}</td>
                  <td className="r pp-tbl__price">{priceCell(u, t)}</td>
                  <td><StatusPill u={u} /></td>
                </tr>
                {isOpen && (
                  <tr className="pp-tbl__detail">
                    <td colSpan={COLS}><UnitDetails u={u} t={t} withPhotos={false} withFeatures /></td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function UnitsView({ units, lang = "en" }: { units: UnitVM[]; lang?: string }) {
  const t = developmentCopy(lang);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [showSold, setShowSold] = useState(false);
  const [cols, setCols] = useState(0);
  const [openRows, setOpenRows] = useState<Set<number>>(() => new Set());
  const gridRef = useRef<HTMLDivElement>(null);

  // expand/collapse a whole row at once (keeps the grid rows aligned)
  const rowOf = (index: number) => (cols > 0 ? Math.floor(index / cols) : 0);
  const toggleRow = (index: number) => {
    const row = rowOf(index);
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row); else next.add(row);
      return next;
    });
  };
  // row assignments change with the column count / view → reset to stay consistent
  useEffect(() => { setOpenRows(new Set()); }, [cols, view]);

  // Unlisted (no longer in the developer's feed) never reaches the public
  // page at all — it's not "sold" or "reserved" for a buyer to see, it's
  // simply not for sale anymore. The row survives in the DB (admin + sync
  // still see it) purely so it can silently return if the feed re-lists it.
  const visibleUnits = useMemo(() => listedUnits(units), [units]);

  const sorted = useMemo(() => {
    const rank = { available: 0, reserved: 1, sold: 2, unlisted: 3 } as const;
    return [...visibleUnits].sort((a, b) => rank[a.status] - rank[b.status] || (a.price ?? 9e9) - (b.price ?? 9e9));
  }, [visibleUnits]);
  // Reserved is treated exactly like sold — de-prioritized, dimmed, and hidden
  // behind the same "show more" toggle — only truly available units show by default.
  const available = sorted.filter((u) => u.status === "available");
  const unavailable = sorted.filter((u) => u.status !== "available");

  // measure the responsive column count so unavailable units only fill the current row
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const n = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length;
      setCols(n || 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [view]);

  // free cells left in the last row of available units → fill with that many sold/reserved
  const fill = cols > 0 ? (cols - (available.length % cols)) % cols : 0;
  const previewUnavailable = showSold ? unavailable : unavailable.slice(0, fill);
  const cardsList = [...available, ...previewUnavailable];
  const hiddenUnavailable = unavailable.length - previewUnavailable.length;

  return (
    <div>
      <div className="pp-viewtoggle" role="tablist" aria-label={t.unitDisplayAria}>
        <button role="tab" aria-selected={view === "cards"} className={view === "cards" ? "is-on" : ""} onClick={() => setView("cards")}>{t.viewCards}</button>
        <button role="tab" aria-selected={view === "table"} className={view === "table" ? "is-on" : ""} onClick={() => setView("table")}>{t.viewTable}</button>
      </div>
      {view === "cards" ? (
        <>
          <div className="pp-ugrid" ref={gridRef}>{cardsList.map((u, i) => <UnitCard key={u.ref || u.name} u={u} t={t} open={openRows.has(rowOf(i))} onToggle={() => toggleRow(i)} />)}</div>
          {!showSold && hiddenUnavailable > 0 && (
            <button className="pp-showmore" type="button" onClick={() => setShowSold(true)}>
              {t.showMoreUnits(hiddenUnavailable)}
            </button>
          )}
        </>
      ) : (
        <UnitsTable units={sorted} t={t} />
      )}
    </div>
  );
}
