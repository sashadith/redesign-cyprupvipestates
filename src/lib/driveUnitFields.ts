import type { ExtractedUnit } from "./ai/pricelistExtract";
import { normalizeRef } from "./unitRef";

export const nn = (v: string | undefined | null) => (v && String(v).trim() ? String(v).trim() : null);
const numFrom = (s?: string | null) => { const m = (s || "").match(/[\d.]+/); return m ? parseFloat(m[0]) : null; };

// Map the price-list's per-unit extraction onto our columns. Sheets vary a lot
// (one dev gives a single "Internal Area", another splits Ground/Upper floor,
// another adds parking/storage/pool as their own columns) — whatever doesn't have
// a dedicated column (parking, storage, pool, per-unit extras, floor breakdown)
// goes into `attrs`, which the public unit card already renders as a spec list.
export function unitFields(u: ExtractedUnit) {
  const attrs: { name: string; value: string }[] = [];
  let areaBuilt = nn(u.areaBuilt);
  if (!areaBuilt && (u.areaGroundFloor || u.areaUpperFloor)) {
    const g = numFrom(u.areaGroundFloor), l = numFrom(u.areaUpperFloor);
    if (g != null || l != null) areaBuilt = `${Math.round((g ?? 0) + (l ?? 0))} m²`;
    if (u.areaGroundFloor) attrs.push({ name: "Ground floor (internal)", value: u.areaGroundFloor });
    if (u.areaUpperFloor) attrs.push({ name: "Upper floor (internal)", value: u.areaUpperFloor });
  }
  if (u.extras) attrs.push({ name: "Details", value: u.extras });
  if (u.parking) attrs.push({ name: "Parking", value: u.parking });
  if (u.storage) attrs.push({ name: "Storage", value: u.storage });
  if (u.pool) attrs.push({ name: "Private pool", value: u.pool });
  return {
    baths: nn(u.bathrooms),
    areaBuilt,
    areaPlot: nn(u.areaPlot),
    areaVeranda: nn(u.areaVeranda),
    areaVerandaOpen: nn(u.areaVerandaOpen),
    attrs,
  };
}

/* Details for units a LIGHT sync has just created (2026-10-31). The nightly run
   reads ref/price/status only, so a unit that appears in the list overnight is
   created bare — Tenera Villas 1A & 1B lost every detail that way on 2026-10-30.
   Given a detailed re-read of the same list, this returns the detail fields for
   exactly those new rows, matched by normalised ref. Price, status and ref are
   never included (the light pass already wrote them), nor anything for a row
   without a single detail. */
export function newUnitDetails(
  created: { id: string; ref: string }[],
  fresh: ExtractedUnit[],
  projectName: string,
  projectAmenities: string[],
) {
  const byKey = new Map(fresh.map((f) => [normalizeRef(String(f.ref || ""), projectName), f]));
  const out: { id: string; data: { beds: string | null; amenities: string[] } & ReturnType<typeof unitFields> }[] = [];
  for (const c of created) {
    const f = byKey.get(normalizeRef(c.ref, projectName));
    if (!f) continue;
    const data = { beds: nn(f.bedrooms), ...unitFields(f), amenities: projectAmenities };
    const hasDetail = data.beds || data.baths || data.areaBuilt || data.areaPlot || data.areaVeranda || data.areaVerandaOpen || data.attrs.length;
    if (hasDetail) out.push({ id: c.id, data });
  }
  return out;
}
