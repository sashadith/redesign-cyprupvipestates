// The status transition (Phase 2 of the MCP connector) — extracted from
// admin/actions.ts's updateLeadStatus so the MCP crm_update_lead tool writes
// exactly the same two timeline rows the dropdown does (the Action Center
// reads metadata.toStatus from them, see actionCenter/rules/crm.ts).
import { prisma } from "@/lib/prisma";
import type { EmailActor } from "./sendLeadEmail";

export { LEAD_STATUSES, type LeadStatusValue } from "@/lib/crm/leadStatus";
import { LEAD_STATUSES, type LeadStatusValue, type LostReasonValue } from "@/lib/crm/leadStatus";

// Pure: the lostReason part of the lead update for a status change.
export function lostReasonUpdate(
  status: LeadStatusValue,
  lostReason: LostReasonValue | null | undefined,
): { lostReason: LostReasonValue | null } | Record<string, never> {
  if (status !== "LOST") {
    if (lostReason) throw new Error("lostReason is only allowed with status LOST");
    return { lostReason: null };
  }
  return lostReason === undefined ? {} : { lostReason };
}

// Pure: a reason sent with status LOST on a lead that is ALREADY LOST has no
// status change to ride on; it is stored as a plain lead update instead.
export function standaloneLostReason(
  currentStatus: string,
  inputStatus: LeadStatusValue | undefined,
  lostReason: LostReasonValue | undefined,
): LostReasonValue | undefined {
  return lostReason && inputStatus === "LOST" && inputStatus === currentStatus ? lostReason : undefined;
}

export function statusChangeContent(status: string): string {
  return `Status changed to ${status.replace(/_/g, " ")}`;
}

export async function applyLeadStatusChange(
  actor: EmailActor,
  leadId: string,
  status: LeadStatusValue,
  opts: { viewingScheduledAt?: Date | null; via?: "mcp"; lostReason?: LostReasonValue | null } = {},
): Promise<void> {
  if (!LEAD_STATUSES.includes(status)) throw new Error("Invalid status");
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status,
      ...(opts.viewingScheduledAt !== undefined ? { viewingScheduledAt: opts.viewingScheduledAt } : {}),
      ...lostReasonUpdate(status, opts.lostReason),
    },
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
      metadata: { toStatus: status, ...(opts.lostReason ? { lostReason: opts.lostReason } : {}), ...(opts.via ? { via: opts.via } : {}) },
      createdByUserId: actor.userId,
      createdByName: actor.userName,
    },
  });
}
