import { prisma } from "@/lib/prisma";
import type { CrmUser } from "@/lib/crm/access";
import { canAssignLeads } from "@/lib/crm/access";
import { assignLead } from "@/lib/crm/assignLead";
import { moveLeadBucket } from "@/lib/crm/moveBucket";
import type { LeadBucket } from "@/lib/crm/leadBucket";
import type { McpCallContext } from "../context";
import { ToolError } from "../toolWrapper";

// Owner and bucket changes for crm_update_lead (2026-11-04). Both reuse the CRM's own writers, so the
// timeline row (and, for an assignment, the Telegram/email to the new owner) is exactly what the
// cockpit produces. Each returns whether anything changed.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The new owner, checked before crm_update_lead writes anything: a bad name must not leave a half-applied update. */
export async function resolveOwner(user: CrmUser, value: string | null): Promise<{ id: string; name: string } | null> {
  if (!canAssignLeads(user)) throw new ToolError("unauthorized", "Only admins can assign leads.");
  return value === null ? null : resolveEmployee(value);
}

async function resolveEmployee(value: string): Promise<{ id: string; name: string }> {
  const where = UUID.test(value) ? { id: value } : { name: { equals: value, mode: "insensitive" as const } };
  const rows = await prisma.user.findMany({ where: { ...where, isActive: true }, select: { id: true, name: true }, take: 2 });
  if (rows.length === 1) return rows[0];
  const team = await prisma.user.findMany({ where: { isActive: true }, select: { name: true }, orderBy: { name: "asc" } });
  const names = team.map((u) => u.name).join(", ");
  throw new ToolError("validation", rows.length ? `"${value}" matches more than one employee; pass the user id.` : `No active employee called "${value}". Active: ${names}.`);
}

export async function assignOwnerViaMcp(
  user: CrmUser, c: McpCallContext, lead: { id: string; assignedToId: string | null }, owner: { id: string; name: string } | null,
): Promise<boolean> {
  if (owner === null) {
    if (!lead.assignedToId) return false;
    const { count } = await prisma.lead.updateMany({ where: { id: lead.id, assignedToId: lead.assignedToId }, data: { assignedToId: null } });
    if (!count) throw new ToolError("validation", "Someone else changed the owner a moment ago; read the lead again.");
    await prisma.leadInteraction.create({
      data: {
        leadId: lead.id, type: "SYSTEM", channel: "SYSTEM", body: "Owner removed",
        metadata: { assignedToId: null, assignedById: c.userId, via: "mcp" },
        createdByUserId: c.userId, createdByName: c.userName,
      },
    });
    return true;
  }
  if (owner.id === lead.assignedToId) return false;
  const me = await prisma.user.findUniqueOrThrow({ where: { id: c.userId }, select: { name: true, email: true } });
  const r = await assignLead({ ...user, name: me.name, email: me.email }, lead.id, owner.id);
  if ("error" in r) throw new ToolError("validation", r.error);
  return r.changed;
}

export async function moveBucketViaMcp(c: McpCallContext, leadId: string, bucket: LeadBucket): Promise<boolean> {
  return moveLeadBucket(leadId, bucket, { id: c.userId, name: c.userName });
}
