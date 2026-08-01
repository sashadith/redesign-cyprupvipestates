// Write-side counterpart to computeAvailability() (developmentAvailability.ts,
// pure/read-only) — recomputes a Development's derived, cached state from its
// live DevelopmentUnit rows and persists it. Call this unconditionally after
// ANY write that can change a Development's unit statuses or unit count:
// feed sync (syncOneProject), statusOnlySync, the admin unit editor
// (saveUnits), PDF import (importFromPdfs), and drive availability sync.
// Bündel 2 (2026-08-01) — see prisma/schema.prisma's soldOutSince/
// returnedToMarketAt comments for what these fields mean and why a second
// field exists alongside soldOutSince.
//
// Deliberately keys the soldOutSince/returnedToMarketAt transition off the
// computeAvailability() BOOLEAN (soldOut), never a raw available-count delta.
// computeAvailability's own `total > 0 && available === 0` guard means a
// development can never register as sold out while it has zero units in the
// DB — so a whole-project feed delisting (units never touched at all, e.g.
// the Salt/legacy incident) or a transient units-sub-feed glitch (unit count
// briefly zeroed, syncedAt still advances) can never produce a false
// "newly sold out" -> "back in stock" cycle here: soldOut only ever flips
// false->true when there's a REAL positive total with zero available units.
//
// publishStatus scoping (added 2026-08-01, same day, after review): a draft
// mid-edit can genuinely pass through "has units, none available yet" as
// pure data entry, not a real market event — and this function is called
// from the admin unit editor, so that happens routinely. Two separate rules
// guard against that becoming a false "back in stock" notification later:
//   - soldOutSince only ever gets SET while trackable (published/ready) —
//     a draft never "becomes sold out" in the tracked sense at all.
//   - soldOutSince is still CLEARED unconditionally whenever available units
//     return, regardless of publishStatus, so the field itself is never
//     stale/wrong at display time no matter what state the dev is in.
//   - returnedToMarketAt (the ONLY field backInStockReminders() reads to
//     decide whether to fire) is stamped ONLY when that clear happens WHILE
//     trackable. This is the part a read-side-only publishStatus filter on
//     the Action Center rule can't substitute for: without this write-side
//     gate, editing a draft's units (still draft at that moment) could stamp
//     returnedToMarketAt, and then simply publishing the dev afterward —
//     with no further unit edit — would make it satisfy the read-side
//     filter and fire a false notification for a project that was never
//     really on the market to "return" to.
import { prisma } from "@/lib/prisma";
import { computeAvailability, type UnitStatusLike } from "@/lib/developmentAvailability";

const TRACKABLE_STATUSES = new Set(["published", "ready"]);

export async function recomputeDevelopmentDerivedState(developmentId: string): Promise<void> {
  const dev = await prisma.development.findUnique({
    where: { id: developmentId },
    select: { soldOutSince: true, publishStatus: true, units: { select: { status: true } } },
  });
  if (!dev) return;

  const { total, available, soldOut } = computeAvailability(dev.units as UnitStatusLike[]);
  const wasSoldOut = dev.soldOutSince != null;
  const trackable = TRACKABLE_STATUSES.has(dev.publishStatus);

  const data: { unitsAvailable: number; unitsTotal: number; soldOutSince?: Date | null; returnedToMarketAt?: Date } = {
    unitsAvailable: available,
    unitsTotal: total,
  };
  if (soldOut && !wasSoldOut && trackable) {
    data.soldOutSince = new Date();
  } else if (!soldOut && wasSoldOut) {
    data.soldOutSince = null;
    if (trackable) data.returnedToMarketAt = new Date();
  }

  await prisma.development.update({ where: { id: developmentId }, data });
}
