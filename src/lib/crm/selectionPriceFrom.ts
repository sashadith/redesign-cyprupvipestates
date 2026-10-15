// "Price from" for a project inside a client presentation (2026-10-15).
// Always the cheapest AVAILABLE unit among the units the admin actually has
// selected — the same thing the client page shows (src/app/c/[token]/page.tsx
// resolves its price from the snapshot's units). The project-level priceFrom
// is only the fallback when there is no unit data to pick from at all.
//
// Why: the presentation editor listed Avalon Valley "from €213,000" (a studio)
// under a Villa filter whose cheapest matching villa was €522,000.

export type PricedUnit = { id: string; price: number | null; status: string };

/** `selectedIds` null = every available unit counts (the default selection). */
export function selectionPriceFrom(
  units: PricedUnit[],
  selectedIds: Iterable<string> | null,
  projectPriceFrom: number | null,
): number | null {
  if (units.length === 0) return projectPriceFrom; // no unit data → the whole project shows
  const sel = selectedIds ? new Set(selectedIds) : null;
  const prices = units
    .filter((u) => u.status === "available" && (!sel || sel.has(u.id)) && typeof u.price === "number" && u.price > 0)
    .map((u) => u.price as number);
  return prices.length ? Math.min(...prices) : null;
}
