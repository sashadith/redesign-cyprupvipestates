"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { isLeadStatus, STATUS_LABEL, LOST_REASONS, type LostReasonValue } from "@/lib/crm/leadStatus";
import { assignLead } from "@/lib/crm/assignLead";
import type { AssignResult } from "@/lib/crm/assignMessage";
import { leadAccessWhere } from "@/lib/crm/access";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { leadSearchParts } from "@/lib/crm/leadSearch";
import { redirect } from "next/navigation";
import { trashLead, restoreLead } from "@/lib/crm/trashLead";
import { writeAudit } from "@/lib/crm/audit";
import { normalizeTrashReason, canTrashLead, canRestoreLead } from "@/lib/crm/trashView";
import { moveLead, type DealInput, type MoveResult } from "@/lib/crm/moveLead";

export async function moveLeadAction(
  leadId: string,
  to: string,
  rawInput: { deal?: DealInput; lostReason?: string; confirmCancel?: boolean } | null = {},
): Promise<MoveResult> {
  const user = await requireCrmUser();
  if (!isLeadStatus(to)) return { error: "Unknown stage." };
  const input = rawInput ?? {};
  let deal: DealInput | undefined;
  if (input.deal != null) {
    const d = input.deal as Partial<DealInput>;
    const label = d.unitLabel == null ? null : typeof d.unitLabel === "string" ? d.unitLabel.trim() : undefined;
    if (
      typeof d.developmentId !== "string" || !d.developmentId || d.developmentId.length > 64 ||
      label === undefined || (label !== null && label.length > 40) ||
      typeof d.price !== "number" || !Number.isInteger(d.price)
    ) {
      return { error: "Enter the deal: project, unit and price.", need: "deal" };
    }
    deal = { developmentId: d.developmentId, unitLabel: label || null, price: d.price };
  }
  const lostReason = input.lostReason && (LOST_REASONS as readonly string[]).includes(input.lostReason) ? (input.lostReason as LostReasonValue) : undefined;
  const res = await moveLead(user, leadId, to, { deal, lostReason, confirmCancel: input.confirmCancel === true });
  if ("ok" in res) { revalidatePath("/crm/pipeline"); revalidatePath(`/crm/leads/${leadId}`); }
  return res;
}

export async function searchDevelopmentsAction(q: string): Promise<{ id: string; label: string }[]> {
  await requireCrmUser();
  const term = q.trim();
  const rows = await prisma.development.findMany({
    where: { publishStatus: "published", ...(term ? { publicName: { contains: term, mode: "insensitive" } } : {}) },
    orderBy: { publicName: "asc" },
    take: 20,
    select: { id: true, publicName: true, town: true },
  });
  return rows.map((r) => ({ id: r.id, label: r.town ? `${r.publicName} · ${r.town}` : r.publicName }));
}

export async function assignLeadAction(leadId: string, userId: string): Promise<AssignResult> {
  const user = await requireCrmUser();
  const res = await assignLead(user, leadId, userId);
  if ("ok" in res) { revalidatePath("/crm/inbox"); revalidatePath("/crm/pipeline"); revalidatePath(`/crm/leads/${leadId}`); }
  return res;
}

export type LeadHit = { id: string; name: string; status: string; statusLabel: string; sub: string };

// ⌘K search. Everything sits under one AND with the access scope, so ids found by the raw
// digit match can never widen what the user may see.
export async function searchLeadsAction(q: string): Promise<LeadHit[]> {
  const user = await requireCrmUser();
  const parts = leadSearchParts(typeof q === "string" ? q.slice(0, 100) : "");
  if (!parts) return [];
  let ids: string[] = [];
  if (parts.digits) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM leads WHERE phone IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${`%${parts.digits}%`}`;
    ids = rows.map((r) => r.id);
  }
  const rows = await prisma.lead.findMany({
    where: {
      AND: [
        leadAccessWhere(user),
        EXCLUDE_NEWSLETTER,
        { deletedAt: null },
        { OR: [parts.text, ...(ids.length ? [{ id: { in: ids } }] : [])] },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return rows.map((r) => ({
    id: r.id,
    name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "(no name)",
    status: r.status,
    statusLabel: isLeadStatus(r.status) ? STATUS_LABEL[r.status] : r.status,
    sub: r.email ?? r.phone ?? "",
  }));
}

// Move to trash (new CRM). Returns only on failure: success redirects to the pipeline.
export async function trashLeadAction(leadId: string, reason: string | null): Promise<{ error: string }> {
  const user = await requireCrmUser();
  const r = normalizeTrashReason(reason);
  if (!r.ok) return { error: r.error };
  const lead = typeof leadId === "string" && leadId
    ? await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, assignedToId: true } })
    : null;
  const ok = canTrashLead(user, lead);
  if (!ok.allowed || !lead) return { error: ok.allowed ? "Lead not found." : ok.error };
  await trashLead({ userId: user.id, userName: user.name }, lead.id, { reason: r.reason });
  await writeAudit(user, "crm_lead_trash", "Lead", lead.id, r.reason ? { reason: r.reason } : undefined);
  revalidatePath("/crm/pipeline"); revalidatePath("/crm/inbox"); revalidatePath("/crm/today"); revalidatePath("/crm/trash");
  redirect("/crm/pipeline?trashed=1");
}

export async function restoreLeadAction(leadId: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireCrmUser();
  const ok = canRestoreLead(user);
  if (!ok.allowed) return { error: ok.error };
  const lead = typeof leadId === "string" && leadId
    ? await prisma.lead.findFirst({ where: { id: leadId, deletedAt: { not: null } }, select: { id: true } })
    : null;
  if (!lead) return { error: "Lead is not in the trash." };
  await restoreLead({ userId: user.id, userName: user.name }, lead.id);
  await writeAudit(user, "crm_lead_restore", "Lead", lead.id);
  revalidatePath("/crm/pipeline"); revalidatePath("/crm/inbox"); revalidatePath("/crm/today"); revalidatePath("/crm/trash");
  return { ok: true };
}
