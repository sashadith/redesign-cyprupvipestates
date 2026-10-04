// Shared helper for any m² value that's computed (e.g. summed) at display
// time rather than passed through as a raw string from source data. Guards
// against IEEE 754 drift — 125.6 + 9.7 === 135.29999999999998 in JS — by
// rounding to 1 decimal place. Do NOT apply this to raw pass-through area
// strings (those are already clean from source data and were never computed).
export function roundArea(n: number): number {
  return Math.round(n * 10) / 10;
}

// Leading numeric value of an area string as stored or pre-formatted
// ("77 m²" -> 77, "64.5" -> 64.5); null for empty, zero or non-numeric.
export function areaValue(v: string | null | undefined): number | null {
  const m = (v || "").trim().match(/^[\d.]+/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* Covered area = interior + covered veranda, computed at display time, never
   stored. Null when there is no veranda figure — nothing to add, and labelling
   the built area "Covered" would be a claim the source never made.

   The interior is areaInternal when the source gives one, and only otherwise
   areaBuilt. Summing areaBuilt + areaVeranda (as the page did until 2026-10-04)
   assumes areaBuilt is the bare interior, which holds for Plus Properties and the
   live-feed adapters but NOT for five sources that store a veranda-inclusive
   total there: prod DB, 2026-10-04, units with all three figures where
   built >= internal + veranda — Cybarco 402/402, SharePoint 389, manual 145,
   AGG 120, Drive 18 (~1,000 published). Vasileon C305: 89 internal + 11 veranda,
   "Total areas" 124 → the page said 135; the real figure is 100. */
export function coveredArea(built: string | null | undefined, internal: string | null | undefined, veranda: string | null | undefined): number | null {
  const v = areaValue(veranda);
  if (v == null) return null;
  const base = areaValue(internal) ?? areaValue(built);
  return base == null ? null : roundArea(base + v);
}
