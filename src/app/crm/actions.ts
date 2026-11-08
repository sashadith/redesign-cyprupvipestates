"use server";
import { revalidatePath } from "next/cache";
import { effectiveRatesFor } from "@/lib/crm/rateLookup";
import { fmtRate } from "@/lib/crm/rateFormat";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { isLeadStatus, STATUS_LABEL, LOST_REASONS, type LostReasonValue } from "@/lib/crm/leadStatus";
import { assignLead } from "@/lib/crm/assignLead";
import { takeOverDownload, type TakeOverDownloadResult } from "@/lib/crm/downloads";
import type { AssignResult } from "@/lib/crm/assignMessage";
import { leadAccessWhere } from "@/lib/crm/access";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { leadSearchParts } from "@/lib/crm/leadSearch";
import { redirect } from "next/navigation";
import { trashLead, restoreLead } from "@/lib/crm/trashLead";
import { writeAudit } from "@/lib/crm/audit";
import { normalizeTrashReason, canTrashLead, canRestoreLead } from "@/lib/crm/trashView";
import { moveLead, type DealInput, type MoveResult } from "@/lib/crm/moveLead";
import { normalizeDealInput } from "@/lib/crm/dealInput";
import { addDeal, type AddDealResult } from "@/lib/crm/addDeal";

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
    const d = normalizeDealInput(input.deal);
    if ("error" in d) return { error: d.error, need: "deal" };
    deal = d.ok;
  }
  const lostReason = input.lostReason && (LOST_REASONS as readonly string[]).includes(input.lostReason) ? (input.lostReason as LostReasonValue) : undefined;
  const res = await moveLead(user, leadId, to, { deal, lostReason, confirmCancel: input.confirmCancel === true });
  if ("ok" in res) { revalidatePath("/crm/pipeline"); revalidatePath(`/crm/leads/${leadId}`); }
  return res;
}

export type DealOption = { id: string; label: string; value: string; hint?: string; developer?: { id: string; name: string; rate: string } };

/** Published projects for the deal form, optionally only one developer's; the label carries the rate on file. */
export async function searchDevelopmentsAction(q: string, developerAccountId?: string | null): Promise<DealOption[]> {
  await requireCrmUser();
  const term = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const acc = typeof developerAccountId === "string" && developerAccountId.length <= 64 ? developerAccountId : null;
  const rows = await prisma.development.findMany({
    where: { publishStatus: "published", ...(acc ? { developerAccountId: acc } : {}), ...(term ? { publicName: { contains: term, mode: "insensitive" } } : {}) },
    orderBy: { publicName: "asc" },
    take: 20,
    select: { id: true, publicName: true, town: true, developerAccountId: true, developerAccount: { select: { name: true, commissionRates: { where: { developmentId: null }, select: { ratePercent: true }, take: 1 } } } },
  });
  // The rate the deal will be created with, so it is visible before saving (2026-10-24).
  const rates = await effectiveRatesFor(rows);
  return rows.map((r) => {
    const rate = rates.get(r.id);
    const pct = rate?.ratePercent != null ? fmtRate(rate.ratePercent) : "no rate";
    return { id: r.id, value: r.publicName, label: r.town ? `${r.publicName} · ${r.town}` : r.publicName, hint: acc ? pct : `${r.developerAccount.name} · ${pct}`, developer: { id: r.developerAccountId, name: r.developerAccount.name, rate: r.developerAccount.commissionRates[0] ? fmtRate(r.developerAccount.commissionRates[0].ratePercent.toNumber()) : "no rate" } };
  });
}

/** Our developer accounts for the deal form, with the default rate on file. */
export async function searchDevelopersAction(q: string): Promise<DealOption[]> {
  await requireCrmUser();
  const term = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const rows = await prisma.developerAccount.findMany({
    where: term ? { name: { contains: term, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, commissionRates: { where: { developmentId: null }, select: { ratePercent: true }, take: 1 } },
  });
  return rows.map((r) => {
    const rate = r.commissionRates[0]?.ratePercent;
    return { id: r.id, value: r.name, label: r.name, hint: rate != null ? fmtRate(rate.toNumber()) : "no rate" };
  });
}

/** Names typed on earlier deals, so the same developer or project is not spelled two ways. */
export async function typedDealNamesAction(kind: "developer" | "project", q: string): Promise<string[]> {
  await requireCrmUser();
  const term = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const match = term ? { contains: term, mode: "insensitive" as const } : { not: null };
  if (kind === "developer") {
    const rows = await prisma.deal.findMany({ where: { developerName: match }, select: { developerName: true }, distinct: ["developerName"], orderBy: { developerName: "asc" }, take: 8 });
    return rows.map((r) => r.developerName).filter((v): v is string => !!v);
  }
  const rows = await prisma.deal.findMany({ where: { projectName: match }, select: { projectName: true }, distinct: ["projectName"], orderBy: { projectName: "asc" }, take: 8 });
  return rows.map((r) => r.projectName).filter((v): v is string => !!v);
}

/** Cockpit "New deal": admins and the lead's owner; optionally moves the lead to Reserved. */
export async function addDealAction(leadId: string, rawDeal: unknown, moveToReserved: boolean): Promise<AddDealResult> {
  const user = await requireCrmUser();
  if (typeof leadId !== "string" || !leadId || leadId.length > 64) return { error: "Lead not found." };
  const d = normalizeDealInput(rawDeal);
  if ("error" in d) return d;
  const res = await addDeal(user, leadId, d.ok, moveToReserved === true);
  if ("ok" in res) { revalidatePath(`/crm/leads/${leadId}`); revalidatePath("/crm/pipeline"); revalidatePath("/crm/commissions"); }
  return res;
}

export async function assignLeadAction(leadId: string, userId: string): Promise<AssignResult> {
  const user = await requireCrmUser();
  const res = await assignLead(user, leadId, userId);
  if ("ok" in res) { revalidatePath("/crm/inbox"); revalidatePath("/crm/pipeline"); revalidatePath(`/crm/leads/${leadId}`); }
  return res;
}

export async function takeOverDownloadAction(leadId: string): Promise<TakeOverDownloadResult> {
  const user = await requireCrmUser();
  if (typeof leadId !== "string" || !leadId || leadId.length > 64) return { error: "Lead not found." };
  const res = await takeOverDownload(user, leadId);
  if ("ok" in res) { revalidatePath("/crm/inbox"); revalidatePath(`/crm/leads/${leadId}`); }
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
    ? await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, assignedToId: true, workedByPartner: true } })
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
