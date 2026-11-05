import { prisma } from "@/lib/prisma";
import { moveLeadCore, type DealInput, type MoveResult } from "@/lib/crm/moveLead";
import { logLeadInteraction, bodyRequirement, type LogInteractionInput } from "@/lib/crm/logInteraction";
import { setManualFollowUp } from "@/lib/crm/followUpCadence";
import { validateLeadEdit } from "@/lib/crm/editLead";
import { applyLeadEdit } from "@/lib/crm/applyLeadEdit";
import { authorColumns, type PartnerActor } from "@/lib/crm/leadActor";
import type { LeadStatusValue, LostReasonValue } from "@/lib/crm/leadStatus";
import type { Prisma, PrismaClient } from "@prisma/client";
import { effectiveStateOf } from "@/lib/partner/claimFacts";
import { claimEligible, partnerMayAct } from "./rules";

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

const CLAIM_SELECT = { partnerId: true, mode: true, state: true, leadId: true, createdAt: true, reviewedAt: true } as const;

// The lead id of a stored ACTIVE FIX claim of this partner, or null (pre-check).
async function claimLeadId(actor: PartnerActor, claimId: string): Promise<string | null> {
  const claim = await prisma.partnerClaim.findUnique({ where: { id: claimId }, select: { partnerId: true, mode: true, state: true, leadId: true } });
  return claim && claimEligible(claim, actor.partnerId) ? claim.leadId : null;
}

// Whether the partner may act on this claim's lead now: the stored claim, its
// EFFECTIVE state (the judgement moveLead uses for the deal's partner share, so a
// lapsed protection is never worked on) and the lead. Pass tx to judge under a lock.
async function mayAct(db: Prisma.TransactionClient | PrismaClient, actor: PartnerActor, claimId: string, leadId: string): Promise<boolean> {
  const claim = await db.partnerClaim.findUnique({ where: { id: claimId }, select: CLAIM_SELECT });
  if (!claim || claim.leadId !== leadId || !claimEligible(claim, actor.partnerId)) return false;
  const [effective, lead] = await Promise.all([
    effectiveStateOf(db, claim, new Date()),
    db.lead.findUnique({ where: { id: leadId }, select: { partnerId: true, workedByPartner: true, deletedAt: true } }),
  ]);
  return partnerMayAct(claim, effective, lead, actor.partnerId);
}

// The claim's lead, when the partner may work it right now.
async function workableLeadId(actor: PartnerActor, claimId: string): Promise<string | null> {
  const leadId = await claimLeadId(actor, claimId);
  return leadId && (await mayAct(prisma, actor, claimId, leadId)) ? leadId : null;
}

export async function movePartnerLead(
  actor: PartnerActor,
  claimId: string,
  to: LeadStatusValue,
  input: { deal?: DealInput; lostReason?: LostReasonValue; viewingScheduledAt?: Date; confirmCancel?: boolean },
): Promise<MoveResult> {
  const leadId = await claimLeadId(actor, claimId);
  if (!leadId) return denied;
  // Authorized under the row lock, so a handover or a lapsed protection that lands meanwhile is seen.
  return moveLeadCore(actor, leadId, to, input, (_lead, tx) => mayAct(tx, actor, claimId, leadId), () => NOT_IN_PIPELINE);
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

export const NOT_VIEWING_SCHEDULED = "NOT_VIEWING_SCHEDULED";

// A new date for a viewing that is already scheduled (moveLeadCore leaves
// VIEWING_SCHEDULED → VIEWING_SCHEDULED alone). Only while the lead is still in
// VIEWING_SCHEDULED, checked in the write itself; the timeline row is the partner's,
// with the date in metadata so the portal can word it.
export async function setPartnerViewingDate(
  actor: PartnerActor,
  claimId: string,
  at: Date,
): Promise<{ ok: true } | Denied | { error: typeof NOT_VIEWING_SCHEDULED }> {
  const leadId = await workableLeadId(actor, claimId);
  if (!leadId) return denied;
  const iso = at.toISOString();
  const done = await prisma.$transaction(async (tx) => {
    const r = await tx.lead.updateMany({ where: { id: leadId, status: "VIEWING_SCHEDULED", deletedAt: null }, data: { viewingScheduledAt: at } });
    if (!r.count) return false;
    await tx.leadInteraction.create({
      data: {
        leadId, type: "SYSTEM", channel: "SYSTEM", direction: null, body: `Viewing date set to ${iso}`,
        ...authorColumns(actor), metadata: { kind: "viewing_date", viewingScheduledAt: iso, via: "partner" },
      },
    });
    return true;
  });
  return done ? { ok: true } : { error: NOT_VIEWING_SCHEDULED };
}

export type PartnerEditResult =
  | { ok: true; changed: string }
  | Denied
  | { error: string; field?: string }
  | { error: "DUPLICATE_CONTACT" };

// The cockpit's "Edit" for the partner: the same validation and write (applyLeadEdit),
// the timeline row authored by the partner (no LeadActivity, staff-only). Owner,
// bucket and partner fields are not part of the form. Staff's internal notes are not
// the partner's: they are kept as they are and may not be sent. A contact that
// belongs to another lead is refused without saying which lead or which field.
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
  const res = await applyLeadEdit(leadId, lead, parsed.data, actor);
  if (res.kind === "duplicate") return { error: "DUPLICATE_CONTACT" };
  return { ok: true, changed: res.kind === "ok" ? res.changed : "" };
}
