import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendOfficeMessage } from "@/lib/crm/officeBot";
import { authorColumns, type PartnerActor } from "@/lib/crm/leadActor";
import { isLeadStatus, type LeadStatusValue } from "@/lib/crm/leadStatus";
import { NOT_IN_PIPELINE, claimLeadId, mayAct } from "./actions";
import { handoverAllowed, handoverPlan } from "./handoverRules";
import { handoverAlertHtml } from "./handoverCopy";
import { crmLeadUrl, managerChatId } from "./managerChat";

// The partner asks his manager to take over a FIX client he works himself (partner
// pipeline, 2026-11-05), or withdraws that request while it is open. Nothing about who
// works the lead changes here: partnerMode, workedByPartner and assignedTo stay as they
// are until the manager accepts (a downgrade to HANDOVER takes effect only then). The
// errors are keys the portal localizes (pipelineErrorKey).

export const HANDOVER_NOT_ALLOWED = "HANDOVER_NOT_ALLOWED";
export const HANDOVER_OPEN = "HANDOVER_OPEN";
export const HANDOVER_NOT_OPEN = "HANDOVER_NOT_OPEN";
export const CONFIRM_DOWNGRADE = "CONFIRM_DOWNGRADE";

export const HANDOVER_NOTE_MAX = 2000;

export type RequestHandoverResult =
  | { ok: true }
  | { error: string; need?: "confirmDowngrade"; fixShare?: number; handoverShare?: number };

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

type Created = { ok: true; requestId: string; leadId: string; stage: LeadStatusValue; downgrade: boolean; note: string | null };

export async function requestHandover(
  actor: PartnerActor,
  claimId: string,
  note: string | null,
  confirmedDowngrade: boolean,
): Promise<RequestHandoverResult> {
  const leadId = await claimLeadId(actor, claimId);
  if (!leadId) return { error: NOT_IN_PIPELINE };
  const text = note?.trim().slice(0, HANDOVER_NOTE_MAX) || null;
  let res: Created | Exclude<RequestHandoverResult, { ok: true }>;
  try {
    res = await prisma.$transaction(async (tx) => {
      // Under the row lock, so a move, a lapsed protection or another request that lands meanwhile is seen.
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId} FOR UPDATE`;
      if (!(await mayAct(tx, actor, claimId, leadId))) return { error: NOT_IN_PIPELINE };
      const [lead, liveDeal, open] = await Promise.all([
        tx.lead.findUnique({ where: { id: leadId }, select: { status: true, partnerMode: true } }),
        tx.deal.findFirst({ where: { leadId, commissionStatus: { not: "CANCELLED" } }, select: { id: true } }),
        tx.partnerHandoverRequest.findFirst({ where: { leadId, state: "OPEN" }, select: { id: true } }),
      ]);
      if (!lead || !isLeadStatus(lead.status)) return { error: NOT_IN_PIPELINE };
      const stage: LeadStatusValue = lead.status;
      if (!handoverAllowed(stage)) return { error: HANDOVER_NOT_ALLOWED };
      if (open) return { error: HANDOVER_OPEN };
      const plan = handoverPlan({ status: stage, partnerMode: lead.partnerMode, hasLiveDeal: !!liveDeal });
      if (plan.downgrade && !confirmedDowngrade) {
        const shares = await tx.partner.findUnique({ where: { id: actor.partnerId }, select: { fixShare: true, handoverShare: true } });
        if (!shares) return { error: NOT_IN_PIPELINE };
        return { error: CONFIRM_DOWNGRADE, need: "confirmDowngrade" as const, fixShare: Number(shares.fixShare), handoverShare: Number(shares.handoverShare) };
      }
      const req = await tx.partnerHandoverRequest.create({
        data: {
          leadId, claimId, partnerId: actor.partnerId, partnerUserId: actor.partnerUserId,
          note: text, stageAtRequest: stage, downgrade: plan.downgrade,
        },
        select: { id: true },
      });
      await tx.leadInteraction.create({
        data: {
          leadId, type: "SYSTEM", channel: "SYSTEM", direction: null, body: `Handover requested by partner ${actor.userName}`,
          ...authorColumns(actor), metadata: { kind: "handover_requested", requestId: req.id, downgrade: plan.downgrade },
        },
      });
      return { ok: true as const, requestId: req.id, leadId, stage, downgrade: plan.downgrade, note: text };
    });
  } catch (e) {
    // The partial unique index (one OPEN request per lead) catches a race the read above missed.
    if (isUniqueViolation(e)) return { error: HANDOVER_OPEN };
    throw e;
  }
  if (!("ok" in res)) return res;
  await sendHandoverAlert(actor, res);
  return { ok: true };
}

// OPEN → WITHDRAWN, only the partner's own open request. A downgrade it carried falls away with it.
export async function withdrawHandover(actor: PartnerActor, requestId: string): Promise<{ ok: true } | { error: string }> {
  if (typeof requestId !== "string" || !requestId || requestId.length > 64) return { error: HANDOVER_NOT_OPEN };
  const done = await prisma.$transaction(async (tx) => {
    const req = await tx.partnerHandoverRequest.findFirst({
      where: { id: requestId, partnerId: actor.partnerId, state: "OPEN" },
      select: { id: true, leadId: true, downgrade: true },
    });
    if (!req) return false;
    // Conditional write: an acceptance that lands meanwhile wins and this does nothing.
    const r = await tx.partnerHandoverRequest.updateMany({
      where: { id: req.id, partnerId: actor.partnerId, state: "OPEN" },
      data: { state: "WITHDRAWN", withdrawnAt: new Date() },
    });
    if (!r.count) return false;
    await tx.leadInteraction.create({
      data: {
        leadId: req.leadId, type: "SYSTEM", channel: "SYSTEM", direction: null, body: `Handover request withdrawn by partner ${actor.userName}`,
        ...authorColumns(actor), metadata: { kind: "handover_withdrawn", requestId: req.id, downgrade: req.downgrade },
      },
    });
    return true;
  });
  return done ? { ok: true } : { error: HANDOVER_NOT_OPEN };
}

// The manager's Telegram (fallback: the owner). Best effort: never throws, the request is already stored.
async function sendHandoverAlert(actor: PartnerActor, r: Created): Promise<void> {
  try {
    const [chatId, lead] = await Promise.all([
      managerChatId(actor.partnerId),
      prisma.lead.findUnique({ where: { id: r.leadId }, select: { firstName: true, lastName: true } }),
    ]);
    if (!chatId) {
      console.warn("[partner handover] no manager or owner chat linked; skipped", { leadId: r.leadId, requestId: r.requestId });
      return;
    }
    const html = handoverAlertHtml({
      partnerName: actor.userName,
      client: `${lead?.firstName ?? ""} ${lead?.lastName ?? ""}`.trim() || "a client",
      stage: r.stage,
      note: r.note,
      downgrade: r.downgrade,
      url: crmLeadUrl(r.leadId),
    });
    const s = await sendOfficeMessage(chatId, html);
    if (!s.ok) console.warn("[partner handover] send failed", { requestId: r.requestId, status: s.status, description: s.description });
  } catch (e) {
    console.error("[partner handover]", e);
  }
}
