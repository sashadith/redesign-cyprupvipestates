import { prisma } from "@/lib/prisma";
import { BRIDGE_INCLUDE, type DevelopmentWithRelations } from "./payload";

/**
 * Deliverable projects, optionally only those touched since `since`.
 *
 * The cursor spans three tables PLUS the developer's switch. A unit's price
 * changing does not touch its Development row, and an admin editing the German
 * description touches only the override — a cursor on Development.updatedAt
 * alone would deliver a project's first version and then never mention it again.
 *
 * The fourth branch is the one that is easy to miss, and it was missed in this
 * plan's first draft. Switching a developer ON is exactly as invisible as
 * switching it off: its projects' rows do not change, so none of the three
 * timestamps moves, and an incremental consumer would never learn they became
 * deliverable — they would reappear only on a full export, which this design
 * discourages. bridgeChangedAt means "the switch was last touched at T", and
 * both this query and removedSince() read it, in opposite directions.
 *
 * INVARIANT this cannot enforce: a DELETED unit matches none of the four
 * branches — the row is gone, so `units.some` cannot see it, and nothing on
 * the Development or its override changed. Every unit-deleting call site today
 * sits beside a `recomputeDevelopmentDerivedState()`, which always issues a
 * `development.update` and so bumps `updatedAt`, which is the only reason this
 * is covered (feedSync, cybarcoSync, plusPropertiesSync, driveAvailabilitySync,
 * dropboxAvailabilitySync and the two admin unit actions — checked 2026-10-09;
 * two of them already recompute BEFORE pruning, the ordering that would break
 * it). A future delete path that skips the recompute leaves that unit listed
 * and purchasable on Xellex permanently, with nothing logged. No fifth branch
 * can be written against a row that no longer exists, so the rule is: touch
 * the Development row whenever you delete one of its units.
 *
 * Paged by id rather than by any date: ids are stable and total-ordered, so a
 * row edited mid-pagination cannot jump between pages or be skipped. Page size
 * is a latency budget, not a payload one — 37.9 MB for all 350 projects is one
 * ordinary gzipped response, but assembling them means ~121,000 fs.stat calls,
 * and that belongs in seven requests rather than one held-open connection.
 *
 * `id: { gt: cursorId }` rather than Prisma's own `cursor` + `skip: 1`, which
 * was this function's first draft and silently lost a project. `skip` offsets
 * the FILTERED result set, not the cursor row: Prisma emits `id >= cursorId`
 * and then `OFFSET 1`, so as soon as the cursor row itself stops matching this
 * where clause between two pages — depublished, archived, or its developer's
 * switch turned off while Xellex was paginating — the offset eats the first
 * genuinely new row instead of the cursor row. Measured against production
 * 2026-10-09 with an archived id standing in for "was on page N, is not any
 * more": the next three should have been ridge, olivea-residences and
 * agnades-village-1, and cursor+skip delivered olivea-residences,
 * agnades-village-1, cap-st-georges-resort — ridge gone, no error anywhere.
 * A deleted cursor row is worse still: `id >= cursorId` matches nothing, the
 * page comes back empty, the route reads that as complete=true and ends the
 * run early. Either way the consumer advances its watermark past rows it never
 * received, which is the same permanent silent loss the one-generatedAt-per-run
 * rule exists to prevent, arriving through a different door. The plain
 * comparison needs no cursor row to exist; verified identical over the whole
 * 7-page catalogue (350 of 350, same order) on the same date.
 */
export async function changedSince(
  since: Date | null,
  cursorId: string | null,
  limit: number,
): Promise<DevelopmentWithRelations[]> {
  return prisma.development.findMany({
    where: {
      publishStatus: "published",
      developerAccount: { bridgeEnabled: true },
      ...(cursorId ? { id: { gt: cursorId } } : {}),
      ...(since
        ? {
            OR: [
              { updatedAt: { gt: since } },
              { override: { updatedAt: { gt: since } } },
              { units: { some: { updatedAt: { gt: since } } } },
              // Re-enabled after `since`. The outer where already requires
              // bridgeEnabled: true, so this admits exactly "an enabled
              // developer whose switch was touched in this window" — the
              // mirror of removedSince()'s second source.
              { developerAccount: { bridgeChangedAt: { gt: since } } },
            ],
          }
        : {}),
    },
    include: BRIDGE_INCLUDE,
    orderBy: { id: "asc" },
    take: limit,
  });
}

/**
 * Ids that were deliverable and are not any more. TWO sources, and the second
 * is the one that gets forgotten.
 *
 * 1. A project whose own row changed after `since` and which no longer
 *    qualifies — depublished or archived.
 * 2. EVERY project of a developer whose switch was last touched after `since`
 *    and is now off.
 *
 * Without (2) the removal is invisible: flipping a developer's switch writes
 * nothing to its Development rows, their updatedAt stays old, no incremental
 * call ever mentions them, and they stay live on the second portal forever.
 * That is the failure this list exists to prevent, and it is why
 * DeveloperAccount carries bridgeChangedAt at all.
 *
 * The list may contain ids Xellex never received — a project depublished under
 * a developer that was never enabled, for instance. That is deliberate:
 * tracking what was actually delivered would need a per-consumer ledger, and
 * an unknown id is a no-op on the receiving side.
 */
export async function removedSince(since: Date): Promise<string[]> {
  const rows = await prisma.development.findMany({
    where: {
      OR: [
        { publishStatus: { not: "published" }, updatedAt: { gt: since } },
        { developerAccount: { bridgeEnabled: false, bridgeChangedAt: { gt: since } } },
      ],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
