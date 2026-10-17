import { prisma } from "@/lib/prisma";
import { applyLeadStatusChange } from "./updateLeadStatus";
import { canEditLead } from "./access";
import { planMove, type DealLite } from "./movePlan";
import { resolveRate, computeDealAmounts, type RateRow } from "./commission";
import type { LeadStatusValue, LostReasonValue } from "./leadStatus";
import type { SessionCrmUser } from "./session";

export type DealInput = { developmentId: string; unitLabel: string | null; price: number };
export type MoveResult = { ok: true } | { error: string; need?: "deal" | "lostReason" | "confirmCancel"; cancelCount?: number };

export async function moveLead(
  actor: SessionCrmUser,
  leadId: string,
  to: LeadStatusValue,
  input: { deal?: DealInput; lostReason?: LostReasonValue; confirmCancel?: boolean },
): Promise<MoveResult> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { id: true, status: true, assignedToId: true, deals: { select: { id: true, commissionStatus: true } } },
  });
  if (!lead || !canEditLead(actor, lead)) return { error: "Lead not found." };

  const plan = planMove(lead.status as LeadStatusValue, to, lead.deals as DealLite[]);
  if (plan.kind === "blocked") return { error: plan.reason };
  if (plan.needsLostReason && !input.lostReason) return { error: "Choose why the lead was lost.", need: "lostReason" };
  if (plan.cancelDealIds.length && !input.confirmCancel) {
    return { error: "This move cancels the open deal(s).", need: "confirmCancel", cancelCount: plan.cancelDealIds.length };
  }
  if (plan.needsDeal) {
    const d = input.deal;
    if (!d) return { error: "Enter the deal: project, unit and price.", need: "deal" };
    if (!Number.isInteger(d.price) || d.price <= 0 || d.price > 100_000_000) return { error: "Enter a valid price in whole euros.", need: "deal" };
  }

  const now = new Date();
  const dealWrites = [];
  if (plan.needsDeal && input.deal) {
    const dev = await prisma.development.findUnique({ where: { id: input.deal.developmentId }, select: { id: true, developerAccountId: true } });
    if (!dev) return { error: "Project not found.", need: "deal" };
    const rows = await prisma.commissionRate.findMany({ where: { developerAccountId: dev.developerAccountId } });
    const rateRows: RateRow[] = rows.map((r) => ({ developerAccountId: r.developerAccountId, developmentId: r.developmentId, ratePercent: r.ratePercent.toNumber() }));
    const rate = resolveRate(rateRows, dev.developerAccountId, dev.id);
    const amounts = computeDealAmounts({ price: input.deal.price, ourRatePercent: rate.ratePercent, partnerSharePercent: null });
    const earnNow = to === "CLOSED";
    dealWrites.push(
      prisma.deal.create({
        data: {
          leadId, developmentId: dev.id, unitLabel: input.deal.unitLabel?.trim() || null, price: input.deal.price,
          ourRatePercent: rate.ratePercent, rateSource: rate.source, ourCommission: amounts.ourCommission,
          partnerSharePercent: null, partnerCommission: null,
          commissionStatus: earnNow ? "EARNED" : "EXPECTED", earnedAt: earnNow ? now : null, createdById: actor.id,
        },
      }),
    );
  }
  if (plan.earnDealIds.length) {
    dealWrites.push(prisma.deal.updateMany({ where: { id: { in: plan.earnDealIds }, commissionStatus: "EXPECTED" }, data: { commissionStatus: "EARNED", earnedAt: now } }));
  }
  if (plan.cancelDealIds.length) {
    dealWrites.push(prisma.deal.updateMany({ where: { id: { in: plan.cancelDealIds } }, data: { commissionStatus: "CANCELLED", cancelledAt: now } }));
  }
  // The deal writes are atomic among themselves. applyLeadStatusChange uses the
  // global client and cannot join this transaction, so it runs LAST: if it
  // throws, the move is reported failed with the deals already updated, and a
  // retry is safe (planMove is idempotent: an earned/cancelled deal is not
  // earned/cancelled again, and a reserved lead with a deal needs no new one).
  if (dealWrites.length) await prisma.$transaction(dealWrites);
  if (lead.status !== to) {
    await applyLeadStatusChange({ userId: actor.id, userName: actor.name }, leadId, to, { lostReason: to === "LOST" ? input.lostReason : undefined });
  }
  return { ok: true };
}
