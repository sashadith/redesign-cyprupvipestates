"use client";
/** Projects page (2026-11-11): filter strip + sortable table over the partner's published projects. All in the browser. */
import { useMemo, useState } from "react";
import type { PartnerDict, PartnerLocale } from "@/lib/partner/i18n";
import { typeLabel } from "@/lib/typeLabels";
import { placeKey } from "@/lib/crm/placeNames";
import {
  ADDED_WITHIN, BED_CHIPS, DELIVERY_BUCKETS, EMPTY_FILTERS, FIRST_DIR, TYPE_CHIPS,
  activeFilterCount, districtOf, filterProjects, isNew, placeOptions, sortProjects,
  type AddedWithin, type CatalogFilters, type CatalogProject, type DeliveryBucket, type SortDir, type SortKey,
} from "@/lib/partner/projectFilter";
import { fill } from "./forms";

export type ProjectRowView = CatalogProject;

type Props = { t: PartnerDict; locale: PartnerLocale; projects: ProjectRowView[]; trustMode: boolean; now: string };

const toggle = <T,>(xs: T[], x: T): T[] => (xs.includes(x) ? xs.filter((v) => v !== x) : [...xs, x]);
const digits = (s: string): number | null => {
  const d = s.replace(/[^\d]/g, "");
  return d ? Math.min(Number(d), 1_000_000_000) : null;
};
const rateNum = (s: string): number | null => {
  const v = Number(s.replace(",", ".").replace(/[^\d.]/g, ""));
  return s.trim() && Number.isFinite(v) ? v : null;
};

/** typeLabel passes English through unchanged, so hand it the capitalized word. */
const typeName = (ty: string, locale: PartnerLocale) => typeLabel(ty.charAt(0).toUpperCase() + ty.slice(1), locale);

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={on ? "pp-fchip on" : "pp-fchip"} aria-pressed={on} onClick={onClick}>{children}</button>;
}

