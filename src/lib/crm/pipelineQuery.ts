import type { Prisma } from "@prisma/client";
import { lastManualStatusChanges } from "./statusTouch";
import { prisma } from "@/lib/prisma";
import { CONTACT_TYPES } from "@/lib/mcp/leadRow";
import { canEditLead, type CrmUser } from "./access";
import { temperaturesFor } from "./insights/temperatureQuery";
import { toPublicTemperature } from "./insights/temperatureWiring";
import { boardWhere, sideWhere } from "./boardWhere";
import { STALE_DAYS, type BoardFilter, type BoardLeadInput } from "./boardModel";

export const BOARD_CAP = 1500;
// Keep contact + Lost lists under the board: newest updates first, together.
export const SIDE_CAP = 400;

const BOARD_SELECT = {
  id: true, firstName: true, lastName: true, status: true, source: true, languagePreference: true, createdAt: true, assignedToId: true,
  timeline: true, budgetMin: true, budgetMax: true, nextFollowUpAt: true, viewingScheduledAt: true,
  assignedTo: { select: { id: true, name: true } },
  projectInterest: { select: { title: true } },
  interactions: { where: { type: { in: CONTACT_TYPES } }, orderBy: { occurredAt: "desc" as const }, take: 1, select: { occurredAt: true } },
  deals: { select: { price: true, ourCommission: true, commissionStatus: true } },
} satisfies Prisma.LeadSelect;

type BoardRow = Prisma.LeadGetPayload<{ select: typeof BOARD_SELECT }>;

async function toInputs(user: CrmUser, rows: BoardRow[], now: Date): Promise<BoardLeadInput[]> {
  const [temps, moved] = await Promise.all([temperaturesFor(rows, now), lastManualStatusChanges(rows.map((r) => r.id))]);
  return rows.map((r) => ({
    id: r.id, firstName: r.firstName, lastName: r.lastName, status: r.status, source: r.source,
    languagePreference: r.languagePreference, assignedTo: r.assignedTo, createdAt: r.createdAt,
    projectLabel: r.projectInterest?.title ?? null,
    lastContactAt: r.interactions[0]?.occurredAt ?? null,
    deals: r.deals,
    canEdit: canEditLead(user, { assignedToId: r.assignedToId }),
    temperature: toPublicTemperature(temps.get(r.id)),
    nextFollowUpAt: r.nextFollowUpAt, viewingScheduledAt: r.viewingScheduledAt,
    lastStatusChangeAt: moved.get(r.id) ?? null,
  }));
}

// `total` is the true number of matching leads (same where, no cap), so the page
// can say when the board shows only the most recently updated BOARD_CAP of them.
export async function loadBoardLeads(user: CrmUser, filter: BoardFilter, now: Date): Promise<{ leads: BoardLeadInput[]; total: number }> {
  const where = boardWhere(user, filter, now);
  const [rows, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { updatedAt: "desc" }, take: BOARD_CAP, select: BOARD_SELECT }),
    prisma.lead.count({ where }),
  ]);
  const leads = await toInputs(user, rows, now);
  // Guard only: the stale condition is already in the where (cap-safe).
  if (filter !== "stale") return { leads, total };
  const cutoff = now.getTime() - STALE_DAYS * 86_400_000;
  return { leads: leads.filter((l) => (l.lastContactAt ?? l.createdAt).getTime() < cutoff && l.status !== "CLOSED"), total };
}

// Keep contact and Lost. Not loaded for the stale filter: stale is about the funnel.
export async function loadSideLeads(user: CrmUser, filter: BoardFilter, now: Date): Promise<{ leads: BoardLeadInput[]; total: number }> {
  // Keep contact and Lost are never marked: not loaded for the stale and "needs action" views.
  if (filter === "stale" || filter === "due") return { leads: [], total: 0 };
  const where = sideWhere(user, filter);
  const [rows, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { updatedAt: "desc" }, take: SIDE_CAP, select: BOARD_SELECT }),
    prisma.lead.count({ where }),
  ]);
  return { leads: await toInputs(user, rows, now), total };
}
