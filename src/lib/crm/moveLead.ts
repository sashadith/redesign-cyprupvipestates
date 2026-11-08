import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyLeadStatusChange, standaloneLostReason } from "./updateLeadStatus";
import { canEditLead, leadEditError } from "./access";
import { authorColumns, isPartnerActor, type LeadActor } from "./leadActor";
import { planMove, viewingDateMissing, type DealLite } from "./movePlan";
import { resolveRate, computeDealAmounts, type RateRow } from "./commission";
import { dealPartnerShare } from "./partnerClaims";
import { effectiveStateOf, lastRealContactAt } from "@/lib/partner/claimFacts";
import type { LeadStatusValue, LostReasonValue } from "./leadStatus";
import type { SessionCrmUser } from "./session";

import { chooseDealRate, type DealInput } from "./dealInput";
export type { DealInput };
export type MoveResult = { ok: true } | { error: string; need?: "deal" | "lostReason" | "confirmCancel"; cancelCount?: number };

const STALE = "The deals changed meanwhile — reload and try again.";
class StaleDealsError extends Error {}

// The lead fields an authorize callback decides on, read under the row lock.
export type MoveAuthLead = { partnerId: string | null; assignedToId: string | null; workedByPartner: boolean; deletedAt: Date | null };

export type MoveInput = { deal?: DealInput; lostReason?: LostReasonValue; confirmCancel?: boolean; viewingScheduledAt?: Date };

const NOT_FOUND = "Lead not found.";

// The staff board's move. Same checks and texts as before the partner pipeline:
// a lead in the trash or out of reach is "Lead not found.", a partner-worked one
// the user can see is PARTNER_WORKED_READONLY.
export async function moveLead(
  actor: SessionCrmUser,
  leadId: string,
  to: LeadStatusValue,
  input: { deal?: DealInput; lostReason?: LostReasonValue; confirmCancel?: boolean },
): Promise<MoveResult> {
  return moveLeadCore(
    { userId: actor.id, userName: actor.name },
    leadId,
    to,
    input,
    (lead) => lead.deletedAt === null && canEditLead(actor, lead),
    (lead) => (lead && lead.deletedAt === null ? leadEditError(actor, lead) ?? NOT_FOUND : NOT_FOUND),
  );
}

