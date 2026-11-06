// "Take over" for a partner-worked FIX lead the partner can no longer work (partner pipeline, final
// review 2026-11-05): his protection lapsed or his account is not ACTIVE any more. Such a lead is read
// only for staff and missing from their work lists while the partner cannot act either, so an admin,
// the owner or the partner's manager takes it over explicitly. One transaction under the lead's row
// lock (the same lock as acceptHandover / movePartnerLead / requestHandover): the facts are read
// fresh, workedByPartner goes false, the partner's active manager (else the actor) becomes the owner,
// partnerMode stays, an OPEN handover request is withdrawn; a SYSTEM row and an audit row record it.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { effectiveStateOf } from "@/lib/partner/claimFacts";
import type { ClaimStateValue } from "@/lib/partner/claimState";
import { writeAudit } from "./audit";
import { partnerName } from "./partnerClaims";
import { acceptOwnerId, mayAcceptHandover, takeOverReason, type TakeOverReason } from "./handoverReviewRules";
import type { SessionCrmUser } from "./session";

const DENIED = "Only an admin or this partner's manager can take this client over.";
const STILL_ACTIVE = "The partner can still work this client. Ask the partner to hand it over.";
const NOT_WORKED = "This client is no longer worked by the partner.";

class Abort extends Error {}

type Db = Prisma.TransactionClient | typeof prisma;

/** The partner's newest stored-ACTIVE FIX claim on the lead, judged effectively (null: none). */
async function claimEffective(db: Db, leadId: string, partnerId: string, now: Date): Promise<string | null> {
  const claim = await db.partnerClaim.findFirst({
    where: { leadId, partnerId, mode: "FIX", state: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { state: true, createdAt: true, reviewedAt: true, leadId: true },
  });
  return claim ? effectiveStateOf(db, { ...claim, state: claim.state as ClaimStateValue }, now) : null;
}

/** For the lead cockpit: why the viewer may take this lead over now, or null (not stuck, or not his to take). */
export async function loadTakeOverOffer(u: SessionCrmUser, leadId: string, now = new Date()): Promise<TakeOverReason | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null, workedByPartner: true },
    select: { partnerId: true, partner: { select: { status: true, managerUserId: true } } },
  });
  if (!lead?.partnerId || !mayAcceptHandover(u, lead.partner?.managerUserId ?? null)) return null;
  return takeOverReason({ claimEffective: await claimEffective(prisma, leadId, lead.partnerId, now), partnerStatus: lead.partner?.status ?? null });
}

export async function takeOverPartnerLead(
  actor: SessionCrmUser, leadId: string,
): Promise<{ ok: true; ownerId: string; ownerName: string } | { error: string }> {
  try {
    const done = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId} FOR UPDATE`;
      const lead = await tx.lead.findFirst({
        where: { id: leadId, deletedAt: null },
        select: {
          id: true, partnerId: true, workedByPartner: true, assignedToId: true, partnerMode: true,
          partner: {
            select: {
              id: true, status: true, company: true, firstName: true, lastName: true, managerUserId: true,
              manager: { select: { id: true, name: true, isActive: true } },
            },
          },
        },
      });
      if (!lead) throw new Abort("The lead is in the trash or no longer exists.");
      if (!lead.workedByPartner || !lead.partnerId || !lead.partner) throw new Abort(NOT_WORKED);
      if (!mayAcceptHandover(actor, lead.partner.managerUserId)) throw new Abort(DENIED);
      const now = new Date();
      const effective = await claimEffective(tx, lead.id, lead.partnerId, now);
      const reason = takeOverReason({ claimEffective: effective, partnerStatus: lead.partner.status });
      if (!reason) throw new Abort(STILL_ACTIVE);

      const ownerId = acceptOwnerId(actor.id, lead.partner.manager);
      const ownerName = ownerId === actor.id ? actor.name : lead.partner.manager?.name ?? actor.name;
      // Conditional: a handover accepted meanwhile (it waited for our lock) already cleared the flag.
      const r = await tx.lead.updateMany({ where: { id: lead.id, workedByPartner: true }, data: { workedByPartner: false, assignedToId: ownerId } });
      if (r.count !== 1) throw new Abort(NOT_WORKED);
      // A request nobody can accept any more (accept needs workedByPartner) falls away with the takeover.
      const withdrawn = await tx.partnerHandoverRequest.updateMany({
        where: { leadId: lead.id, state: "OPEN" },
        data: { state: "WITHDRAWN", withdrawnAt: now },
      });
      await tx.leadInteraction.create({
        data: {
          leadId: lead.id, type: "SYSTEM", channel: "SYSTEM", occurredAt: now,
          // "Assigned to …" so Today's "Newly assigned" and the SLA rules see the new owner like any assignment.
          body: `Assigned to ${ownerName} (taken over from partner ${partnerName(lead.partner)} by ${actor.name}: partner can no longer work this client)`,
          createdByUserId: actor.id, createdByName: actor.name,
          metadata: { kind: "partner_lead_taken_over", reason, assignedToId: ownerId, partnerId: lead.partnerId, claimEffective: effective },
        },
      });
      await writeAudit(actor, "partner_lead_take_over", "lead", lead.id, {
        before: { workedByPartner: true, assignedToId: lead.assignedToId },
        after: { workedByPartner: false, assignedToId: ownerId },
        partner: partnerName(lead.partner), partnerStatus: lead.partner.status, claimEffective: effective, reason,
        partnerMode: lead.partnerMode, withdrawnRequests: withdrawn.count,
      }, tx);
      return { ownerId, ownerName };
    });
    return { ok: true, ...done };
  } catch (e) {
    if (e instanceof Abort) return { error: e.message };
    throw e;
  }
}
