import { prisma } from "@/lib/prisma";
import { moveLeadCore, type DealInput, type MoveResult } from "@/lib/crm/moveLead";
import { logLeadInteraction, bodyRequirement, type LogInteractionInput } from "@/lib/crm/logInteraction";
import { setManualFollowUp } from "@/lib/crm/followUpCadence";
import { changedFields, changeSummary, validateLeadEdit } from "@/lib/crm/editLead";
import { emailEditData } from "@/lib/crm/leadHints";
import { contactToCheck, findDuplicateLead } from "@/lib/crm/createLead";
import { authorColumns, type PartnerActor } from "@/lib/crm/leadActor";
import type { LeadStatusValue, LostReasonValue } from "@/lib/crm/leadStatus";
import { claimEligible, partnerMayWork } from "./rules";

// The partner's own work on his FIX client (partner pipeline, 2026-11-05): move,
// log, follow-up date and client details. The actor comes from the partner
// session (the portal's server actions build it from requirePartner); here the
// claim id is resolved to its lead and checked, never trusted. Anything outside
// the partner's pipeline is NOT_IN_PIPELINE, a key the portal localizes, so a
// lead that is not his is never revealed.

export const NOT_IN_PIPELINE = "NOT_IN_PIPELINE";
type Denied = { error: typeof NOT_IN_PIPELINE };
const denied: Denied = { error: NOT_IN_PIPELINE };

// A few minutes of slack for a clock that runs ahead of the server's (as the cockpit).
const FUTURE_SLACK_MS = 5 * 60_000;

// The lead id of an ACTIVE FIX claim of this partner, or null.
async function claimLeadId(actor: PartnerActor, claimId: string): Promise<string | null> {
  const claim = await prisma.partnerClaim.findUnique({ where: { id: claimId }, select: { partnerId: true, mode: true, state: true, leadId: true } });
  return claim && claimEligible(claim, actor.partnerId) ? claim.leadId : null;
}

// The claim's lead, when the partner may work it right now.
async function workableLeadId(actor: PartnerActor, claimId: string): Promise<string | null> {
  const leadId = await claimLeadId(actor, claimId);
  if (!leadId) return null;
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { partnerId: true, workedByPartner: true, deletedAt: true } });
  return lead && partnerMayWork(lead, actor.partnerId) ? leadId : null;
}

export async function movePartnerLead(
  actor: PartnerActor,
  claimId: string,
  to: LeadStatusValue,
  input: { deal?: DealInput; lostReason?: LostReasonValue; viewingScheduledAt?: Date; confirmCancel?: boolean },
): Promise<MoveResult> {
  const leadId = await claimLeadId(actor, claimId);
  if (!leadId) return denied;
  // Authorized again under the row lock, so a handover that lands meanwhile is seen.
  return moveLeadCore(actor, leadId, to, input, (lead) => partnerMayWork(lead, actor.partnerId), () => NOT_IN_PIPELINE);
}

// Same entry as the cockpit's log, minus the staff-only extras (Claude drafts, MCP
// origin). No automatic status move or follow-up: applyFollowUpCadence leaves a
// partner-worked lead alone.
export async function logPartnerInteraction(
  actor: PartnerActor,
  claimId: string,
  input: LogInteractionInput,
): Promise<{ ok: true; interactionId: string } | Denied | { error: string }> {
  const leadId = await workableLeadId(actor, claimId);
  if (!leadId) return denied;
  if (input.occurredAt && input.occurredAt.getTime() > Date.now() + FUTURE_SLACK_MS) return { error: "The date cannot be in the future." };
  const callOutcome = input.type === "CALL" ? input.callOutcome : undefined;
  if (!bodyRequirement(input.type, input.body, input.subject, callOutcome).ok) return { error: "Message is required." };
  const { interactionId } = await logLeadInteraction(actor, leadId, {
    type: input.type, body: input.body, subject: input.subject, occurredAt: input.occurredAt, leadReacted: input.leadReacted, callOutcome,
  });
  return { ok: true, interactionId };
}

export async function setPartnerFollowUp(actor: PartnerActor, claimId: string, at: Date | null): Promise<{ ok: true } | Denied> {
  const leadId = await workableLeadId(actor, claimId);
  if (!leadId) return denied;
  await setManualFollowUp(leadId, at, actor);
  return { ok: true };
}

export type PartnerEditResult =
  | { ok: true; changed: string }
  | Denied
  | { error: string; field?: string }
  | { error: "DUPLICATE_CONTACT"; matchedOn: "email" | "phone" };

// The cockpit's "Edit" for the partner: the same validation and write, the timeline
// row authored by the partner (no LeadActivity, staff-only). Owner, bucket and
// partner fields are not part of the form. Staff's internal notes are not the
// partner's: they are kept as they are and may not be sent.
export async function editPartnerClient(actor: PartnerActor, claimId: string, raw: unknown): Promise<PartnerEditResult> {
  const leadId = await workableLeadId(actor, claimId);
  if (!leadId) return denied;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      firstName: true, lastName: true, email: true, phone: true, salutation: true, languagePreference: true,
      budgetMin: true, budgetMax: true, timeline: true, financing: true, nationality: true, countryOfResidence: true, message: true, notes: true,
    },
  });
  if (!lead) return denied;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Invalid entry." };
  if ("notes" in raw) return { error: "Unknown field: notes", field: "notes" };
  const parsed = validateLeadEdit({ ...(raw as Record<string, unknown>), notes: lead.notes }, lead.languagePreference);
  if (!parsed.ok) return { error: parsed.error, ...(parsed.field ? { field: parsed.field } : {}) };
  const data = parsed.data;
  const fields = changedFields(lead, data);
  if (fields.length === 0) return { ok: true, changed: "" };

  // A contact that belongs to another lead is refused as in the cockpit, without
  // naming that lead (it is not the partner's).
  const check = contactToCheck(lead, data);
  if (check.email || check.phone) {
    const dup = await findDuplicateLead(check.email, check.phone);
    if (dup && dup.id !== leadId) return { error: "DUPLICATE_CONTACT", matchedOn: dup.matchedOn };
  }

  const changed = changeSummary(fields);
  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { ...data, lastName: data.lastName ?? "", ...emailEditData(lead.email, data.email) } }),
    prisma.leadInteraction.create({
      data: {
        leadId, type: "SYSTEM", channel: "SYSTEM", body: `Lead details edited: ${changed}`,
        ...authorColumns(actor), metadata: { kind: "lead_edit", fields, via: "partner" },
      },
    }),
  ]);
  return { ok: true, changed };
}
