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
 * Paged by id rather than by any date: ids are stable and total-ordered, so a
 * row edited mid-pagination cannot jump between pages or be skipped. Page size
 * is a latency budget, not a payload one — 18.6 MB for all 350 projects is one
 * ordinary gzipped response, but assembling them means ~121,000 fs.stat calls,
 * and that belongs in seven requests rather than one held-open connection.
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
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
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
