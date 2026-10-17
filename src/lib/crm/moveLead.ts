import { prisma } from "@/lib/prisma";
import { applyLeadStatusChange, standaloneLostReason } from "./updateLeadStatus";
import { canEditLead } from "./access";
import { planMove, type DealLite } from "./movePlan";
import { resolveRate, computeDealAmounts, type RateRow } from "./commission";
import type { LeadStatusValue, LostReasonValue } from "./leadStatus";
import type { SessionCrmUser } from "./session";

export type DealInput = { developmentId: string; unitLabel: string | null; price: number };
export type MoveResult = { ok: true } | { error: string; need?: "deal" | "lostReason" | "confirmCancel"; cancelCount?: number };

const STALE = "The deals changed meanwhile — reload and try again.";
class StaleDealsError extends Error {}

export async function moveLead(
  actor: SessionCrmUser,
  leadId: string,
  to: LeadStatusValue,
  input: { deal?: DealInput; lostReason?: LostReasonValue; confirmCancel?: boolean },
): Promise<MoveResult> {
  // Everything that decides and writes the deals runs in one interactive
  // transaction with the lead row locked, so a double-submit waits for the first
  // move and then re-plans on fresh data (no second deal, no stale cancel).
  let previousStatus: string;
  try {
    const res = await prisma.$transaction(async (tx): Promise<MoveResult & { previousStatus?: string }> => {
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId} FOR UPDATE`;
      const lead = await tx.lead.findFirst({
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
      const now = new Date();
      if (plan.needsDeal) {
        const d = input.deal;
        if (!d) return { error: "Enter the deal: project, unit and price.", need: "deal" };
        if (!Number.isInteger(d.price) || d.price <= 0 || d.price > 100_000_000) return { error: "Enter a valid price in whole euros.", need: "deal" };
        const dev = await tx.development.findFirst({
          where: { id: d.developmentId, publishStatus: "published" },
          select: { id: true, developerAccountId: true },
        });
        if (!dev) return { error: "Project not found.", need: "deal" };
        const rows = await tx.commissionRate.findMany({ where: { developerAccountId: dev.developerAccountId } });
        const rateRows: RateRow[] = rows.map((r) => ({ developerAccountId: r.developerAccountId, developmentId: r.developmentId, ratePercent: r.ratePercent.toNumber() }));
        const rate = resolveRate(rateRows, dev.developerAccountId, dev.id);
        const amounts = computeDealAmounts({ price: d.price, ourRatePercent: rate.ratePercent, partnerSharePercent: null });
        const earnNow = to === "CLOSED";
        await tx.deal.create({
          data: {
            leadId, developmentId: dev.id, unitLabel: d.unitLabel?.trim() || null, price: d.price,
            ourRatePercent: rate.ratePercent, rateSource: rate.source, ourCommission: amounts.ourCommission,
            partnerSharePercent: null, partnerCommission: null,
            commissionStatus: earnNow ? "EARNED" : "EXPECTED", earnedAt: earnNow ? now : null, createdById: actor.id,
          },
        });
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
    await applyLeadStatusChange({ userId: actor.id, userName: actor.name }, leadId, to, { lostReason: to === "LOST" ? input.lostReason : undefined });
  } else {
    const reason = standaloneLostReason(previousStatus, to, input.lostReason);
    if (reason) await prisma.lead.update({ where: { id: leadId }, data: { lostReason: reason } });
  }
  return { ok: true };
}
