import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { CONTACT_TYPES } from "@/lib/mcp/leadRow";
import { leadAccessWhere, type CrmUser } from "./access";
import { EXCLUDE_NEWSLETTER } from "./leadBucket";
import { FUNNEL_STATUSES } from "./leadStatus";
import { STALE_DAYS, type BoardFilter, type BoardLeadInput } from "./boardModel";

const BOARD_CAP = 1500;

export async function loadBoardLeads(user: CrmUser, filter: BoardFilter, now: Date): Promise<BoardLeadInput[]> {
  const and: Prisma.LeadWhereInput[] = [
    leadAccessWhere(user),
    EXCLUDE_NEWSLETTER,
    { deletedAt: null, assignedToId: { not: null }, status: { in: [...FUNNEL_STATUSES] } },
  ];
  if (filter === "mine") and.push({ assignedToId: user.id });
  const rows = await prisma.lead.findMany({
    where: { AND: and },
    orderBy: { updatedAt: "desc" },
    take: BOARD_CAP,
    select: {
      id: true, firstName: true, lastName: true, status: true, source: true, languagePreference: true, createdAt: true,
      assignedTo: { select: { id: true, name: true } },
      projectInterest: { select: { title: true } },
      interactions: { where: { type: { in: CONTACT_TYPES } }, orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
      deals: { select: { price: true, ourCommission: true, commissionStatus: true } },
    },
  });
  const leads: BoardLeadInput[] = rows.map((r) => ({
    id: r.id, firstName: r.firstName, lastName: r.lastName, status: r.status, source: r.source,
    languagePreference: r.languagePreference, assignedTo: r.assignedTo, createdAt: r.createdAt,
    projectLabel: r.projectInterest?.title ?? null,
    lastContactAt: r.interactions[0]?.occurredAt ?? null,
    deals: r.deals,
  }));
  if (filter !== "stale") return leads;
  const cutoff = now.getTime() - STALE_DAYS * 86_400_000;
  return leads.filter((l) => (l.lastContactAt ?? l.createdAt).getTime() < cutoff && l.status !== "CLOSED");
}
