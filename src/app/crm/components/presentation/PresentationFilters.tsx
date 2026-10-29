"use client";
import { useMemo } from "react";
import type { MatchFilters } from "@/lib/crm/matching";
import type { LocationOptions } from "@/lib/crm/presentations/locations";
import { PROPERTY_VALUES } from "@/app/components/qualifierFields";

// Filter strip of the presentation modal: same filters as the old matching
// panel (budget, bedrooms incl. Studio and 5+, district → area cascade, type,
// include-ready, only-available).

const BED_OPTIONS = [0, 1, 2, 3, 4, 5]; // 5 = "5+"
const bedLabel = (n: number) => (n === 5 ? "5+" : n === 0 ? "Studio" : String(n));

type SetFilters = (fn: (f: MatchFilters) => MatchFilters) => void;

const toggle = <T,>(xs: T[] | undefined, x: T): T[] => ((xs ?? []).includes(x) ? (xs ?? []).filter((v) => v !== x) : [...(xs ?? []), x]);

export function PresentationFilters({ filters, setFilters, locations, locationsError, status }: {
  filters: MatchFilters; setFilters: SetFilters; locations: LocationOptions | null; locationsError: string | null;
  status: React.ReactNode;
}) {
  // Areas offered once a district is picked: union across the picked districts.
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    (filters.districts ?? []).forEach((d) => (locations?.areasByDistrict[d] ?? []).forEach((a) => set.add(a)));
    return Array.from(set).sort();
  }, [filters.districts, locations]);

  // Deselecting a district also drops areas that only belonged to it.
  const toggleDistrict = (d: string) => setFilters((f) => {
    const districts = toggle(f.districts, d);
    const stillValid = new Set(districts.flatMap((dd) => locations?.areasByDistrict[dd] ?? []));
    return { ...f, districts, areas: (f.areas ?? []).filter((a) => stillValid.has(a)) };
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
            const on = (filters.districts ?? []).includes(d);
            return <button key={d} type="button" className={`crm-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleDistrict(d)}>{d}</button>;
          })}
        </div>
      </fieldset>
      {(filters.districts ?? []).length > 0 && availableAreas.length > 0 && (
        <fieldset className="crm-pres-chips wide">
          <legend>Area</legend>
          <div>
            {availableAreas.map((a) => {
              const on = (filters.areas ?? []).includes(a);
              return <button key={a} type="button" className={`crm-chip${on ? " on" : ""}`} aria-pressed={on}
                onClick={() => setFilters((f) => ({ ...f, areas: toggle(f.areas, a) }))}>{a}</button>;
            })}
          </div>
        </fieldset>
      )}
      <div className="crm-pres-checks">
        <label><input type="checkbox" checked={!!filters.includeReady} onChange={(e) => { const v = e.target.checked; setFilters((f) => ({ ...f, includeReady: v })); }} /> Include ready (unpublished) projects</label>
        <label><input type="checkbox" checked={!!filters.onlyAvailable} onChange={(e) => { const v = e.target.checked; setFilters((f) => ({ ...f, onlyAvailable: v })); }} /> Only with available units</label>
        <span className="crm-pres-status" aria-live="polite">{status}</span>
      </div>
    </div>
  );
}
