import { prisma } from "@/lib/prisma";
import { CONTACT_TYPES } from "@/lib/mcp/leadRow";
import type { CrmUser } from "./access";
import { boardWhere } from "./boardWhere";
import { STALE_DAYS, type BoardFilter, type BoardLeadInput } from "./boardModel";

const BOARD_CAP = 1500;

export async function loadBoardLeads(user: CrmUser, filter: BoardFilter, now: Date): Promise<BoardLeadInput[]> {
  const rows = await prisma.lead.findMany({
    where: boardWhere(user, filter, now),
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
  // Guard only: the stale condition is already in the where (cap-safe).
  if (filter !== "stale") return leads;
  const cutoff = now.getTime() - STALE_DAYS * 86_400_000;
  return leads.filter((l) => (l.lastContactAt ?? l.createdAt).getTime() < cutoff && l.status !== "CLOSED");
}
