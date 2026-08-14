// Shared helper for any m² value that's computed (e.g. summed) at display
// time rather than passed through as a raw string from source data. Guards
// against IEEE 754 drift — 125.6 + 9.7 === 135.29999999999998 in JS — by
// rounding to 1 decimal place. Do NOT apply this to raw pass-through area
// strings (those are already clean from source data and were never computed).
export function roundArea(n: number): number {
  return Math.round(n * 10) / 10;
}