export function ProjectsList({ t, locale, projects, trustMode, now: nowIso }: Props) {
  const T = t.projectsPage;
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [f, setF] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [minRate, setMinRate] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "added", dir: "desc" });
  const set = (patch: Partial<CatalogFilters>) => setF((cur) => ({ ...cur, ...patch }));

  const money = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }), [locale]);
  const pct = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);
  const day = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Nicosia" }), [locale]);
  const rate = (r: number | null) => (r == null ? T.onRequest : fill(T.pct, { rate: pct.format(r) }));
  const bedLabel = (n: number) => (n === 0 ? T.studio : n >= 5 ? "5+" : String(n));
  const year = now.getUTCFullYear();
  const deliveryLabel: Record<DeliveryBucket, string> = {
    ready: T.ready, thisYear: String(year), nextYear: String(year + 1), later: fill(T.later, { year: String(year + 2) }),
  };

  const places = useMemo(() => placeOptions(projects), [projects]);
  const areaChoices = useMemo(() => {
    const picked = new Set(f.districts.map(placeKey));
    return places.districts.filter((d) => picked.has(placeKey(d))).flatMap((d) => places.areasByDistrict[d] ?? []);
  }, [f.districts, places]);
  const shown = useMemo(() => sortProjects(filterProjects(projects, f, now), sort.key, sort.dir), [projects, f, now, sort]);
  const active = activeFilterCount(f);
  const moreActive = f.areas.length + f.delivery.length + (f.addedWithin != null ? 1 : 0) + (f.minRate != null ? 1 : 0) + (f.onlyFree ? 1 : 0);

  const toggleDistrict = (d: string) => setF((cur) => {
    const districts = toggle(cur.districts, d);
    const keep = new Set(places.districts.filter((x) => districts.some((y) => placeKey(y) === placeKey(x)))
      .flatMap((x) => (places.areasByDistrict[x] ?? []).map(placeKey)));
    return { ...cur, districts, areas: cur.areas.filter((a) => keep.has(placeKey(a))) };
  });
  const reset = () => { setF(EMPTY_FILTERS); setBudgetMin(""); setBudgetMax(""); setMinRate(""); };
  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: FIRST_DIR[key] }));

  const columns: { key: SortKey; label: string }[] = [
    { key: "name", label: T.colProject }, { key: "place", label: T.colPlace }, { key: "price", label: T.colFrom },
    { key: "beds", label: T.colBeds }, { key: "free", label: T.colFree }, { key: "delivery", label: T.colDelivery },
    // Handover and fix are the same project rate times the partner's two shares, so they sort alike: one column.
    { key: "added", label: T.colAdded }, { key: "handover", label: `${t.submit.tabHandover} / ${t.submit.tabFix}` },
    ...(trustMode ? [{ key: "our" as SortKey, label: T.ourRate }] : []),
  ];
  const Th = ({ c }: { c: { key: SortKey; label: string } }) => {
    const on = sort.key === c.key;
    return (
      <th scope="col" aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" className={on ? "pp-sortbtn on" : "pp-sortbtn"} onClick={() => sortBy(c.key)}>
          {c.label}<span aria-hidden="true">{on ? (sort.dir === "asc" ? " ▲" : " ▼") : " ↕"}</span>
        </button>
      </th>
    );
  };

  return (
    <section className="pp-panel pp-projfilter">
      <div className="pp-filterrow">
        <div className="pp-filter-q">
          <label className="pp-sr" htmlFor="projects-q">{T.search}</label>
          <input id="projects-q" className="pp-search" type="search" value={f.q} placeholder={T.search} maxLength={100}
            onChange={(e) => set({ q: e.target.value })} />
        </div>
        <label className="pp-filter-num">{T.budgetMin}
          <input inputMode="numeric" value={budgetMin} placeholder="200 000" maxLength={13}
            onChange={(e) => { setBudgetMin(e.target.value); set({ budgetMin: digits(e.target.value) }); }} />
        </label>
        <label className="pp-filter-num">{T.budgetMax}
          <input inputMode="numeric" value={budgetMax} placeholder="500 000" maxLength={13}
            onChange={(e) => { setBudgetMax(e.target.value); set({ budgetMax: digits(e.target.value) }); }} />
        </label>
      </div>

      <fieldset className="pp-fgroup"><legend>{T.beds}</legend>
        {BED_CHIPS.map((n) => <Chip key={n} on={f.beds.includes(n)} onClick={() => set({ beds: toggle(f.beds, n) })}>{bedLabel(n)}</Chip>)}
      </fieldset>
      <fieldset className="pp-fgroup"><legend>{T.type}</legend>
        {TYPE_CHIPS.map((ty) => <Chip key={ty} on={f.types.includes(ty)} onClick={() => set({ types: toggle(f.types, ty) })}>{typeName(ty, locale)}</Chip>)}
      </fieldset>
      <fieldset className="pp-fgroup"><legend>{T.district}</legend>
        {places.districts.map((d) => <Chip key={d} on={f.districts.includes(d)} onClick={() => toggleDistrict(d)}>{d}</Chip>)}
      </fieldset>

      <details className="pp-morefilters" open={moreActive > 0 || undefined}>
        <summary>{T.moreFilters}{moreActive > 0 && <span className="pp-badge">{moreActive}</span>}</summary>
        {areaChoices.length > 0 && (
          <fieldset className="pp-fgroup"><legend>{T.area}</legend>
            {areaChoices.map((a) => <Chip key={a} on={f.areas.includes(a)} onClick={() => set({ areas: toggle(f.areas, a) })}>{a}</Chip>)}
          </fieldset>
        )}
        <fieldset className="pp-fgroup"><legend>{T.delivery}</legend>
          {DELIVERY_BUCKETS.map((b) => <Chip key={b} on={f.delivery.includes(b)} onClick={() => set({ delivery: toggle(f.delivery, b) })}>{deliveryLabel[b]}</Chip>)}
        </fieldset>
        <fieldset className="pp-fgroup"><legend>{T.added}</legend>
          {ADDED_WITHIN.map((d) => (
            <Chip key={d} on={f.addedWithin === d} onClick={() => set({ addedWithin: f.addedWithin === d ? null : (d as AddedWithin) })}>
              {fill(T.addedWithin, { days: String(d) })}
            </Chip>
          ))}
        </fieldset>
        <div className="pp-filterrow">
          <label className="pp-filter-num">{T.minRate}
            <input inputMode="decimal" value={minRate} placeholder="1.5" maxLength={5}
              onChange={(e) => { setMinRate(e.target.value); set({ minRate: rateNum(e.target.value) }); }} />
          </label>
          <label className="pp-filter-check">
            <input type="checkbox" checked={f.onlyFree} onChange={(e) => set({ onlyFree: e.target.checked })} /> {T.onlyFree}
          </label>
        </div>
      </details>

      <div className="pp-filterbar">
        <p className="pp-small pp-muted" aria-live="polite">{fill(T.shown, { count: String(shown.length), total: String(projects.length) })}</p>
        {active > 0 && <button type="button" className="pp-linkbtn" onClick={reset}>{T.reset}</button>}
        <label className="pp-sort-mobile">{T.sortBy}
          <select value={`${sort.key}:${sort.dir}`} onChange={(e) => { const [key, dir] = e.target.value.split(":") as [SortKey, SortDir]; setSort({ key, dir }); }}>
            {columns.flatMap((c) => [
              <option key={`${c.key}:asc`} value={`${c.key}:asc`}>{c.label} ▲</option>,
              <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{c.label} ▼</option>,
            ])}
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="pp-muted">{projects.length ? T.none : t.submit.projectsNone}</p>
      ) : (
        <div className="pp-tablewrap">
          <table className="pp-table pp-projtable">
            <thead><tr>{columns.map((c) => <Th key={c.key} c={c} />)}</tr></thead>
            <tbody>
              {shown.map((p) => {
                const place = [districtOf(p), p.area].filter(Boolean).join(" · ");
                const beds = p.bedsMin == null ? "—" : p.bedsMin === p.bedsMax ? bedLabel(p.bedsMin) : `${bedLabel(p.bedsMin)}–${bedLabel(p.bedsMax!)}`;
                const types = p.types.map((ty) => typeName(ty, locale)).join(", ");
                return (
                  <tr key={p.id}>
                    <th scope="row">
                      {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="pp-projlist-name">{p.name}</a>
                        : <span className="pp-projlist-name">{p.name}</span>}
                      {isNew(p, now) && <span className="pp-newmark">{T.newBadge}</span>}
                      {types && <span className="pp-cell-sub">{types}</span>}
                    </th>
                    <td data-label={T.colPlace}>{place || "—"}</td>
                    <td data-label={T.colFrom} className="pp-num">{p.shownFrom == null ? "—" : money.format(p.shownFrom)}</td>
                    <td data-label={T.colBeds}>{beds}</td>
                    <td data-label={T.colFree}>
                      {p.unitsTotal === 0 ? "—" : p.unitsFree === 0 ? T.soldOut : fill(T.freeOf, { free: String(p.unitsFree), total: String(p.unitsTotal) })}
                    </td>
                    <td data-label={T.colDelivery}>{p.ready ? T.ready : p.completion || "—"}</td>
                    <td data-label={T.colAdded}>{p.addedAt ? day.format(new Date(p.addedAt)) : "—"}</td>
                    <td data-label={`${t.submit.tabHandover} / ${t.submit.tabFix}`}>
                      <span><strong className="pp-figure-sm">{rate(p.handoverRate)}</strong> / <strong className="pp-figure-sm">{rate(p.fixRate)}</strong></span>
                    </td>
                    {trustMode && <td data-label={T.ourRate}><strong className="pp-figure-sm">{rate(p.ourRate)}</strong></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="pp-small pp-muted pp-sorthint">{T.sortHint}</p>
    </section>
  );
}
