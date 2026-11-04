"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads, canEditLead, canViewLead } from "@/lib/crm/access";
import { contactToCheck, createLeadRecord, findDuplicateLead } from "@/lib/crm/createLead";
import { decideOwner, validateNewLead } from "@/lib/crm/newLeadForm";
import { changedFields, changeSummary, validateLeadEdit } from "@/lib/crm/editLead";
import { assignLead } from "@/lib/crm/assignLead";
import { logLeadInteraction } from "@/lib/crm/logInteraction";
import { LogInteractionInput } from "@/lib/mcp/tools/logInteractionInput";
import { makeLimiter } from "@/lib/crm/ai/rateLimit";
import { summariseLead, type SummaryResult } from "@/lib/crm/ai/summary";
import { DEFAULT_SUMMARY_LOCALE, isSummaryLocale } from "@/lib/crm/summaryLocale";
import { INTAKE_MAX, INTAKE_MIN, intakeFromText, type IntakeResult } from "@/lib/crm/ai/intake";
import { followUpLabel, resolveFollowUp, type FollowUpInput } from "@/lib/crm/followUp";

// Lead cockpit writes (CRM v2, 2026-10-18). Same validation as the MCP tool
// crm_log_interaction; the lead id comes from the page, never from the form.

// A few minutes of slack for a clock that runs ahead of the server's.
const FUTURE_SLACK_MS = 5 * 60_000;

export async function logInteractionAction(leadId: string, raw: unknown): Promise<{ ok: true } | { error: string }> {
  const user = await requireCrmUser();
  const parsed = LogInteractionInput.safeParse({ ...(raw && typeof raw === "object" ? raw : {}), leadId });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid entry." };
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { assignedToId: true } });
  if (!lead || !canEditLead(user, lead)) return { error: "Lead not found." };
  const { type, body, subject, occurredAt, leadReacted } = parsed.data;
  const when = occurredAt ? new Date(occurredAt) : undefined;
  if (when && when.getTime() > Date.now() + FUTURE_SLACK_MS) return { error: "The date cannot be in the future." };
  await logLeadInteraction({ userId: user.id, userName: user.name }, leadId, { type, body, subject, occurredAt: when, leadReacted });
  revalidatePath(`/crm/leads/${leadId}`);
  // A logged contact changes the board card's age / stale flag.
  revalidatePath("/crm/pipeline");
  return { ok: true };
}

export type CreateLeadResult =
  | { ok: true; id: string; assignWarning?: string }
  | { error: string; field?: string }
  | { duplicate: { id: string | null; name: string | null; matchedOn: "email" | "phone" } };

// New lead from the new CRM (Phase 2c). Managers may pick the owner (or leave the
// lead unassigned for the inbox); everyone else always owns what they create.
export async function createLeadAction(raw: unknown): Promise<CreateLeadResult> {
  const user = await requireCrmUser();
  const parsed = validateNewLead(raw);
  if (!parsed.ok) return { error: parsed.error, ...(parsed.field ? { field: parsed.field } : {}) };
  const { ownerId, ...data } = parsed.data;

  const isManager = canAssignLeads(user);
  let requested: string | null = null;
  if (isManager && ownerId) {
    const staff = await prisma.user.findFirst({ where: { id: ownerId, isActive: true }, select: { id: true } });
    if (!staff) return { error: "That person is not an active team member.", field: "ownerId" };
    requested = staff.id;
  }
  const { createWith, assignTo } = decideOwner({ isManager, creatorId: user.id, requestedOwnerId: requested });

  const dup = await findDuplicateLead(data.email, data.phone);
  if (dup) {
    const row = await prisma.lead.findUnique({ where: { id: dup.id }, select: { assignedToId: true } });
    const visible = !!row && canViewLead(user, row);
    return { duplicate: { id: visible ? dup.id : null, name: visible ? `${dup.firstName} ${dup.lastName}`.trim() : null, matchedOn: dup.matchedOn } };
  }

  const { id } = await createLeadRecord({ userId: user.id, userName: user.name }, { ...data, assignedToId: createWith });
  // The lead exists either way: a failed hand-over is a warning, not an error.
  let assignWarning: string | undefined;
  if (assignTo) {
    try {
      const res = await assignLead(user, id, assignTo);
      if ("error" in res) assignWarning = res.error;
    } catch (e) {
      console.error("[crm new lead assign]", e);
      assignWarning = "Could not assign the owner — assign it from the lead page.";
    }
  }
  revalidatePath("/crm/pipeline");
  revalidatePath("/crm/inbox");
  return { ok: true, id, ...(assignWarning ? { assignWarning } : {}) };
}

export type UpdateLeadResult =
  | { ok: true; changed: string }
  | { error: string; field?: string }
  | { duplicate: { id: string | null; name: string | null; matchedOn: "email" | "phone" } };

