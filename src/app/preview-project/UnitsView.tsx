"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { atSize } from "./imageSize";
import Lightbox from "./Lightbox";

export type UnitVM = {
  id?: string; // DevelopmentUnit.id — only populated by the DB-backed path (developmentRender.ts); optional so the live-feed adapters (feeds.ts), which have no DB row yet, are unaffected
  ref: string;
  name: string;
  label: string; // clean display label built per feed (e.g. "Block C · Nr. 504")
  type: string;
  status: "available" | "sold" | "reserved";
  statusLabel: string;
  price: number | null;
  currency: string;
  beds: string;
  baths: string;
  areaBuilt: string;
  areaPlot: string;
  areaVeranda: string;
  floor: string;
  attrs: { name: string; value: string }[];
  features: string[];
  photos: string[];
  plans: string[];
  coords: { lat: number; lng: number } | null;
  description: string;
};

const fmtPrice = (n: number | null, cur = "EUR") =>
  n == null ? "Price on request" : `${cur === "EUR" ? "€" : cur + " "}${n.toLocaleString("en-US")}`;

const statusClass = (s: string) => (s === "sold" ? "sold" : s === "reserved" ? "warn" : "ok");
const unitLabel = (u: UnitVM) => u.label || u.name || u.ref;
// numeric value → "123 m²" — feed/price-list data isn't always suffixed consistently
const sqm = (v: string) => v && !/m²|m2/i.test(v) ? `${v} m²` : v;
// Sold → a muted dash (the status pill already says "Sold"). Reserved → the word
// itself in the price slot, not "Price on request" or the actual figure.
const priceCell = (u: UnitVM) =>
  u.status === "sold" ? <span className="pp-price-na">—</span>
  : u.status === "reserved" ? <span className="pp-price-na">Reserved</span>
  : <>{fmtPrice(u.price, u.currency)}{u.price != null && <span className="pp-vat">+VAT</span>}</>;

function StatusPill({ u }: { u: UnitVM }) {
  return <span className={`pp-pill pp-pill--${statusClass(u.status)}`}>{u.statusLabel || u.status}</span>;
}

// Branded factsheet download — generation is built in the backend phase.
function PdfButton({ u }: { u: UnitVM }) {
  return (
    <button type="button" className="pp-pdf" title="Branded PDF factsheet (built in the backend phase)" onClick={(e) => e.stopPropagation()}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Factsheet PDF <small>soon</small>
    </button>
  );
}

// Expanded detail — `withPhotos` for the card view; the table view shows every
// other field but no images (per request).
function UnitDetails({ u, withPhotos = true, withFeatures = false, onOpenPhoto }: { u: UnitVM; withPhotos?: boolean; withFeatures?: boolean; onOpenPhoto?: (i: number) => void }) {
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
              <dd>{/^https?:\/\//i.test(a.value) ? <a href={a.value} target="_blank" rel="noopener noreferrer">{/matterport/i.test(a.value) ? "View tour ↗" : "Watch ↗"}</a> : a.value || "—"}</dd>
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
            <button key={i} type="button" className="pp-uc__thumb" onClick={() => onOpenPhoto?.(i)} aria-label={`Enlarge photo ${i + 1}`}>
              <img src={atSize(s, "small")} alt="" loading="lazy" />
            </button>
          ))}
          {extra > 0 && (
            <button type="button" className="pp-uc__thumb pp-uc__thumb--more" onClick={() => onOpenPhoto?.(stripCount)} aria-label={`Show all ${u.photos.length} photos`}>
              <img src={atSize(u.photos[stripCount], "small")} alt="" loading="lazy" />
              <span>+{extra} more</span>
            </button>
          )}
        </div>
      )}
      <PdfButton u={u} />
    </div>
  );
}

