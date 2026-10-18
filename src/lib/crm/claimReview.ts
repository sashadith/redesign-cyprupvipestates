// Staff side of partner claims (partner portal phase 3b, task 5, decision 3): the review
// list for /crm/inbox, Accept / Reject, and the "Message to partner" composer. Every write
// is one transaction with a guarded state change, an audit row and its outbox row
// (PartnerNotification, sent later by the partner-notify cron — nothing is mailed here).
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REAL_CONTACT_TYPES, claimProtection } from "@/lib/partner/claims";
import { canEditLead } from "./access";
import { writeAudit } from "./audit";
import {
  PROTECTION_ACTIVE_ERROR, REVIEW_CAP, acceptDecision, buildReviewCard, claimOutcomeRefKey, messageRefKey, normaliseOutcomeNote,
  partnerName, readSubmission, validatePartnerMessage, type ClaimStateValue, type ReviewCard,
} from "./partnerClaims";
import type { SessionCrmUser } from "./session";

export type ReviewResult = { ok: true } | { error: string };

const REAL = [...REAL_CONTACT_TYPES];
const HANDLED = "Already handled by someone else.";
const PARTNER_SELECT = { id: true, company: true, firstName: true, lastName: true, status: true } as const;

class Abort extends Error {}
const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** Latest real contact (call / email / WhatsApp, never notes) per lead. */
async function lastRealContacts(db: Prisma.TransactionClient | typeof prisma, leadIds: string[]): Promise<Map<string, Date>> {
  if (!leadIds.length) return new Map();
  const rows = await db.leadInteraction.groupBy({
    by: ["leadId"],
    where: { leadId: { in: leadIds }, type: { in: REAL } },
    _max: { occurredAt: true },
  });
  return new Map(rows.flatMap((r) => (r._max.occurredAt ? [[r.leadId, r._max.occurredAt] as const] : [])));
}

/** IN_REVIEW claims, oldest first, as review cards (managers only — the caller checks). */
export async function listClaimsForReview(now = new Date()): Promise<{ cards: ReviewCard[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.partnerClaim.findMany({
      where: { state: "IN_REVIEW" },
      orderBy: { createdAt: "asc" },
      take: REVIEW_CAP,
      select: {
        id: true, createdAt: true, mode: true, contactMode: true, submission: true,
        partner: { select: PARTNER_SELECT },
        lead: {
          select: {
            id: true, firstName: true, lastName: true, email: true, phone: true, status: true, source: true, createdAt: true, deletedAt: true,
            assignedTo: { select: { name: true } },
            deals: { where: { commissionStatus: { not: "CANCELLED" } }, select: { id: true }, take: 1 },
            claims: { orderBy: { createdAt: "asc" }, select: { id: true, state: true, mode: true, createdAt: true, partner: { select: PARTNER_SELECT } } },
          },
        },
      },
    }),
    prisma.partnerClaim.count({ where: { state: "IN_REVIEW" } }),
  ]);
  const last = await lastRealContacts(prisma, Array.from(new Set(rows.map((r) => r.lead.id))));
  const cards = rows.map((r) =>
    buildReviewCard({
      id: r.id, createdAt: r.createdAt, mode: r.mode, contactMode: r.contactMode, submission: r.submission, partner: r.partner,
      lead: {
        id: r.lead.id, firstName: r.lead.firstName, lastName: r.lead.lastName, email: r.lead.email, phone: r.lead.phone,
        status: r.lead.status, source: r.lead.source, createdAt: r.lead.createdAt, deletedAt: r.lead.deletedAt,
        ownerName: r.lead.assignedTo?.name ?? null, hasDeal: r.lead.deals.length > 0, lastRealContactAt: last.get(r.lead.id) ?? null,
        claims: r.lead.claims.map((c) => ({ ...c, state: c.state as ClaimStateValue })),
      },
    }, now),
  );
  return { cards, total };
}

