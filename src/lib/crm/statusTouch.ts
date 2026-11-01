// The latest status change a person made on each lead (2026-11-01). Moving a lead
// to the next stage is work on it, so the urgency marks (boardModel.cardUrgency,
// Today) count it like a logged contact. Automatic changes (NEW → CONTACTED on a
// logged contact, guide leads parked in KEEP_CONTACT) carry no createdByUserId and
// do not count.
import { prisma } from "@/lib/prisma";

export async function lastManualStatusChanges(leadIds: string[]): Promise<Map<string, Date>> {
  if (leadIds.length === 0) return new Map();
  const rows = await prisma.leadInteraction.groupBy({
    by: ["leadId"],
    where: { leadId: { in: leadIds }, type: "STATUS_CHANGE", createdByUserId: { not: null } },
    _max: { occurredAt: true },
  });
  const out = new Map<string, Date>();
  for (const r of rows) if (r._max.occurredAt) out.set(r.leadId, r._max.occurredAt);
  return out;
}
