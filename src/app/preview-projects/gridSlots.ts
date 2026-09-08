/* Where the map preview sits among the result cards.
 *
 * The rule used to live inline in ProjectsExplorer's JSX as a ternary inside
 * `cards.map()`, which REPLACED the card at index 2 with the map tile instead
 * of inserting it. That silently dropped one project from every desktop page:
 * the server slices a fixed PAGE_SIZE per page, so the third result of each
 * page appeared on no page at all — roughly 21 of 246 projects were reachable
 * only via the map, search or a direct URL (measured 2026-09-08, when Synergy
 * went missing from a three-result Larnaca filter that rendered two cards).
 *
 * Extracted so the ordering is a plain function over data and can be tested
 * without a DOM — see scripts/qa/grid-slots-check.mjs.
 */
export type GridSlot<T> = { kind: "card"; card: T } | { kind: "map" };

/** Cards in order, with the map tile in the third slot — or appended when
    there are fewer than three cards, so it never disappears on small result
    sets. Mobile gets no tile: the map opens from the filter bar instead. */
export function gridSlots<T>(cards: T[], isMobile: boolean): GridSlot<T>[] {
  const slots: GridSlot<T>[] = cards.map((card) => ({ kind: "card", card }));
  if (isMobile || cards.length === 0) return slots;
  slots.splice(Math.min(2, slots.length), 0, { kind: "map" });
  return slots;
}
