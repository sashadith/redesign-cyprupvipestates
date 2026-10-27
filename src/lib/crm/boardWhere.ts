import type { Prisma } from "@prisma/client";
import { CONTACT_TYPES } from "@/lib/mcp/leadRow";
import { leadAccessWhere, type CrmUser } from "./access";
import { EXCLUDE_NEWSLETTER, EXCLUDE_PARTNER_ENQUIRY } from "./leadBucket";
import { FUNNEL_STATUSES, SIDE_STATUSES } from "./leadStatus";
import { CLOSED_WINDOW_DAYS, STALE_DAYS, type BoardFilter } from "./boardModel";

// Pure where-builder for the pipeline board; no DB access, unit-testable.
export function boardWhere(user: CrmUser, filter: BoardFilter, now: Date): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [
    leadAccessWhere(user),
    EXCLUDE_NEWSLETTER,
    EXCLUDE_PARTNER_ENQUIRY,
    // No owner condition: leadAccessWhere already limits restricted users to
    // their own leads, and those who see everyone also see unassigned leads.
    { deletedAt: null, status: { in: [...FUNNEL_STATUSES] } },
    // Closed leads only stay on the board for a while after they closed.
    { OR: [{ status: { not: "CLOSED" } }, { updatedAt: { gte: new Date(now.getTime() - CLOSED_WINDOW_DAYS * 86_400_000) } }] },
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

// Keep contact and Lost sit outside the funnel columns, listed under the board.
// Same scope as the board (access, newsletter, partner enquiries, "mine"); no
// time window, the newest updates come first and the page caps the rows.
export function sideWhere(user: CrmUser, filter: BoardFilter): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [
    leadAccessWhere(user),
    EXCLUDE_NEWSLETTER,
    EXCLUDE_PARTNER_ENQUIRY,
    { deletedAt: null, status: { in: [...SIDE_STATUSES] } },
  ];
  if (filter === "mine") and.push({ assignedToId: user.id });
  return { AND: and };
}
