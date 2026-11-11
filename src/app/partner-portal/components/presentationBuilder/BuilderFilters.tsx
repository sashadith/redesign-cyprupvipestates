"use client";
/** The CRM's filter strip for partners: budget, bedrooms (Studio–5+), type, district → area, only available. */
import { useMemo } from "react";
import type { MatchFilters } from "@/lib/crm/matching";
import type { LocationOptions } from "@/lib/crm/presentations/locations";
import { placeKey } from "@/lib/crm/placeNames";
import { typeLabel } from "@/lib/typeLabels";
import type { PartnerDict, PartnerLocale } from "@/lib/partner/i18n";

const BEDS = [0, 1, 2, 3, 4, 5];
// The CRM filter's values (qualifierFields PROPERTY_VALUES), labelled in the portal language.
const TYPES = ["Villa", "Townhouse", "Apartment", "Penthouse", "Office"];

const toggle = <T,>(xs: T[] | undefined, x: T): T[] => ((xs ?? []).includes(x) ? (xs ?? []).filter((v) => v !== x) : [...(xs ?? []), x]);
const hasPlace = (xs: string[] | undefined, x: string) => (xs ?? []).some((v) => placeKey(v) === placeKey(x));
const togglePlace = (xs: string[] | undefined, x: string): string[] =>
  hasPlace(xs, x) ? (xs ?? []).filter((v) => placeKey(v) !== placeKey(x)) : [...(xs ?? []), x];
const num = (v: string): number | null => { const d = v.replace(/[^\d]/g, ""); return d ? Math.min(Number(d), 1_000_000_000) : null; };

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={on ? "pp-pb-chip on" : "pp-pb-chip"} aria-pressed={on} onClick={onClick}>{children}</button>;
}

export function BuilderFilters({ t, lang, filters, setFilters, locations, locationsError }: {
  t: PartnerDict; lang: PartnerLocale; filters: MatchFilters; setFilters: (fn: (f: MatchFilters) => MatchFilters) => void;
  locations: LocationOptions | null; locationsError: string | null;
}) {
  const B = t.presBuilder;
  const areas = useMemo(() => {
    const byKey = new Map<string, string>();
    (locations?.districts ?? []).filter((d) => hasPlace(filters.districts, d))
      .forEach((d) => (locations?.areasByDistrict[d] ?? []).forEach((a) => { if (!byKey.has(placeKey(a))) byKey.set(placeKey(a), a); }));
    return Array.from(byKey.values()).sort();
  }, [filters.districts, locations]);
  const toggleDistrict = (d: string) => setFilters((f) => {
    const districts = togglePlace(f.districts, d);
    const keep = new Set((locations?.districts ?? []).filter((x) => hasPlace(districts, x)).flatMap((x) => (locations?.areasByDistrict[x] ?? []).map(placeKey)));
    return { ...f, districts, areas: (f.areas ?? []).filter((a) => keep.has(placeKey(a))) };
  });
  return (
    <fieldset className="pp-fieldset pp-pb-filters">
      <legend>{B.filtersTitle}</legend>
      <div className="pp-pb-filterrow">
        <label className="pp-pb-num">{B.budgetMin}
          <input inputMode="numeric" value={filters.budgetMin ?? ""} maxLength={13}
            onChange={(e) => { const v = num(e.target.value); setFilters((f) => ({ ...f, budgetMin: v })); }} />
        </label>
        <label className="pp-pb-num">{B.budgetMax}
          <input inputMode="numeric" value={filters.budgetMax ?? ""} maxLength={13}
            onChange={(e) => { const v = num(e.target.value); setFilters((f) => ({ ...f, budgetMax: v })); }} />
        </label>
        <label className="pp-pb-check">
          <input type="checkbox" checked={filters.onlyAvailable !== false}
            onChange={(e) => { const v = e.target.checked; setFilters((f) => ({ ...f, onlyAvailable: v })); }} /> {B.onlyAvailable}
        </label>
      </div>
      <div className="pp-pb-group" role="group" aria-label={B.bedrooms}><span className="pp-pb-group-l">{B.bedrooms}</span>
        {BEDS.map((n) => (
          <Chip key={n} on={(filters.bedrooms ?? []).includes(n)} onClick={() => setFilters((f) => ({ ...f, bedrooms: toggle(f.bedrooms, n) }))}>
            {n === 0 ? B.studio : n === 5 ? "5+" : String(n)}
          </Chip>
        ))}
      </div>
      <div className="pp-pb-group" role="group" aria-label={B.propertyType}><span className="pp-pb-group-l">{B.propertyType}</span>
        {TYPES.map((ty) => (
          <Chip key={ty} on={(filters.propertyTypes ?? []).includes(ty)} onClick={() => setFilters((f) => ({ ...f, propertyTypes: toggle(f.propertyTypes, ty) }))}>
            {typeLabel(ty, lang)}
          </Chip>
        ))}
      </div>
      <div className="pp-pb-group" role="group" aria-label={B.district}><span className="pp-pb-group-l">{B.district}</span>
        {locationsError && <span className="pp-err">{locationsError}</span>}
        {!locationsError && !locations && <span className="pp-muted">{B.loadingDistricts}</span>}
        {(locations?.districts ?? []).map((d) => <Chip key={d} on={hasPlace(filters.districts, d)} onClick={() => toggleDistrict(d)}>{d}</Chip>)}
      </div>
      {(filters.districts ?? []).length > 0 && areas.length > 0 && (
        <div className="pp-pb-group" role="group" aria-label={B.area}><span className="pp-pb-group-l">{B.area}</span>
          {areas.map((a) => (
            <Chip key={a} on={hasPlace(filters.areas, a)} onClick={() => setFilters((f) => ({ ...f, areas: togglePlace(f.areas, a) }))}>{a}</Chip>
          ))}
        </div>
      )}
    </fieldset>
  );
}
