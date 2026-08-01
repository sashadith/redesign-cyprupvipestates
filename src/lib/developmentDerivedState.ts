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
import { prisma } from "@/lib/prisma";
import { computeAvailability, type UnitStatusLike } from "@/lib/developmentAvailability";

export async function recomputeDevelopmentDerivedState(developmentId: string): Promise<void> {
  const dev = await prisma.development.findUnique({
    where: { id: developmentId },
    select: { soldOutSince: true, units: { select: { status: true } } },
  });
  if (!dev) return;

  const { total, available, soldOut } = computeAvailability(dev.units as UnitStatusLike[]);
  const wasSoldOut = dev.soldOutSince != null;

  const data: { unitsAvailable: number; unitsTotal: number; soldOutSince?: Date | null; returnedToMarketAt?: Date } = {
    unitsAvailable: available,
    unitsTotal: total,
  };
  if (soldOut && !wasSoldOut) {
    data.soldOutSince = new Date();
  } else if (!soldOut && wasSoldOut) {
    data.soldOutSince = null;
    data.returnedToMarketAt = new Date();
  }

  await prisma.development.update({ where: { id: developmentId }, data });
}
