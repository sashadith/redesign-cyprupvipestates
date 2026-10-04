"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { atSize } from "./imageSize";
import Lightbox from "./Lightbox";
import { developmentCopy, type DevelopmentStrings } from "@/lib/developmentCopy";
import { areaValue, coveredArea, interiorArea } from "@/lib/formatArea";
import { listedUnits } from "@/lib/developmentAvailability";
import { capitalizeType } from "@/lib/developmentCard";
import { heFeedLabel } from "@/lib/heFeedVocab";
import { fmtPrice } from "@/lib/locale";
import Bdi from "@/app/components/Bdi";

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
  // Interior only, when the source states it separately — the base of the Covered
  // figure (see coveredArea in lib/formatArea.ts). Optional: only the DB-backed
  // path (developmentRender.ts) has it; the live-feed adapters put the interior
  // in areaBuilt itself.
  areaInternal?: string;
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
// Leading numeric value of an already-formatted area string ("77 m²" -> 77).
const areaNum = areaValue;
// Sold → a muted dash (the status pill already says "Sold"). Reserved → the word
// itself in the price slot, not "Price on request" or the actual figure.
const priceCell = (u: UnitVM, t: DevelopmentStrings, lang: string) =>
  u.status === "sold" ? <span className="pp-price-na">—</span>
  : u.status === "reserved" ? <span className="pp-price-na">{t.unitStatus.reserved}</span>
  : u.price == null ? <>{t.priceOnRequest}</>
  : <><Bdi ltr>{fmtPrice(u.price, lang, u.currency)}</Bdi><span className="pp-vat"><Bdi>{t.vatSuffix}</Bdi></span></>;

// `u.statusLabel` is the developer feed's own English wording and `u.status`
// the raw enum, so on a Hebrew page this pill (and the units table's status
// column) was the one Latin element among Hebrew rows — the entry the copy
// table already holds was simply never reached (Pass B, reported dev task).
// The pill labels a יחידה, hence the feminine forms in heFeedVocab; the
// project-level badge in ProjectPageBody keeps its masculine "זמין".
function StatusPill({ u, lang }: { u: UnitVM; lang: string }) {
  const raw = u.statusLabel || u.status;
  return <span className={`pp-pill pp-pill--${statusClass(u.status)}`}>{lang === "he" ? heFeedLabel(raw) : raw}</span>;
}

