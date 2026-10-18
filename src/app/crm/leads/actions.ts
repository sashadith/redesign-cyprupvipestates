"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads, canEditLead, canViewLead } from "@/lib/crm/access";
import { createLeadRecord, findDuplicateLead } from "@/lib/crm/createLead";
import { validateNewLead } from "@/lib/crm/newLeadForm";
import { logLeadInteraction } from "@/lib/crm/logInteraction";
import { LogInteractionInput } from "@/lib/mcp/tools/logInteractionInput";
import { makeLimiter } from "@/lib/crm/ai/rateLimit";
import { summariseLead, type SummaryResult } from "@/lib/crm/ai/summary";
import { INTAKE_MAX, INTAKE_MIN, intakeFromText, type IntakeResult } from "@/lib/crm/ai/intake";

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
  | { ok: true; id: string }
  | { error: string; field?: string }
  | { duplicate: { id: string | null; name: string | null; matchedOn: "email" | "phone" } };

// New lead from the new CRM (Phase 2c). Managers may pick the owner (or leave the
// lead unassigned for the inbox); everyone else always owns what they create.
export async function createLeadAction(raw: unknown): Promise<CreateLeadResult> {
  const user = await requireCrmUser();
  const parsed = validateNewLead(raw);
  if (!parsed.ok) return { error: parsed.error, ...(parsed.field ? { field: parsed.field } : {}) };
  const { ownerId, ...data } = parsed.data;

  let owner: string | null = user.id;
  if (canAssignLeads(user)) {
    owner = null;
    if (ownerId) {
      const staff = await prisma.user.findFirst({ where: { id: ownerId, isActive: true }, select: { id: true } });
      if (!staff) return { error: "That person is not an active team member.", field: "ownerId" };
      owner = staff.id;
    }
  }

  const dup = await findDuplicateLead(data.email, data.phone);
  if (dup) {
    const row = await prisma.lead.findUnique({ where: { id: dup.id }, select: { assignedToId: true } });
    const visible = !!row && canViewLead(user, row);
    return { duplicate: { id: visible ? dup.id : null, name: visible ? `${dup.firstName} ${dup.lastName}`.trim() : null, matchedOn: dup.matchedOn } };
  }

  const { id } = await createLeadRecord({ userId: user.id, userName: user.name }, { ...data, assignedToId: owner });
  revalidatePath("/crm/pipeline");
  revalidatePath("/crm/inbox");
  return { ok: true, id };
}

// Claude helpers (Phase 2c). Both are read-only: the summary is only shown, the
// intake only prefills the form. 10 calls a minute per user, per feature.
const summaryLimiter = makeLimiter(10, 60_000);
const intakeLimiter = makeLimiter(10, 60_000);
const SLOW_DOWN = "Too many Claude requests — wait a minute and try again.";

export async function summariseLeadAction(leadId: string): Promise<SummaryResult> {
  const user = await requireCrmUser();
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { assignedToId: true } });
  if (!lead || !canViewLead(user, lead)) return { ok: false, error: "Lead not found." };
  if (!summaryLimiter(user.id)) return { ok: false, error: SLOW_DOWN };
  return summariseLead(leadId);
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