// "Edit" on the lead cockpit (2026-10-28): anyone who may work the lead may
// correct its details. The owner is changed with "Assign", never here. A new
// email or phone that already belongs to another lead is refused, as on create.
export async function updateLeadDetailsAction(leadId: string, raw: unknown): Promise<UpdateLeadResult> {
  const user = await requireCrmUser();
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: {
      assignedToId: true, firstName: true, lastName: true, email: true, phone: true, salutation: true, languagePreference: true,
      budgetMin: true, budgetMax: true, timeline: true, financing: true, nationality: true, countryOfResidence: true, message: true, notes: true,
    },
  });
  if (!lead || !canEditLead(user, lead)) return { error: "Lead not found." };
  const parsed = validateLeadEdit(raw, lead.languagePreference);
  if (!parsed.ok) return { error: parsed.error, ...(parsed.field ? { field: parsed.field } : {}) };
  const data = parsed.data;
  const { assignedToId: _owner, ...before } = lead;
  const fields = changedFields(before, data);
  if (fields.length === 0) return { ok: true, changed: "" };

  const check = contactToCheck(lead, data);
  if (check.email || check.phone) {
    const dup = await findDuplicateLead(check.email, check.phone);
    if (dup && dup.id !== leadId) {
      const row = await prisma.lead.findUnique({ where: { id: dup.id }, select: { assignedToId: true } });
      const visible = !!row && canViewLead(user, row);
      return { duplicate: { id: visible ? dup.id : null, name: visible ? `${dup.firstName} ${dup.lastName}`.trim() : null, matchedOn: dup.matchedOn } };
    }
  }

  const changed = changeSummary(fields);
  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { ...data, lastName: data.lastName ?? "" } }),
    prisma.leadActivity.create({ data: { leadId, type: "EDIT", content: `Lead details edited: ${changed}`, createdBy: user.name, createdById: user.id } }),
    prisma.leadInteraction.create({
      data: {
        leadId, type: "SYSTEM", channel: "SYSTEM", body: `Lead details edited: ${changed}`,
        createdByUserId: user.id, createdByName: user.name, metadata: { kind: "lead_edit", fields },
      },
    }),
  ]);
  revalidatePath(`/crm/leads/${leadId}`);
  // Name and budget show on the board card.
  revalidatePath("/crm/pipeline");
  return { ok: true, changed };
}

// Claude helpers (Phase 2c). Both are read-only: the summary is only shown, the
// intake only prefills the form. 10 calls a minute per user, per feature.
const summaryLimiter = makeLimiter(10, 60_000);
const intakeLimiter = makeLimiter(10, 60_000);
const SLOW_DOWN = "Too many Claude requests — wait a minute and try again.";

// The picked language is remembered per user (User.crmSummaryLocale), so the
// cockpit opens with it next time. A save failure never blocks the summary.
export async function setSummaryLocaleAction(locale: string): Promise<{ ok: boolean }> {
  const user = await requireCrmUser();
  if (!isSummaryLocale(locale)) return { ok: false };
  try {
    await prisma.user.update({ where: { id: user.id }, data: { crmSummaryLocale: locale } });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function summariseLeadAction(leadId: string, locale?: string): Promise<SummaryResult> {
  const user = await requireCrmUser();
  if (typeof leadId !== "string" || !leadId || leadId.length > 64) return { ok: false, error: "Lead not found." };
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { assignedToId: true } });
  if (!lead || !canViewLead(user, lead)) return { ok: false, error: "Lead not found." };
  if (!summaryLimiter(user.id)) return { ok: false, error: SLOW_DOWN };
  return summariseLead(leadId, isSummaryLocale(locale) ? locale : DEFAULT_SUMMARY_LOCALE);
}

export async function intakeFromTextAction(text: string): Promise<IntakeResult> {
  const user = await requireCrmUser();
  if (typeof text !== "string") return { ok: false, error: "Paste the text first." };
  // Length errors come from intakeFromText without spending a slot.
  const len = text.trim().length;
  if (len < INTAKE_MIN || len > INTAKE_MAX) return intakeFromText(text);
  if (!intakeLimiter(user.id)) return { ok: false, error: SLOW_DOWN };
  return intakeFromText(text);
}

// Next follow-up set by hand in the cockpit (2026-11-01): a free date, a shortcut
// (+1 / +3 / +7 days) or cleared. Logged on the timeline as a SYSTEM row.
export async function setFollowUpAction(leadId: string, input: FollowUpInput): Promise<{ ok: true; at: string | null } | { error: string }> {
  const user = await requireCrmUser();
  if (typeof leadId !== "string" || !leadId || leadId.length > 64) return { error: "Lead not found." };
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { assignedToId: true } });
  if (!lead || !canEditLead(user, lead)) return { error: "Lead not found." };
  const r = resolveFollowUp(input && typeof input === "object" ? input : {}, new Date());
  if (!r.ok) return { error: r.error };
  const body = r.at ? `Next follow-up set to ${followUpLabel(r.at)}` : "Next follow-up cleared";
  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: r.at } }),
    prisma.leadInteraction.create({
      data: {
        leadId, type: "SYSTEM", channel: "SYSTEM", direction: null, body,
        createdByUserId: user.id, createdByName: user.name,
        metadata: { kind: "follow_up", nextFollowUpAt: r.at ? r.at.toISOString() : null },
      },
    }),
  ]);
  revalidatePath(`/crm/leads/${leadId}`);
  revalidatePath("/crm/pipeline");
  revalidatePath("/crm/today");
  return { ok: true, at: r.at ? r.at.toISOString() : null };
}