export async function acceptClaim(actor: SessionCrmUser, claimId: string): Promise<ReviewResult & { leadId?: string }> {
  try {
    const leadId = await prisma.$transaction(async (tx) => {
      const claim = await tx.partnerClaim.findUnique({
        where: { id: claimId },
        select: { id: true, state: true, leadId: true, partnerId: true, mode: true, contactMode: true, submission: true, partner: { select: PARTNER_SELECT } },
      });
      if (!claim || claim.state !== "IN_REVIEW") throw new Abort(HANDLED);
      // Same lock as moveLead: a deal being created meanwhile is either seen here or waits for us.
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${claim.leadId} FOR UPDATE`;
      const lead = await tx.lead.findFirst({
        where: { id: claim.leadId, deletedAt: null },
        select: { id: true, status: true, partnerId: true, deals: { where: { commissionStatus: { not: "CANCELLED" } }, select: { id: true }, take: 1 } },
      });
      if (!lead) throw new Abort("The lead is in the trash or no longer exists.");

      const now = new Date();
      const other = await tx.partnerClaim.findFirst({
        where: { leadId: lead.id, state: "ACTIVE", id: { not: claim.id } },
        select: { id: true, partnerId: true, createdAt: true },
      });
      if (other && other.partnerId === claim.partnerId) throw new Abort("This partner already holds this client — reject the duplicate claim.");
      const protection = other
        ? claimProtection({ claimCreatedAt: other.createdAt, lastRealContactAt: (await lastRealContacts(tx, [lead.id])).get(lead.id) ?? null, now })
        : null;
      const decision = acceptDecision({ otherActive: !!other, protection, hasDeal: lead.deals.length > 0, status: lead.status });
      if (decision.kind === "BLOCKED") throw new Abort(decision.error);
      if (decision.kind === "EXPIRE_OTHER_THEN_ACCEPT" && other) {
        const ex = await tx.partnerClaim.updateMany({ where: { id: other.id, state: "ACTIVE" }, data: { state: "EXPIRED" } });
        if (ex.count !== 1) throw new Abort(HANDLED);
        await writeAudit(actor, "partner_claim_expire", "partner_claim", other.id, {
          before: { state: "ACTIVE" }, after: { state: "EXPIRED" }, reason: "protection expired; replaced by accepted claim", replacedBy: claim.id, leadId: lead.id,
        }, tx);
      }

      const r = await tx.partnerClaim.updateMany({
        where: { id: claim.id, state: "IN_REVIEW" },
        data: { state: "ACTIVE", reviewedAt: now, reviewedById: actor.id },
      });
      if (r.count !== 1) throw new Abort(HANDLED);

      const sub = readSubmission(claim.submission);
      await tx.lead.update({
        where: { id: lead.id },
        data: { partnerId: claim.partnerId, partnerMode: claim.mode, contactMode: claim.contactMode, contactRepName: sub.repName, contactRepPhone: sub.repPhone },
      });
      const who = partnerName(claim.partner);
      await tx.leadInteraction.create({
        data: {
          leadId: lead.id, type: "SYSTEM", channel: "SYSTEM", body: `Partner claim accepted: ${who}`,
          createdByUserId: actor.id, createdByName: actor.name, occurredAt: now,
          metadata: { via: "claim-review", claimId: claim.id, partnerId: claim.partnerId, ...(other && decision.kind === "EXPIRE_OTHER_THEN_ACCEPT" ? { expiredClaimId: other.id } : {}) },
        },
      });
      await writeAudit(actor, "partner_claim_accept", "partner_claim", claim.id, {
        before: { state: "IN_REVIEW", leadPartnerId: lead.partnerId }, after: { state: "ACTIVE", leadPartnerId: claim.partnerId, mode: claim.mode }, leadId: lead.id,
      }, tx);
      await tx.partnerNotification.create({
        data: {
          kind: "CLAIM_OUTCOME", refKey: claimOutcomeRefKey(claim.id, "ACTIVE"), partnerId: claim.partnerId, claimId: claim.id, leadId: lead.id,
          payload: { accepted: true },
        },
      });
      return lead.id;
    });
    return { ok: true, leadId };
  } catch (e) {
    if (e instanceof Abort) return { error: e.message };
    // The partial unique index (one ACTIVE claim per lead) caught a concurrent Accept.
    if (isUniqueViolation(e)) return { error: PROTECTION_ACTIVE_ERROR };
    throw e;
  }
}

export async function rejectClaim(actor: SessionCrmUser, claimId: string, rawNote: unknown): Promise<ReviewResult> {
  const note = normaliseOutcomeNote(rawNote);
  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.partnerClaim.findUnique({ where: { id: claimId }, select: { id: true, state: true, leadId: true, partnerId: true } });
      if (!claim || claim.state !== "IN_REVIEW") throw new Abort(HANDLED);
      const r = await tx.partnerClaim.updateMany({
        where: { id: claim.id, state: "IN_REVIEW" },
        data: { state: "REJECTED", reviewedAt: new Date(), reviewedById: actor.id, outcomeNote: note },
      });
      if (r.count !== 1) throw new Abort(HANDLED);
      await writeAudit(actor, "partner_claim_reject", "partner_claim", claim.id, {
        before: { state: "IN_REVIEW" }, after: { state: "REJECTED" }, leadId: claim.leadId, hasNote: !!note,
      }, tx);
      await tx.partnerNotification.create({
        data: {
          kind: "CLAIM_OUTCOME", refKey: claimOutcomeRefKey(claim.id, "REJECTED"), partnerId: claim.partnerId, claimId: claim.id, leadId: claim.leadId,
          payload: { accepted: false },
        },
      });
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Abort) return { error: e.message };
    throw e;
  }
}

/** Staff → partner message on a lead with an ACTIVE claim; the partner reads it in the portal and by email. */
export async function sendPartnerMessage(actor: SessionCrmUser, leadId: string, rawBody: unknown): Promise<ReviewResult> {
  const v = validatePartnerMessage(rawBody);
  if (!v.ok) return { error: v.error };
  try {
    await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, assignedToId: true } });
      if (!lead || !canEditLead(actor, lead)) throw new Abort("Lead not found.");
      const claim = await tx.partnerClaim.findFirst({ where: { leadId: lead.id, state: "ACTIVE" }, select: { id: true, partnerId: true } });
      if (!claim) throw new Abort("No partner holds this client right now.");
      const msg = await tx.partnerMessage.create({
        data: { leadId: lead.id, partnerId: claim.partnerId, authorUserId: actor.id, body: v.body },
        select: { id: true },
      });
      await tx.partnerNotification.create({
        data: { kind: "MESSAGE", refKey: messageRefKey(msg.id), partnerId: claim.partnerId, leadId: lead.id, claimId: claim.id, payload: {} },
      });
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Abort) return { error: e.message };
    throw e;
  }
}
