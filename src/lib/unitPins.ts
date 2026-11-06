/* Per-unit field pins — the developer's own price list beating their own feed.

   Island Blue is the case this exists for. Their XML feed reports a unit
   available at one price while the price list they send out the same week says
   Reserved at another, and the price list is what the sales desk works from.
   Correcting such a unit in the database used to hold for exactly one night:
   syncFeedUnitsPreservingUnlisted writes the full feed row over every matched
   source:"feed" unit, so eight corrections entered from the 27.10.2026 price
   list on 2026-11-04 were all back to the feed's values by 04:00 on 11-06.

   source:"manual" is not the escape it looks like. For a STATUS_SYNC_DEVS
   developer — island-blue among them — statusOnlySync then pushes the feed's
   status onto the manual unit instead, so the status follows the feed either
   way. The one value that survives both paths is "sold", and that is the wrong
   word for a reservation which may yet fall through.

   A pin is therefore per unit and per field: this column, on this unit, is
   ours, and every sync leaves it alone until someone releases it. Releasing it
   is a deliberate act with a visible consequence — the next sync writes the
   feed's value straight back — which is why nothing clears a pin implicitly. */

// Deliberately only the two columns a price list actually contradicts. A pin on
// label, areas or photos would freeze content the feed legitimately keeps
// improving, and would do it invisibly: nobody goes looking for a pin to
// explain why a unit's area never changes again. Widening this list means
// widening the admin UI that sets them, on purpose, not by accident.
export const PINNABLE_UNIT_FIELDS = ["status", "price"] as const;
export type PinnableUnitField = (typeof PINNABLE_UNIT_FIELDS)[number];

const PINNABLE: readonly string[] = PINNABLE_UNIT_FIELDS;

/** Whitelist, trim and de-duplicate whatever a caller offers. Anything not
    pinnable is dropped rather than rejected: the stored array is read on every
    sync, so a value that got in by some other route must never be able to
    strip an arbitrary column out of a unit update. */
export function normalizeUnitPins(raw: unknown): PinnableUnitField[] {
  if (!Array.isArray(raw)) return [];
  const out: PinnableUnitField[] = [];
  for (const v of raw) {
    const f = typeof v === "string" ? v.trim() : "";
    if (PINNABLE.includes(f) && !out.includes(f as PinnableUnitField)) out.push(f as PinnableUnitField);
  }
  return out;
}

export function isUnitFieldPinned(
  pinned: readonly string[] | null | undefined,
  field: PinnableUnitField,
): boolean {
  return normalizeUnitPins(pinned).includes(field);
}

/** Remove every pinned column from a unit update, so the write leaves those
    values exactly as they stand. Same shape as freezeForPublished() does for
    the Development row: keys are deleted, not nulled — an omitted key is the
    only way to tell Prisma "don't touch this". */
export function stripPinnedUnitFields<T extends Record<string, unknown>>(
  data: T,
  pinned: readonly string[] | null | undefined,
): Partial<T> {
  const fields = normalizeUnitPins(pinned);
  if (!fields.length) return data;
  const out: Partial<T> = { ...data };
  for (const f of fields) delete (out as Record<string, unknown>)[f];
  return out;
}