// Branded factsheet download — generation is built in the backend phase.
// "Enquire about this unit" — jumps to the enquiry form (#enquiry) and hands it
// a ready-made message via a window event (see Form.tsx). Replaces the
// "Factsheet PDF (soon)" placeholder (conversion review, 2026-10-03).
function EnquireButton({ u, t, projectName, primary = false, compact = false }: { u: UnitVM; t: DevelopmentStrings; projectName: string; primary?: boolean; compact?: boolean }) {
  return (
    <a
      href="#enquiry"
      /* The row button is the site's own frosted-glass button (.btn .btn--glass
         from the shared token sheet this route imports), not the pp-* variant —
         asked for by name, 2026-10-03. The card/detail button keeps the pp-* one. */
      className={compact ? "btn btn--glass pp-uc__enquire--sm" : `pp-btn pp-uc__enquire${primary ? " pp-btn--primary" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent("cve:enquire", { detail: { message: t.enquireUnitMessage(unitLabel(u), projectName) } }));
      }}
    >
      {t.enquireUnit}
    </a>
  );
}

// Expanded detail. Both views now show images: the table used to pass
// withPhotos={false} back when it was the secondary view, which left its
// expanded row as a bare spec list (2026-10-03). Floor plans are shown here for
// the first time — UnitVM has carried a `plans` array all along and no renderer
// ever read it.
function UnitDetails({ u, t, projectName, withPhotos = true, withFeatures = false, withEnquire = true, hideAttrs = [], onOpenPhoto }: { u: UnitVM; t: DevelopmentStrings; projectName: string; withPhotos?: boolean; withFeatures?: boolean; withEnquire?: boolean; hideAttrs?: string[]; onOpenPhoto?: (i: number) => void }) {
  // strip shows up to 8 tiles; if there are more, the 8th becomes a "+N more" tile
  const stripCount = u.photos.length > 8 ? 7 : Math.min(u.photos.length, 8);
  const extra = u.photos.length - stripCount;
  /* Attributes the caller already shows as a column. Cap St Georges carries a
     single attribute, "Type: A", which the table's own Type column covers —
     expanding a row drew one lone spec line under a full-width rule and read
     as a layout fault rather than as information. */
  const attrs = u.attrs.filter((a) => !hideAttrs.some((h) => h.toLowerCase() === a.name.trim().toLowerCase()));
  return (
    <div className="pp-uc__more">
      {attrs.length > 0 && (
        <dl className="pp-spec">
          {attrs.map((a) => (
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
      {u.plans.length > 0 && (
        <div className="pp-uc__plans">
          <div className="pp-uc__plans-label">{t.plansHeading}</div>
          <div className="pp-uc__strip">
            {u.plans.map((s, i) => (
              <a key={i} href={s} target="_blank" rel="noopener noreferrer" className="pp-uc__thumb pp-uc__thumb--plan">
                <img src={atSize(s, "small")} alt={`${unitLabel(u)} — ${t.plansHeading}`} loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      )}
      {/* Only where the collapsed state has no call to action of its own. The
          table puts an enquiry link in every row, so repeating it on expand
          showed the same offer twice within one screen. */}
      {withEnquire && <EnquireButton u={u} t={t} projectName={projectName} primary />}
    </div>
  );
}

function UnitCard({ u, t, lang, projectName, open, onToggle, clamped = false }: { u: UnitVM; t: DevelopmentStrings; lang: string; projectName: string; open: boolean; onToggle: () => void; clamped?: boolean }) {
  const [lb, setLb] = useState<number | null>(null);
  // Covered Area is never stored — computed here (interior + covered veranda)
  // so it stays correct if a manual edit later adds/changes the veranda
  // figure. Only shown when a veranda figure actually exists (Domenica/
  // Pafilia/Square One have none) — no "+0 m²" line otherwise. The interior is
  // areaInternal where the source has one: five sources keep a veranda-
  // inclusive total in areaBuilt, which built + veranda counted twice.
  const covered = coveredArea(u.areaBuilt, u.areaInternal, u.areaVeranda);
  // The interior, not the raw areaBuilt — see interiorArea in lib/formatArea.ts.
  const interior = interiorArea(u.areaBuilt, u.areaInternal);
  const facts = [
    u.beds && { k: t.factBeds, v: u.beds },
    u.baths && { k: t.factBaths, v: u.baths },
    interior && { k: t.factBuilt, v: sqm(interior, t.unitM2) },
    u.areaVeranda && { k: t.factVeranda, v: sqm(u.areaVeranda, t.unitM2) },
    covered != null && { k: t.factCovered, v: `${covered} ${t.unitM2}` },
    u.areaPlot && { k: t.factPlot, v: sqm(u.areaPlot, t.unitM2) },
    u.floor && { k: t.factFloor, v: u.floor },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <article className={`pp-uc pp-uc--${statusClass(u.status)}${clamped ? " is-clamped" : ""}`}>
      <button type="button" className={`pp-uc__media${u.photos.length ? " is-zoomable" : ""}`} onClick={() => u.photos.length > 0 && setLb(0)} aria-label={u.photos.length ? t.enlargePhotos : undefined}>
        {u.photos[0] ? <img src={atSize(u.photos[0], "medium")} alt={u.name} loading="lazy" /> : <span className="pp-uc__ph" />}
        <StatusPill u={u} lang={lang} />
        {u.type && <span className="pp-uc__type">{lang === "he" ? heFeedLabel(u.type) : capitalizeType(u.type)}</span>}
        {u.photos.length > 1 && <span className="pp-uc__count"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>{u.photos.length}</span>}
      </button>
      <div className="pp-uc__body">
        <div className="pp-uc__row">
          <h3 className="pp-uc__name">{unitLabel(u)}</h3>
          <span className="pp-uc__price">{priceCell(u, t, lang)}</span>
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
          {!open && <EnquireButton u={u} t={t} projectName={projectName} />}
        </div>
        {open && <UnitDetails u={u} t={t} projectName={projectName} withPhotos withFeatures={false} onOpenPhoto={setLb} />}
      </div>
      <Lightbox images={u.photos} index={lb} onIndex={setLb} onClose={() => setLb(null)} alt={u.name} />
    </article>
  );
}

function UnitsTable({ units, splitAt, showAll, onToggleSold, t, lang, projectName }: { units: UnitVM[]; splitAt: number; showAll: boolean; onToggleSold: () => void; t: DevelopmentStrings; lang: string; projectName: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [lb, setLb] = useState<{ key: string; index: number } | null>(null);

  /* A column every unit leaves empty is 14 rows of "—" and nothing else. Which
     ones those are depends on the project: villas have no floor, Cap St Georges
     carries no bath count, apartment schemes have both and no plot. Decided per
     project rather than hard-coded. */
  const some = (f: (u: UnitVM) => unknown) => units.some((u) => Boolean(f(u)));

  /* Whether these photos belong to the units at all. developmentRender falls
     back to the project gallery for a unit that ships neither photos nor plans
     (Cap St Georges: all 14), so every row then carries the same twenty hero
     shots — identical thumbnails down the first column and the page's own
     gallery repeated inside each expanded row, neither of which says anything
     about the unit. Identical first images are the tell. */
  const ownPhotos = new Set(units.map((u) => u.photos[0] ?? "")).size > 1;

  /* A project whose units carry exactly ONE extra attribute, and nothing else
     to expand into, used to hide that attribute behind an expander: clicking a
     Cap St Georges row produced a single line, "Type  A", under a full-width
     rule. One attribute is a column, not a detail panel. Projects with a real
     spec list (median 5 attribute names, up to 17) keep their panel. */
  const attrCount = new Map<string, number>();
  for (const u of units) for (const a of u.attrs) attrCount.set(a.name.trim(), (attrCount.get(a.name.trim()) ?? 0) + 1);
  const hasRichDetail = ownPhotos || units.some((u) => u.plans.length > 0 || u.features.length > 0);
  const attrEntries = Array.from(attrCount.entries());
  const promoted = !hasRichDetail && attrEntries.length === 1 && attrEntries[0][1] >= units.length / 2 ? attrEntries[0][0] : null;
  const promotedValue = (u: UnitVM) => u.attrs.find((a) => a.name.trim() === promoted)?.value || "";

  /* Cap St Georges is 14 villas, so its Type column reads "Villa" fourteen
     times while the promoted attribute is what actually varies (A / C). A
     column repeating one value carries as little as one that is all dashes. */
  const typeVaries = new Set(units.map((u) => u.type ?? "")).size > 1;

  /* Covered area instead of built (Sascha, 2026-10-03): interior + covered
     veranda, the same figure the cards show as "Covered" (coveredArea — since
     2026-10-04 the interior is areaInternal where the source has one, see
     lib/formatArea.ts; built + veranda had double-counted ~1,000 units).

     The header follows the data, per project: 230 of 368 projects carry veranda
     figures and get the Covered column; the other 138 have nothing to add to
     the built area, so labelling it "Covered" there would be a claim the feed
     never made — those keep Built. Inside a Covered project, the 172 units out
     of 3,665 that have no veranda of their own fall back to their interior
     (interiorArea: areaInternal, else areaBuilt). */
  const coveredCol = units.some((u) => areaNum(u.areaVeranda) != null);
  const interiorOf = (u: UnitVM) => interiorArea(u.areaBuilt, u.areaInternal);
  const coveredOf = (u: UnitVM) => {
    const c = coveredArea(u.areaBuilt, u.areaInternal, u.areaVeranda) ?? areaNum(interiorOf(u));
    return c == null ? "" : `${c} ${t.unitM2}`;
  };
  const show = {
    type: typeVaries || !promoted,
    floor: some((u) => u.floor),
    beds: some((u) => u.beds),
    baths: some((u) => u.baths),
    built: some(interiorOf),
    plot: some((u) => u.areaPlot),
  };
  // Unit, Price, Status and the action cell are always there.
  const COLS = 4 + Object.values(show).filter(Boolean).length + (promoted ? 1 : 0);

  // Rows with nothing behind them are not expandable: no chevron, no click.
  const restAttrs = (u: UnitVM) => (promoted ? u.attrs.filter((a) => a.name.trim() !== promoted) : u.attrs);
  const hasDetail = (u: UnitVM) => restAttrs(u).length > 0 || (ownPhotos && u.photos.length > 1) || u.plans.length > 0 || u.features.length > 0;
  // Where no row expands (Limassol Greens: 115 units with no unit-level media
  // or specs at all) the chevron column would indent every name for nothing.
  const anyDetail = units.some(hasDetail);

  return (
    <div className="pp-tbl-wrap">
      <table className="pp-tbl">
        <thead>
          <tr>
            <th>{t.colUnit}</th>
            {show.type && <th>{t.colType}</th>}
            {promoted && <th>{promoted}</th>}
            {show.floor && <th>{t.colFloor}</th>}
            {show.beds && <th className="r">{t.colBeds}</th>}
            {show.baths && <th className="r">{t.factBaths}</th>}
            {show.built && <th className="r">{coveredCol ? t.factCovered : t.colBuilt}</th>}
            {show.plot && <th className="r">{t.colPlot}</th>}
            <th className="r">{t.colPrice}</th><th className="r">{t.colStatus}</th>
            {/* The enquiry button has a column of its own (Sascha, 2026-10-03);
                its header stays empty, there is no name for "the button". */}
            <th className="pp-tbl__action"></th>
          </tr>
        </thead>
        <tbody>
          {units.map((u, i) => {
            const key = u.ref || u.name;
            const isOpen = open === key;
            /* Rows past the limit are CLAMPED, not withheld: they are in the
               HTML from the first byte and hidden with CSS until the button is
               pressed.

               Measured before the change (2026-10-04): rendering only ten rows
               took 7,853 characters and 60 images with alt text off
               /projects/balance — a 43% drop — and 73 of 287 published projects
               have more than ten available units, 926 rows in all. No ranking
               depends on them (all 77 keywords the project pages rank for in
               Cyprus, and the 2 in Germany, are development names), but the
               images are image-search surface and there is no reason to spend
               them. Hidden rows cost nothing at load: their thumbnails are
               loading="lazy" and a display:none image is never fetched.

               The column set is still computed from every unit, so revealing
               them never reshapes the table. */
            const rolled = i >= splitAt;
            const clamped = rolled && !showAll;
            return (
              <React.Fragment key={key}>
                <tr
                  // The stagger is capped: a project with 60 sold units would
                  // otherwise finish its cascade nearly two seconds late.
                  style={rolled ? ({ "--i": Math.min(i - splitAt, 12) } as React.CSSProperties) : undefined}
                  className={`pp-tbl__row${clamped ? " is-clamped" : ""}${rolled ? " pp-tbl__row--rolled" : ""}${hasDetail(u) ? "" : " is-flat"}${u.status === "sold" ? " is-sold" : u.status === "reserved" ? " is-reserved" : ""}${isOpen ? " is-open" : ""}`}
                  onClick={hasDetail(u) ? () => setOpen(isOpen ? null : key) : undefined}
                  aria-expanded={hasDetail(u) ? isOpen : undefined}
                >
                  {/* Chevron, thumbnail and the two lines of text are one grid
                      inside the cell, so the grey reference lines up under the
                      unit name instead of under the chevron. */}
                  <td className="pp-tbl__name">
                    <span className="pp-tbl__namegrid">
                      {anyDetail && <span className="pp-tbl__chev" aria-hidden>{hasDetail(u) ? (isOpen ? "▾" : "▸") : ""}</span>}
                      {ownPhotos && u.photos[0] && (
                        <img className="pp-tbl__thumb" src={atSize(u.photos[0], "small")} alt={`${unitLabel(u)}${u.type ? ` — ${capitalizeType(u.type)}` : ""}`} loading="lazy" />
                      )}
                      <span className="pp-tbl__label">{unitLabel(u)}<small>{u.ref}</small></span>
                    </span>
                  </td>
                  {show.type && <td>{u.type ? (lang === "he" ? heFeedLabel(u.type) : capitalizeType(u.type)) : "—"}</td>}
                  {promoted && <td>{promotedValue(u) || "—"}</td>}
                  {show.floor && <td>{u.floor || "—"}</td>}
                  {show.beds && <td className="r">{u.beds || "—"}</td>}
                  {show.baths && <td className="r">{u.baths || "—"}</td>}
                  {show.built && <td className="r">{(coveredCol ? coveredOf(u) : interiorOf(u) && sqm(interiorOf(u), t.unitM2)) || "—"}</td>}
                  {show.plot && <td className="r">{u.areaPlot ? sqm(u.areaPlot, t.unitM2) : "—"}</td>}
                  <td className="r pp-tbl__price">{priceCell(u, t, lang)}</td>
                  <td className="r pp-tbl__status"><StatusPill u={u} lang={lang} /></td>
                  {/* A collapsed row had no next step at all — the enquiry step
                      lives in every row, not only in the expanded detail
                      (2026-10-03). It is the same component as the card's
                      button, one size down; it was a text link in the status
                      cell until Sascha asked for a real button in its own
                      last column. */}
                  <td className="pp-tbl__action">
                    {u.status === "available" && <EnquireButton u={u} t={t} projectName={projectName} compact />}
                  </td>
                </tr>
                {isOpen && hasDetail(u) && (
                  <tr className="pp-tbl__detail">
                    <td colSpan={COLS}>
                      <UnitDetails u={u} t={t} projectName={projectName} withPhotos={ownPhotos} withFeatures withEnquire={false} hideAttrs={promoted ? [promoted] : []} onOpenPhoto={(i) => setLb({ key, index: i })} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {units.length > splitAt && (
            <tr className="pp-tbl__morerow">
              <td colSpan={COLS}>
                <button className="pp-showmore pp-showmore--bronze" type="button" onClick={onToggleSold} aria-expanded={showAll}>
                  {showAll ? t.showLess : t.showMoreUnits(units.length - splitAt)}
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {/* One lightbox for the whole table, keyed to whichever row is open —
          mounting one per row would put dozens of overlays in the DOM. */}
      <Lightbox
        images={units.find((u) => (u.ref || u.name) === lb?.key)?.photos ?? []}
        index={lb?.index ?? null}
        onIndex={(i) => setLb(lb && i != null ? { ...lb, index: i } : null)}
        onClose={() => setLb(null)}
        alt={units.find((u) => (u.ref || u.name) === lb?.key)?.name ?? ""}
      />
    </div>
  );
}

export default function UnitsView({ units, lang = "en", projectName }: { units: UnitVM[]; lang?: string; projectName: string }) {
  const t = developmentCopy(lang);
  /* Table by default (2026-10-03). Only the selected view is rendered, so the
     default is what ends up in the HTML a crawler reads. The table was chosen
     partly because it carried all 14 cap-st-georges units where the cards
     carried 6 — but later the same day sold and reserved units were folded
     behind a toggle here too (asked for by Sascha), so both views now ship the
     available units only and that particular advantage is gone. What remains:
     a real <table> with column headers, and thumbnails with a real alt, which
     the cards never had. Sold units leaving the markup costs little — their
     prices are history and nobody searches for them — but it does shorten the
     page on projects that are mostly sold. */
  const [view, setView] = useState<"cards" | "table">("table");
  const [showAll, setShowAll] = useState(false);
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
  /* Reserved is treated exactly like sold: neither is offered, so neither is
     listed. They were behind a "show more" until 2026-10-03, which produced
     the odd "Show 13 more units" under a list of eight — the button promised
     units and delivered things nobody can buy. Only the count in the line
     under the heading still mentions them. */
  const available = sorted.filter((u) => u.status === "available");
  const unavailable = sorted.filter((u) => u.status !== "available");

  /* Long availability lists are cut short; the button reveals the REST OF THE
     AVAILABLE units, which is what a reader expects it to do. Nine in the card
     grid so three rows come out full (it is 3-up on desktop, Sascha 2026-10-03),
     ten in the table, where a round number reads better than a grid-derived one. */
  const LIMIT = view === "cards" ? 9 : 10;
  const hiddenAvailable = Math.max(0, available.length - LIMIT);
  // Every available unit is rendered; the ones past the limit are hidden with
  // CSS rather than left out of the document (see the note in UnitsTable).
  const isClamped = (i: number) => !showAll && i >= LIMIT;

  // measure the responsive column count so a card row expands as one
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

  return (
    <div>
      {/* The heading moved in here from ProjectPageBody so the view switch can
          sit on its baseline at the right-hand edge. It is still the section's
          <h2> and still server-rendered — a client component's first paint is
          HTML like any other. */}
      <div className="pp-units-head">
        <div className="pp-units-head__text">
          <h2 className="pp-h2">{t.unitsHeading}</h2>
          <p className="pp-hint">{t.unitsSubAvailable(available.length)}{unavailable.length > 0 ? t.unitsSubSold(unavailable.length) : ""}</p>
        </div>
        <div className="pp-viewtoggle" role="tablist" aria-label={t.unitDisplayAria}>
          <button role="tab" aria-selected={view === "table"} className={view === "table" ? "is-on" : ""} onClick={() => setView("table")}>{t.viewTable}</button>
          <button role="tab" aria-selected={view === "cards"} className={view === "cards" ? "is-on" : ""} onClick={() => setView("cards")}>{t.viewCards}</button>
        </div>
      </div>
      {view === "cards" ? (
        <>
          <div className="pp-ugrid" ref={gridRef}>{available.map((u, i) => <UnitCard key={u.ref || u.name} u={u} t={t} lang={lang} projectName={projectName} open={openRows.has(rowOf(i))} onToggle={() => toggleRow(i)} clamped={isClamped(i)} />)}</div>
          {hiddenAvailable > 0 && (
            <button className="pp-showmore pp-showmore--bronze" type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
              {showAll ? t.showLess : t.showMoreUnits(hiddenAvailable)}
            </button>
          )}
        </>
      ) : (
        <UnitsTable units={available} splitAt={LIMIT} showAll={showAll} onToggleSold={() => setShowAll((v) => !v)} t={t} lang={lang} projectName={projectName} />
      )}
    </div>
  );
}
