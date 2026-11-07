"use client";
import { useMemo } from "react";
import type { MatchFilters } from "@/lib/crm/matching";
import type { LocationOptions } from "@/lib/crm/presentations/locations";
import { PROPERTY_VALUES } from "@/app/components/qualifierFields";
import { placeKey } from "@/lib/crm/placeNames";

// Filter strip of the presentation modal: same filters as the old matching
// panel (budget, bedrooms incl. Studio and 5+, district → area cascade, type,
// include-ready, only-available).

const BED_OPTIONS = [0, 1, 2, 3, 4, 5]; // 5 = "5+"
const bedLabel = (n: number) => (n === 5 ? "5+" : n === 0 ? "Studio" : String(n));

type SetFilters = (fn: (f: MatchFilters) => MatchFilters) => void;

const toggle = <T,>(xs: T[] | undefined, x: T): T[] => ((xs ?? []).includes(x) ? (xs ?? []).filter((v) => v !== x) : [...(xs ?? []), x]);
// Places compare by placeKey: a search saved with another spelling ("Tombs Of The Kings")
// still lights its chip, and unticking drops every spelling of it.
const hasPlace = (xs: string[] | undefined, x: string) => (xs ?? []).some((v) => placeKey(v) === placeKey(x));
const togglePlace = (xs: string[] | undefined, x: string): string[] =>
  hasPlace(xs, x) ? (xs ?? []).filter((v) => placeKey(v) !== placeKey(x)) : [...(xs ?? []), x];

export function PresentationFilters({ filters, setFilters, locations, locationsError, status, sort = null }: {
  filters: MatchFilters; setFilters: SetFilters; locations: LocationOptions | null; locationsError: string | null;
  status: React.ReactNode;
  /** The results' sort control, shown next to the count. */
  sort?: React.ReactNode;
}) {
  // Areas offered once a district is picked: union across the picked districts.
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    const byKey = new Map<string, string>();
    (locations?.districts ?? []).filter((d) => hasPlace(filters.districts, d))
      .forEach((d) => (locations?.areasByDistrict[d] ?? []).forEach((a) => { if (!byKey.has(placeKey(a))) byKey.set(placeKey(a), a); }));
    return Array.from(byKey.values()).sort();
  }, [filters.districts, locations]);

  // Deselecting a district also drops areas that only belonged to it.
  const toggleDistrict = (d: string) => setFilters((f) => {
    const districts = togglePlace(f.districts, d);
    const stillValid = new Set((locations?.districts ?? []).filter((dd) => hasPlace(districts, dd))
      .flatMap((dd) => (locations?.areasByDistrict[dd] ?? []).map(placeKey)));
    return { ...f, districts, areas: (f.areas ?? []).filter((a) => stillValid.has(placeKey(a))) };
  });
  const num = (v: string) => (v ? Number(v) : null);

  return (
    <div className="crm-pres-filters">
      <div className="crm-pres-budget">
        <label className="crm-pres-field">Budget min (€)
          <input type="number" min={0} step={1000} inputMode="numeric" value={filters.budgetMin ?? ""}
            onChange={(e) => { const v = num(e.target.value); setFilters((f) => ({ ...f, budgetMin: v })); }} />
        </label>
        <label className="crm-pres-field">Budget max (€)
          <input type="number" min={0} step={1000} inputMode="numeric" value={filters.budgetMax ?? ""}
            onChange={(e) => { const v = num(e.target.value); setFilters((f) => ({ ...f, budgetMax: v })); }} />
        </label>
      </div>
      <fieldset className="crm-pres-chips">
        <legend>Bedrooms</legend>
        <div>
          {BED_OPTIONS.map((n) => {
            const on = (filters.bedrooms ?? []).includes(n);
            return <button key={n} type="button" className={`crm-chip${on ? " on" : ""}`} aria-pressed={on}
              onClick={() => setFilters((f) => ({ ...f, bedrooms: toggle(f.bedrooms, n) }))}>{bedLabel(n)}</button>;
          })}
        </div>
      </fieldset>
      <fieldset className="crm-pres-chips">
        <legend>Property type</legend>
        <div>
          {PROPERTY_VALUES.map((t) => {
            const on = (filters.propertyTypes ?? []).includes(t);
            return <button key={t} type="button" className={`crm-chip${on ? " on" : ""}`} aria-pressed={on}
              onClick={() => setFilters((f) => ({ ...f, propertyTypes: toggle(f.propertyTypes, t) }))}>{t}</button>;
          })}
        </div>
      </fieldset>
      <fieldset className="crm-pres-chips wide">
        <legend>District</legend>
        <div>
          {locationsError && <span className="crm-dialog-error">{locationsError}</span>}
          {!locationsError && !locations && <span className="crm-muted">Loading districts…</span>}
          {locations && locations.districts.length === 0 && <span className="crm-muted">No districts found</span>}
          {(locations?.districts ?? []).map((d) => {
            const on = hasPlace(filters.districts, d);
            return <button key={d} type="button" className={`crm-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleDistrict(d)}>{d}</button>;
          })}
        </div>
      </fieldset>
      {(filters.districts ?? []).length > 0 && availableAreas.length > 0 && (
        <fieldset className="crm-pres-chips wide">
          <legend>Area</legend>
          <div>
            {availableAreas.map((a) => {
              const on = hasPlace(filters.areas, a);
              return <button key={a} type="button" className={`crm-chip${on ? " on" : ""}`} aria-pressed={on}
                onClick={() => setFilters((f) => ({ ...f, areas: togglePlace(f.areas, a) }))}>{a}</button>;
            })}
          </div>
        </fieldset>
      )}
      <div className="crm-pres-checks">
        <label><input type="checkbox" checked={!!filters.includeReady} onChange={(e) => { const v = e.target.checked; setFilters((f) => ({ ...f, includeReady: v })); }} /> Include ready (unpublished) projects</label>
        <label><input type="checkbox" checked={!!filters.onlyAvailable} onChange={(e) => { const v = e.target.checked; setFilters((f) => ({ ...f, onlyAvailable: v })); }} /> Only with available units</label>
        {sort}
        <span className="crm-pres-status" aria-live="polite">{status}</span>
      </div>
    </div>
  );
}
