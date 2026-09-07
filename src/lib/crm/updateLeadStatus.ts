// The status transition (Phase 2 of the MCP connector) — extracted from
// admin/actions.ts's updateLeadStatus so the MCP crm_update_lead tool writes
// exactly the same two timeline rows the dropdown does (the Action Center
// reads metadata.toStatus from them, see actionCenter/rules/crm.ts).
import { prisma } from "@/lib/prisma";
import type { EmailActor } from "./sendLeadEmail";

export const LEAD_STATUSES = ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "KEEP_CONTACT", "CLOSED", "LOST"] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export function statusChangeContent(status: string): string {
  return `Status changed to ${status.replace(/_/g, " ")}`;
}

export async function applyLeadStatusChange(
  actor: EmailActor,
  leadId: string,
  status: LeadStatusValue,
  opts: { viewingScheduledAt?: Date | null; via?: "mcp" } = {},
): Promise<void> {
  if (!LEAD_STATUSES.includes(status)) throw new Error("Invalid status");
  await prisma.lead.update({
    where: { id: leadId },
    data: { status, ...(opts.viewingScheduledAt !== undefined ? { viewingScheduledAt: opts.viewingScheduledAt } : {}) },
  });
  const content = statusChangeContent(status);
  await prisma.leadActivity.create({
    data: { leadId, type: "STATUS_CHANGE", content, createdBy: actor.userName, createdById: actor.userId },
  });
  await prisma.leadInteraction.create({
    data: {
      leadId,
      type: "STATUS_CHANGE",
      channel: "SYSTEM",
      body: content,
      metadata: { toStatus: status, ...(opts.via ? { via: opts.via } : {}) },
      createdByUserId: actor.userId,
      createdByName: actor.userName,
    },
  });
}
