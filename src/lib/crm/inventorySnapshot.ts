import { prisma } from "@/lib/prisma";
import { listedUnits, computeAvailability } from "@/lib/developmentAvailability";
import { adminDateKey } from "@/lib/adminTime";

/* Nightly catalogue snapshot (MCP connector Phase 3). There is no price or
   status history anywhere else in the schema — Development/DevelopmentUnit
   only carry updatedAt — so crm_inventory_changes diffs against rows we
   capture ourselves. Written by /api/cron/inventory-snapshot only. */

export type SnapshotUnit = { key: string; label: string | null; status: string; price: number | null };
export type SnapshotShape = { publishStatus: string; priceFrom: number | null; priceTo: number | null; unitsTotal: number; unitsAvailable: number; units: SnapshotUnit[] };
export type SnapshotUnitInput = { id: string; ref: string | null; feedRef: string | null; label: string | null; status: string | null; price: number | null };

export const SNAPSHOT_RETENTION_DAYS = 180;
const DAY = 86_400_000;
const BATCH = 50;

// Published developments keep their unit rows across feed syncs and are
// matched by ref (syncFeedUnitsPreservingUnlisted); "ready" ones are
// deleteMany+createMany every night, so only ref/feedRef survive there.
export function unitKey(u: { id: string; ref: string | null; feedRef: string | null }): string {
  return u.ref?.trim() || u.feedRef?.trim() || u.id;
}

export function snapshotOf(d: { publishStatus: string; priceFrom: number | null; priceTo: number | null; units: SnapshotUnitInput[] }): SnapshotShape {
  // Schema default for status is "available"; a null (pre-default row) counts
  // as available both in the list and in the totals so the two never disagree.
  const listed = listedUnits(d.units).map((u) => ({ ...u, status: u.status ?? "available" }));
  const availability = computeAvailability(listed);
  const seen = new Set<string>();
  const units: SnapshotUnit[] = listed.map((u) => {
    let key = unitKey(u);
    if (seen.has(key)) key = `${key}#${u.id}`; // two rows sharing a ref — keep both, second one id-qualified
    seen.add(key);
    return { key, label: u.label, status: u.status, price: u.price };
  });
  return { publishStatus: d.publishStatus, priceFrom: d.priceFrom, priceTo: d.priceTo, unitsTotal: availability.total, unitsAvailable: availability.available, units };
}

export async function captureSnapshots(now: Date = new Date()): Promise<{ captured: number; skipped: number; deleted: number; previousDayCount: number }> {
  const todayKey = adminDateKey(now);
  const yesterdayKey = adminDateKey(new Date(now.getTime() - DAY));
  const [developments, recent] = await Promise.all([
    prisma.development.findMany({
      where: { publishStatus: { in: ["published", "ready"] } },
      select: { id: true, publishStatus: true, priceFrom: true, priceTo: true, units: { select: { id: true, ref: true, feedRef: true, label: true, status: true, price: true } } },
    }),
    prisma.developmentSnapshot.findMany({ where: { capturedAt: { gte: new Date(now.getTime() - 2 * DAY) } }, select: { developmentId: true, capturedAt: true } }),
  ]);
  const doneToday = new Set(recent.filter((r) => adminDateKey(r.capturedAt) === todayKey).map((r) => r.developmentId));
  const previousDayCount = recent.filter((r) => adminDateKey(r.capturedAt) === yesterdayKey).length;

  const rows = developments
    .filter((d) => !doneToday.has(d.id)) // idempotent per Cyprus calendar day — a manual re-run must not double up
    .map((d) => ({ developmentId: d.id, capturedAt: now, ...snapshotOf(d) }));
  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.developmentSnapshot.createMany({ data: rows.slice(i, i + BATCH) });
  }
  const deleted = await prisma.developmentSnapshot.deleteMany({ where: { capturedAt: { lt: new Date(now.getTime() - SNAPSHOT_RETENTION_DAYS * DAY) } } });
  return { captured: rows.length, skipped: developments.length - rows.length, deleted: deleted.count, previousDayCount };
}
