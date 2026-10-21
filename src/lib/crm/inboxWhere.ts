import type { Prisma } from "@prisma/client";
import { EXCLUDE_NEWSLETTER } from "./leadBucket";
import { ACTIVE_LEAD_STATUSES } from "./leadStatus";

// The one definition of "inbox work" (CRM v2): the nav badge and the inbox page
// both count through this, so they can never disagree. Closed, lost and
// keep-contact leads without an owner are not work waiting to be handed out.
export function inboxWhere(): Prisma.LeadWhereInput {
  return { AND: [EXCLUDE_NEWSLETTER, { deletedAt: null, assignedToId: null, status: { in: [...ACTIVE_LEAD_STATUSES] } }] };
}