function UnitCard({ u, open, onToggle }: { u: UnitVM; open: boolean; onToggle: () => void }) {
  const [lb, setLb] = useState<number | null>(null);
  const facts = [
    u.beds && { k: "Beds", v: u.beds },
    u.baths && { k: "Baths", v: u.baths },
    u.areaBuilt && { k: "Built", v: sqm(u.areaBuilt) },
    u.areaVeranda && { k: "Veranda", v: sqm(u.areaVeranda) },
    u.areaPlot && { k: "Plot", v: sqm(u.areaPlot) },
    u.floor && { k: "Floor", v: u.floor },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <article className={`pp-uc pp-uc--${statusClass(u.status)}`}>
      <button type="button" className={`pp-uc__media${u.photos.length ? " is-zoomable" : ""}`} onClick={() => u.photos.length > 0 && setLb(0)} aria-label={u.photos.length ? "Enlarge photos" : undefined}>
        {u.photos[0] ? <img src={atSize(u.photos[0], "medium")} alt={u.name} loading="lazy" /> : <span className="pp-uc__ph" />}
        <StatusPill u={u} />
        {u.type && <span className="pp-uc__type">{u.type}</span>}
        {u.photos.length > 1 && <span className="pp-uc__count"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>{u.photos.length}</span>}
      </button>
      <div className="pp-uc__body">
        <div className="pp-uc__row">
          <h3 className="pp-uc__name">{unitLabel(u)}</h3>
          <span className="pp-uc__price">{priceCell(u)}</span>
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
              {open ? "Show less" : "All details"}
            </button>
          )}
          {!open && <PdfButton u={u} />}
        </div>
        {open && <UnitDetails u={u} withPhotos withFeatures={false} onOpenPhoto={setLb} />}
      </div>
      <Lightbox images={u.photos} index={lb} onIndex={setLb} onClose={() => setLb(null)} alt={u.name} />
    </article>
  );
}

function UnitsTable({ units }: { units: UnitVM[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const COLS = 8;
  return (
    <div className="pp-tbl-wrap">
      <table className="pp-tbl">
        <thead>
          <tr>
            <th>Unit</th><th>Type</th><th>Floor</th><th className="r">Beds</th><th className="r">Built</th>
            <th className="r">Plot</th><th className="r">Price</th><th>Status</th>
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
                  <td className="r">{u.areaBuilt ? sqm(u.areaBuilt) : "—"}</td>
                  <td className="r">{u.areaPlot ? sqm(u.areaPlot) : "—"}</td>
                  <td className="r pp-tbl__price">{priceCell(u)}</td>
                  <td><StatusPill u={u} /></td>
                </tr>
                {isOpen && (
                  <tr className="pp-tbl__detail">
                    <td colSpan={COLS}><UnitDetails u={u} withPhotos={false} withFeatures /></td>
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

export default function UnitsView({ units }: { units: UnitVM[] }) {
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

  const sorted = useMemo(() => {
    const rank = { available: 0, reserved: 1, sold: 2 } as const;
    return [...units].sort((a, b) => rank[a.status] - rank[b.status] || (a.price ?? 9e9) - (b.price ?? 9e9));
  }, [units]);
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
      <div className="pp-viewtoggle" role="tablist" aria-label="Unit display">
        <button role="tab" aria-selected={view === "cards"} className={view === "cards" ? "is-on" : ""} onClick={() => setView("cards")}>Cards</button>
        <button role="tab" aria-selected={view === "table"} className={view === "table" ? "is-on" : ""} onClick={() => setView("table")}>Table</button>
      </div>
      {view === "cards" ? (
        <>
          <div className="pp-ugrid" ref={gridRef}>{cardsList.map((u, i) => <UnitCard key={u.ref || u.name} u={u} open={openRows.has(rowOf(i))} onToggle={() => toggleRow(i)} />)}</div>
          {!showSold && hiddenUnavailable > 0 && (
            <button className="pp-showmore" type="button" onClick={() => setShowSold(true)}>
              Show {hiddenUnavailable} more {hiddenUnavailable === 1 ? "unit" : "units"}
            </button>
          )}
        </>
      ) : (
        <UnitsTable units={sorted} />
      )}
    </div>
  );
}
