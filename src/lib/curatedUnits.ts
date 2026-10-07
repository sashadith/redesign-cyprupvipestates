// A development whose units were curated by hand (any source:"manual" row) owns
// its unit list: a sync may still update rows it recognises by ref, but it must
// not add new rows next to the curated ones. Meander (Motive Point, 2026-10-07)
// is the case: its master price list prices the apartments only in pairs, so the
// operator keeps them as six manual pair units ("A001 + A002"); every re-read of
// the list would otherwise add the twelve single apartments back as empty
// duplicates. Same rule feedSync already applies (manual units lock the units).
export function maySyncCreateUnits(existingUnits: { source: string | null }[]): boolean {
  return !existingUnits.some((u) => u.source === "manual");
}
