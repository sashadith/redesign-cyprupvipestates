import type { Prisma } from "@prisma/client";
import { CONTACT_TYPES } from "@/lib/mcp/leadRow";
import { leadAccessWhere, type CrmUser } from "./access";
import { EXCLUDE_NEWSLETTER } from "./leadBucket";
import { FUNNEL_STATUSES } from "./leadStatus";
import { STALE_DAYS, type BoardFilter } from "./boardModel";

// Pure where-builder for the pipeline board; no DB access, unit-testable.
export function boardWhere(user: CrmUser, filter: BoardFilter, now: Date): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [
    leadAccessWhere(user),
    EXCLUDE_NEWSLETTER,
    { deletedAt: null, assignedToId: { not: null }, status: { in: [...FUNNEL_STATUSES] } },
  ];
  if (filter === "mine") and.push({ assignedToId: user.id });
  if (filter === "stale") {
    const cutoff = new Date(now.getTime() - STALE_DAYS * 86_400_000);
    and.push({
      status: { not: "CLOSED" },
      createdAt: { lt: cutoff },
      interactions: { none: { type: { in: CONTACT_TYPES }, occurredAt: { gte: cutoff } } },
    });
  }
  return { AND: and };
}
