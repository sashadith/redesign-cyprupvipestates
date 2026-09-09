// Soft delete ("Move to trash") and restore — extracted from admin/actions.ts's
// softDeleteLeadAction/restoreLeadAction, which now call this, so the MCP
// connector's crm_delete_lead/crm_restore_lead write the same rows: the
// deletedAt/deletedById stamp, a DELETED/RESTORED activity row and a SYSTEM
// timeline row. Trash is restorable for 90 days (cron/publish-scheduled's
// purge step); the truly irreversible permanentlyDeleteLeadAction stays
// ADMIN-only in the admin and is deliberately not reachable from here.
import { prisma } from "@/lib/prisma";
import type { EmailActor } from "./sendLeadEmail";

export async function trashLead(actor: EmailActor, leadId: string, opts: { reason?: string | null; via?: "mcp" } = {}): Promise<void> {
  const reason = opts.reason?.trim() || null;
  const body = `${opts.via === "mcp" ? "Lead moved to trash by Claude" : "Lead moved to trash"}${reason ? ` — ${reason}` : ""}`;
  await prisma.lead.update({ where: { id: leadId }, data: { deletedAt: new Date(), deletedById: actor.userId } });
  await prisma.leadActivity.create({
    data: { leadId, type: "DELETED", content: body, createdBy: actor.userName, createdById: actor.userId },
  });
  await prisma.leadInteraction.create({
    data: {
      leadId,
      type: "SYSTEM",
      channel: "SYSTEM",
      body,
      createdByUserId: actor.userId,
      createdByName: actor.userName,
      ...(opts.via ? { metadata: { via: opts.via, ...(reason ? { reason } : {}) } } : {}),
    },
  });
}

export async function restoreLead(actor: EmailActor, leadId: string, opts: { via?: "mcp" } = {}): Promise<void> {
  const body = opts.via === "mcp" ? "Lead restored from trash by Claude" : "Lead restored from trash";
  await prisma.lead.update({ where: { id: leadId }, data: { deletedAt: null, deletedById: null } });
  await prisma.leadActivity.create({
    data: { leadId, type: "RESTORED", content: body, createdBy: actor.userName, createdById: actor.userId },
  });
  await prisma.leadInteraction.create({
    data: {
      leadId,
      type: "SYSTEM",
      channel: "SYSTEM",
      body,
      createdByUserId: actor.userId,
      createdByName: actor.userName,
      ...(opts.via ? { metadata: { via: opts.via } } : {}),
    },
  });
}