// The move itself, for staff and partner alike. authorize runs inside the
// transaction after the FOR UPDATE lock, so a concurrent change of who works the
// lead (a handover) is seen; it may read more through tx under that lock.
// deniedError is the text returned when it refuses or the lead does not exist (null). A partner move to VIEWING_SCHEDULED needs
// the appointment, as crm_update_lead does.
export async function moveLeadCore(
  actor: LeadActor,
  leadId: string,
  to: LeadStatusValue,
  input: MoveInput,
  authorize: (lead: MoveAuthLead, tx: Prisma.TransactionClient) => boolean | Promise<boolean>,
  deniedError: (lead: MoveAuthLead | null) => string = () => NOT_FOUND,
): Promise<MoveResult> {
  const partner = isPartnerActor(actor);
  const author = authorColumns(actor);
  // Everything that decides and writes the deals runs in one interactive
  // transaction with the lead row locked, so a double-submit waits for the first
  // move and then re-plans on fresh data (no second deal, no stale cancel).
  let previousStatus: string;
  try {
    const res = await prisma.$transaction(async (tx): Promise<MoveResult & { previousStatus?: string }> => {
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId} FOR UPDATE`;
      const lead = await tx.lead.findFirst({
        where: { id: leadId },
        select: { id: true, status: true, assignedToId: true, workedByPartner: true, partnerId: true, partnerMode: true, deletedAt: true, deals: { select: { id: true, commissionStatus: true } } },
      });
      if (!lead) return { error: deniedError(null) };
      if (!(await authorize(lead, tx))) return { error: deniedError(lead) };
      if (partner && viewingDateMissing(lead.status, to, input.viewingScheduledAt)) {
        return { error: "viewingScheduledAt is required when setting status VIEWING_SCHEDULED." };
      }

      const plan = planMove(lead.status as LeadStatusValue, to, lead.deals as DealLite[]);
      if (plan.kind === "blocked") return { error: plan.reason };
      if (plan.needsLostReason && !input.lostReason) return { error: "Choose why the lead was lost.", need: "lostReason" };
      if (plan.cancelDealIds.length && !input.confirmCancel) {
        return { error: "This move cancels the open deal(s).", need: "confirmCancel", cancelCount: plan.cancelDealIds.length };
      }
      const now = new Date();
      if (plan.needsDeal) {
        if (!input.deal) return { error: "Enter the deal: project, unit and price.", need: "deal" };
        // Partners pick a project from our list; typed names and typed rates are staff-only.
        const deal: DealInput = partner
          ? { developmentId: input.deal.developmentId ?? "", unitLabel: input.deal.unitLabel, price: input.deal.price }
          : input.deal;
        if (partner && !deal.developmentId) return { error: "Project not found.", need: "deal" };
        const made = await insertDeal(tx, { lead, leadId, deal, earnNow: to === "CLOSED", now, author });
        if ("error" in made) return { error: made.error, need: "deal" };
      }
      if (plan.earnDealIds.length) {
        const r = await tx.deal.updateMany({ where: { id: { in: plan.earnDealIds }, commissionStatus: "EXPECTED" }, data: { commissionStatus: "EARNED", earnedAt: now } });
        if (r.count !== plan.earnDealIds.length) throw new StaleDealsError();
      }
      if (plan.cancelDealIds.length) {
        const r = await tx.deal.updateMany({
          where: { id: { in: plan.cancelDealIds }, commissionStatus: { in: ["EXPECTED", "EARNED"] } },
          data: { commissionStatus: "CANCELLED", cancelledAt: now },
        });
        if (r.count !== plan.cancelDealIds.length) throw new StaleDealsError();
      }
      return { ok: true, previousStatus: lead.status };
    });
    if (!("ok" in res)) return res;
    previousStatus = res.previousStatus ?? "";
  } catch (e) {
    if (e instanceof StaleDealsError) return { error: STALE };
    throw e;
  }

  // applyLeadStatusChange uses the global client and cannot join the
  // transaction, so it runs AFTER it: if it throws, the move is reported failed
  // with the deals already updated, and a retry is safe (planMove is idempotent).
  if (previousStatus !== to) {
    await applyLeadStatusChange(actor, leadId, to, {
      lostReason: to === "LOST" ? input.lostReason : undefined,
      ...(input.viewingScheduledAt !== undefined ? { viewingScheduledAt: input.viewingScheduledAt } : {}),
    });
  } else {
    const reason = standaloneLostReason(previousStatus, to, input.lostReason);
    if (reason) await prisma.lead.update({ where: { id: leadId }, data: { lostReason: reason } });
  }
  return { ok: true };
}

type DealLead = { status: string; partnerId: string | null; partnerMode: Parameters<typeof dealPartnerShare>[0]["partnerMode"]; deals: { commissionStatus: string }[] };

/**
 * Writes one deal inside the caller's transaction, with the lead row already
 * locked. Shared by the pipeline move (Reserved/Closed) and the cockpit's
 * "New deal" (2026-11-08). The developer and project come from our lists or are
 * typed in; the rate is the typed one, else the one on file for our developer.
 */
export async function insertDeal(
  tx: Prisma.TransactionClient,
  a: { lead: DealLead; leadId: string; deal: DealInput; earnNow: boolean; now: Date; author: ReturnType<typeof authorColumns> },
): Promise<{ ok: true; id: string } | { error: string }> {
  const d = a.deal;
  if (!Number.isInteger(d.price) || d.price <= 0 || d.price > 100_000_000) return { error: "Enter a valid price in whole euros." };
  let developmentId: string | null = null;
  let developerAccountId: string | null = null;
  if (d.developmentId) {
    const dev = await tx.development.findFirst({
      where: { id: d.developmentId, publishStatus: "published" },
      select: { id: true, developerAccountId: true },
    });
    if (!dev) return { error: "Project not found." };
    developmentId = dev.id;
    developerAccountId = dev.developerAccountId;
  } else if (d.developerAccountId) {
    const acc = await tx.developerAccount.findFirst({ where: { id: d.developerAccountId }, select: { id: true } });
    if (!acc) return { error: "Developer not found." };
    developerAccountId = acc.id;
  }
  if (!developmentId && !d.projectName?.trim()) return { error: "Choose a project or type its name." };
  if (!developerAccountId && !d.developerName?.trim()) return { error: "Choose a developer or type its name." };

  let onFile: ReturnType<typeof resolveRate> | null = null;
  if (developerAccountId) {
    const rows = await tx.commissionRate.findMany({ where: { developerAccountId } });
    const rateRows: RateRow[] = rows.map((r) => ({ developerAccountId: r.developerAccountId, developmentId: r.developmentId, ratePercent: r.ratePercent.toNumber() }));
    // A typed project has no project rate: "" matches no row, so the developer's default applies.
    onFile = resolveRate(rateRows, developerAccountId, developmentId ?? "");
  }
  const rate = chooseDealRate(d.ratePercent, onFile);

  // Partner share (phase 3b, decision 9): only while the lead's partner holds an EFFECTIVELY active
  // claim, judged on the lead as it is before this change (status and deals not yet changed), under the row lock.
  const lead = a.lead;
  const claim = lead.partnerId
    ? await tx.partnerClaim.findFirst({
      where: { leadId: a.leadId, partnerId: lead.partnerId, state: "ACTIVE" },
      select: {
        partnerId: true, state: true, createdAt: true, reviewedAt: true, leadId: true,
        partner: { select: { handoverShare: true, fixShare: true, status: true } },
      },
    })
    : null;
  const effective = claim
    ? await effectiveStateOf(tx, claim, a.now, {
      leadDeleted: false,
      leadStatus: lead.status,
      hasLiveDeal: lead.deals.some((x) => x.commissionStatus !== "CANCELLED"),
      lastRealContactAt: await lastRealContactAt(tx, a.leadId),
    })
    : null;
  const partnerSharePercent = dealPartnerShare({
    partnerId: lead.partnerId,
    partnerMode: lead.partnerMode,
    activeClaim: claim && effective ? { partnerId: claim.partnerId, effective } : null,
    partner: claim ? { handoverShare: claim.partner.handoverShare.toNumber(), fixShare: claim.partner.fixShare.toNumber(), status: claim.partner.status } : null,
  });
  const amounts = computeDealAmounts({ price: d.price, ourRatePercent: rate.ratePercent, partnerSharePercent });
  const created = await tx.deal.create({
    data: {
      leadId: a.leadId, developmentId, developerAccountId,
      developerName: developerAccountId ? null : d.developerName!.trim(),
      projectName: developmentId ? null : d.projectName!.trim(),
      unitLabel: d.unitLabel?.trim() || null, price: d.price,
      ourRatePercent: rate.ratePercent, rateSource: rate.source, ourCommission: amounts.ourCommission,
      partnerSharePercent, partnerCommission: amounts.partnerCommission,
      commissionStatus: a.earnNow ? "EARNED" : "EXPECTED", earnedAt: a.earnNow ? a.now : null,
      createdById: a.author.createdByUserId, createdByPartnerUserId: a.author.createdByPartnerUserId,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}
