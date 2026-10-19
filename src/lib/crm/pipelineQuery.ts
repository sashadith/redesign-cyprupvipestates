import { prisma } from "@/lib/prisma";
import { CONTACT_TYPES } from "@/lib/mcp/leadRow";
import { canEditLead, type CrmUser } from "./access";
import { temperaturesFor } from "./insights/temperatureQuery";
import { toPublicTemperature } from "./insights/temperatureWiring";
import { boardWhere } from "./boardWhere";
import { STALE_DAYS, type BoardFilter, type BoardLeadInput } from "./boardModel";

export const BOARD_CAP = 1500;

// `total` is the true number of matching leads (same where, no cap), so the page
// can say when the board shows only the most recently updated BOARD_CAP of them.
export async function loadBoardLeads(user: CrmUser, filter: BoardFilter, now: Date): Promise<{ leads: BoardLeadInput[]; total: number }> {
  const where = boardWhere(user, filter, now);
  const [rows, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: BOARD_CAP,
      select: {
        id: true, firstName: true, lastName: true, status: true, source: true, languagePreference: true, createdAt: true, assignedToId: true,
        timeline: true, budgetMin: true, budgetMax: true,
        assignedTo: { select: { id: true, name: true } },
        projectInterest: { select: { title: true } },
        interactions: { where: { type: { in: CONTACT_TYPES } }, orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
        deals: { select: { price: true, ourCommission: true, commissionStatus: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);
  const temps = await temperaturesFor(rows, now);
  const leads: BoardLeadInput[] = rows.map((r) => ({
    id: r.id, firstName: r.firstName, lastName: r.lastName, status: r.status, source: r.source,
    languagePreference: r.languagePreference, assignedTo: r.assignedTo, createdAt: r.createdAt,
    projectLabel: r.projectInterest?.title ?? null,
    lastContactAt: r.interactions[0]?.occurredAt ?? null,
    deals: r.deals,
    canEdit: canEditLead(user, { assignedToId: r.assignedToId }),
    temperature: toPublicTemperature(temps.get(r.id)),
  }));
  // Guard only: the stale condition is already in the where (cap-safe).
  if (filter !== "stale") return { leads, total };
  const cutoff = now.getTime() - STALE_DAYS * 86_400_000;
  return { leads: leads.filter((l) => (l.lastContactAt ?? l.createdAt).getTime() < cutoff && l.status !== "CLOSED"), total };
}
