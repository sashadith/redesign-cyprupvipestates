// DB half of the effective-claim-state rule (claimState.ts): loads the lead facts the pure
// effectiveClaimState needs. Pass a transaction client to evaluate under a row lock.
import type { Prisma, PrismaClient } from "@prisma/client";
import { REAL_CONTACT_TYPES } from "./claims";
import { activeSince, effectiveClaimState, type ClaimStateValue, type EffectiveClaimState } from "./claimState";

type Db = Prisma.TransactionClient | PrismaClient;

/** Latest real contact (call / email / WhatsApp, never notes) on the lead, any date. */
export async function lastRealContactAt(db: Db, leadId: string): Promise<Date | null> {
  const r = await db.leadInteraction.aggregate({
    where: { leadId, type: { in: [...REAL_CONTACT_TYPES] } },
    _max: { occurredAt: true },
  });
  return r._max.occurredAt ?? null;
}

export type LeadClaimFacts = { leadDeleted: boolean; leadStatus: string | null; hasLiveDeal: boolean; lastRealContactAt: Date | null };

/** Status, trash flag, live (non-CANCELLED) deal and last real contact of a lead; a missing lead reads as trashed. */
export async function leadClaimFacts(db: Db, leadId: string): Promise<LeadClaimFacts> {
  const [lead, liveDeals, last] = await Promise.all([
    db.lead.findUnique({ where: { id: leadId }, select: { status: true, deletedAt: true } }),
    db.deal.count({ where: { leadId, commissionStatus: { not: "CANCELLED" } } }),
    lastRealContactAt(db, leadId),
  ]);
  return { leadDeleted: !lead || !!lead.deletedAt, leadStatus: lead?.status ?? null, hasLiveDeal: liveDeals > 0, lastRealContactAt: last };
}

/** effectiveClaimState of one claim row with the lead's facts (loaded unless given). */
export async function effectiveStateOf(
  db: Db,
  claim: { state: ClaimStateValue; createdAt: Date; reviewedAt: Date | null; leadId: string },
  now: Date,
  facts?: LeadClaimFacts,
): Promise<EffectiveClaimState> {
  if (claim.state !== "ACTIVE") return claim.state;
  const f = facts ?? (await leadClaimFacts(db, claim.leadId));
  return effectiveClaimState({ state: claim.state, activeSince: activeSince(claim), now, ...f });
}
