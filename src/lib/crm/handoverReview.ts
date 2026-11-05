// Staff side of a partner's handover request (partner pipeline, 2026-11-05): the list for
// Today/Inbox, Accept (optionally "keep Fix"), the later keep-FIX toggle on the cockpit, and
// the 24 h / 48 h escalation the crm-sla cron runs. Every write is one transaction under the
// lead's row lock (the same lock as movePartnerLead and requestHandover) with a guarded state
// change, a SYSTEM row, an audit row and a STAGE outbox row (sent by the partner-notify cron).
// Once accepted, workedByPartner is false, so a partner move that arrives later fails
// partnerMayWork and returns NOT_IN_PIPELINE.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STATUS_LABEL, isLeadStatus, type LeadStatusValue } from "@/lib/crm/leadStatus";
import { ago } from "./timeline";
import { handoverPlan, mayKeepFix } from "@/lib/partner/pipeline/handoverRules";
import { writeAudit } from "./audit";
import { partnerName } from "./partnerClaims";
import {
  DEAL_FIXED_ERROR, NOTHING_TO_CHANGE, acceptOutcome, escalationDue, handoverEscalationHtml, keepFixChange, mayAcceptHandover,
  type PartnerModeValue,
} from "./handoverReviewRules";
import type { ReviewResult } from "./claimReview";
import type { SessionCrmUser } from "./session";

export { escalationDue };

const HANDLED = "Already handled by someone else.";
const DENIED = "Only an admin or this partner's manager can accept the handover.";
const LIST_CAP = 100;

class Abort extends Error {}

const PARTNER_SELECT = { id: true, company: true, firstName: true, lastName: true, managerUserId: true } as const;
const mode = (m: string | null): PartnerModeValue | null => (m === "FIX" || m === "HANDOVER" ? m : null);
const liveDeal = (tx: Prisma.TransactionClient, leadId: string) =>
  tx.deal.findFirst({ where: { leadId, commissionStatus: { not: "CANCELLED" } }, select: { id: true } });

export type HandoverRequestCard = {
  id: string; leadId: string; client: string; partner: string; stage: string; note: string | null;
  createdAt: string; age: string; downgrade: boolean; hasLiveDeal: boolean;
};

/** Where clause for the OPEN requests a user may act on: admins and owners all, a manager their partners'. */
export function handoverVisibleWhere(u: SessionCrmUser): Prisma.PartnerHandoverRequestWhereInput {
  const base: Prisma.PartnerHandoverRequestWhereInput = { state: "OPEN", lead: { deletedAt: null } };
  if (!u.isActive) return { id: "__no_access__" };
  return u.isOwner || u.role === "ADMIN" ? base : { ...base, partner: { managerUserId: u.id } };
}

/** OPEN requests visible to the user, oldest first. The downgrade marker is the rule on today's data. */
export async function listHandoverRequests(u: SessionCrmUser, now = new Date()): Promise<{ cards: HandoverRequestCard[]; total: number }> {
  const where = handoverVisibleWhere(u);
  const [rows, total] = await Promise.all([
    prisma.partnerHandoverRequest.findMany({
      where, orderBy: { createdAt: "asc" }, take: LIST_CAP,
      select: {
        id: true, leadId: true, note: true, createdAt: true, downgrade: true,
        partner: { select: PARTNER_SELECT },
        lead: {
          select: {
            firstName: true, lastName: true, status: true, partnerMode: true,
            deals: { where: { commissionStatus: { not: "CANCELLED" } }, select: { id: true }, take: 1 },
          },
        },
      },
    }),
    prisma.partnerHandoverRequest.count({ where }),
  ]);
  const cards = rows.map((r) => {
    const hasLiveDeal = r.lead.deals.length > 0;
    const status = r.lead.status;
    const downgrade = isLeadStatus(status) ? handoverPlan({ status, partnerMode: mode(r.lead.partnerMode), hasLiveDeal }).downgrade : r.downgrade;
    return {
      id: r.id, leadId: r.leadId, client: `${r.lead.firstName} ${r.lead.lastName}`.trim() || "Unnamed client",
      partner: partnerName(r.partner), stage: isLeadStatus(status) ? STATUS_LABEL[status] : status, note: r.note,
      createdAt: r.createdAt.toISOString(), age: ago(r.createdAt, now), downgrade, hasLiveDeal,
    };
  });
  return { cards, total };
}

export async function acceptHandover(actor: SessionCrmUser, requestId: string, keepFix: boolean): Promise<ReviewResult & { leadId?: string }> {
  try {
    const leadId = await prisma.$transaction(async (tx) => {
      const first = await tx.partnerHandoverRequest.findUnique({ where: { id: requestId }, select: { leadId: true, state: true, partner: { select: { managerUserId: true } } } });
      if (!first || first.state !== "OPEN") throw new Abort(HANDLED);
      if (!mayAcceptHandover(actor, first.partner.managerUserId)) throw new Abort(DENIED);
      // Same lock as movePartnerLead / requestHandover: a partner move, a withdrawal or a deal that lands meanwhile waits for us or is seen.
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${first.leadId} FOR UPDATE`;
      const [req, lead, deal] = await Promise.all([
        tx.partnerHandoverRequest.findUnique({
          where: { id: requestId },
          select: { id: true, state: true, leadId: true, claimId: true, partnerId: true, downgrade: true, partner: { select: PARTNER_SELECT } },
        }),
        tx.lead.findFirst({ where: { id: first.leadId, deletedAt: null }, select: { id: true, status: true, partnerMode: true, workedByPartner: true, assignedToId: true } }),
        liveDeal(tx, first.leadId),
      ]);
      if (!req || req.state !== "OPEN" || req.leadId !== first.leadId) throw new Abort(HANDLED);
      if (!mayAcceptHandover(actor, req.partner.managerUserId)) throw new Abort(DENIED);
      if (!lead) throw new Abort("The lead is in the trash or no longer exists.");
      if (keepFix && !mayKeepFix(!!deal)) throw new Abort(DEAL_FIXED_ERROR);

      // The plan on today's data, not the one stored at the request: a deal or a stage move since then counts.
      const current = mode(lead.partnerMode);
      const downgrade = isLeadStatus(lead.status)
        ? handoverPlan({ status: lead.status as LeadStatusValue, partnerMode: current, hasLiveDeal: !!deal }).downgrade
        : false;
      const target = acceptOutcome({ downgrade, keepFix });
      const finalMode = target ?? current;
      const now = new Date();

      // Conditional write: a withdrawal that landed first wins and this aborts.
      const r = await tx.partnerHandoverRequest.updateMany({
        where: { id: req.id, state: "OPEN" },
        data: {
          state: "ACCEPTED", acceptedById: actor.id, acceptedAt: now, downgrade,
          ...(keepFix ? { keepFix: true, keepFixById: actor.id, keepFixAt: now } : {}),
        },
      });
      if (r.count !== 1) throw new Abort(HANDLED);
      await tx.lead.update({
        where: { id: lead.id },
        data: { workedByPartner: false, assignedToId: actor.id, ...(target && target !== current ? { partnerMode: target } : {}) },
      });
      const who = partnerName(req.partner);
      const terms = target === "HANDOVER" ? "now Handover" : keepFix ? "Fix kept" : `stays ${finalMode ?? "unchanged"}`;
      // "Assigned to …" so Today's "Newly assigned" and the SLA rules see the new owner like any assignment.
      await tx.leadInteraction.create({
        data: {
          leadId: lead.id, type: "SYSTEM", channel: "SYSTEM", occurredAt: now,
          body: `Assigned to ${actor.name} (handover from partner ${who} accepted, ${terms})`,
          createdByUserId: actor.id, createdByName: actor.name,
          metadata: { kind: "handover_accepted", requestId: req.id, assignedToId: actor.id, downgrade, keepFix, partnerMode: finalMode },
        },
      });
      await writeAudit(actor, "partner_handover_accept", "partner_handover_request", req.id, {
        before: { state: "OPEN", partnerMode: current, workedByPartner: lead.workedByPartner, assignedToId: lead.assignedToId },
        after: { state: "ACCEPTED", partnerMode: finalMode, workedByPartner: false, assignedToId: actor.id },
        leadId: lead.id, downgrade, storedDowngrade: req.downgrade, keepFix,
      }, tx);
      await tx.partnerNotification.create({
        data: {
          kind: "STAGE", refKey: `handover:${req.id}:accepted`, partnerId: req.partnerId, claimId: req.claimId, leadId: lead.id,
          payload: { handover: "accepted", keepFix, downgraded: target === "HANDOVER" },
        },
      });
      return lead.id;
    });
    return { ok: true, leadId };
  } catch (e) {
    if (e instanceof Abort) return { error: e.message };
    throw e;
  }
}

/** The keep-FIX override after acceptance: keep → FIX, un-keep → HANDOVER (only after an early handover). */
export async function setKeepFix(actor: SessionCrmUser, leadId: string, keep: boolean): Promise<ReviewResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId} FOR UPDATE`;
      const [req, lead, deal] = await Promise.all([
        tx.partnerHandoverRequest.findFirst({
          where: { leadId, state: "ACCEPTED" },
          orderBy: { acceptedAt: "desc" },
          select: { id: true, claimId: true, partnerId: true, downgrade: true, keepFix: true, partner: { select: PARTNER_SELECT } },
        }),
        tx.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, partnerMode: true } }),
        liveDeal(tx, leadId),
      ]);
      if (!lead || !req) throw new Abort("This lead has no accepted handover.");
      if (!mayAcceptHandover(actor, req.partner.managerUserId)) throw new Abort("Only an admin or this partner's manager can change this.");
      if (!mayKeepFix(!!deal)) throw new Abort(DEAL_FIXED_ERROR);
      const current = mode(lead.partnerMode);
      const target = keepFixChange({ keep, currentMode: current, downgrade: req.downgrade });
      if (!target) throw new Abort(NOTHING_TO_CHANGE);
      const now = new Date();
      await tx.partnerHandoverRequest.update({ where: { id: req.id }, data: { keepFix: keep, keepFixById: actor.id, keepFixAt: now } });
      await tx.lead.update({ where: { id: lead.id }, data: { partnerMode: target } });
      const row = await tx.leadInteraction.create({
        data: {
          leadId: lead.id, type: "SYSTEM", channel: "SYSTEM", occurredAt: now,
          body: keep ? `Keep Fix set by ${actor.name}: partner ${partnerName(req.partner)} keeps the Fix share` : `Keep Fix removed by ${actor.name}: the client is Handover again`,
          createdByUserId: actor.id, createdByName: actor.name,
          metadata: { kind: "keep_fix_changed", requestId: req.id, keepFix: keep, partnerMode: target },
        },
        select: { id: true },
      });
      await writeAudit(actor, "partner_handover_keep_fix", "partner_handover_request", req.id, {
        before: { keepFix: req.keepFix, partnerMode: current }, after: { keepFix: keep, partnerMode: target }, leadId: lead.id,
      }, tx);
      await tx.partnerNotification.create({
        data: {
          kind: "STAGE", refKey: `handover:${req.id}:keepfix:${row.id}`, partnerId: req.partnerId, claimId: req.claimId, leadId: lead.id,
          payload: { handover: "keepFix", keepFix: keep },
        },
      });
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Abort) return { error: e.message };
    throw e;
  }
}

/** The cockpit's keep-FIX block: only for a lead with an accepted handover. */
export type KeepFixView = {
  partnerMode: PartnerModeValue | null; downgrade: boolean; keepFix: boolean; keptBy: string | null; keptAt: string | null;
  acceptedBy: string | null; acceptedAt: string | null; hasLiveDeal: boolean; canChange: boolean;
};

export async function loadKeepFixView(u: SessionCrmUser, leadId: string, partnerMode: string | null, hasLiveDeal: boolean): Promise<KeepFixView | null> {
  const req = await prisma.partnerHandoverRequest.findFirst({
    where: { leadId, state: "ACCEPTED" },
    orderBy: { acceptedAt: "desc" },
    select: {
      downgrade: true, keepFix: true, keepFixAt: true, acceptedAt: true,
      keepFixBy: { select: { name: true } }, acceptedBy: { select: { name: true } }, partner: { select: { managerUserId: true } },
    },
  });
  if (!req) return null;
  return {
    partnerMode: mode(partnerMode), downgrade: req.downgrade, keepFix: req.keepFix,
    keptBy: req.keepFixBy?.name ?? null, keptAt: req.keepFixAt?.toISOString() ?? null,
    acceptedBy: req.acceptedBy?.name ?? null, acceptedAt: req.acceptedAt?.toISOString() ?? null,
    hasLiveDeal, canChange: mayAcceptHandover(u, req.partner.managerUserId),
  };
}

// ── Escalation (crm-sla cron) ───────────────────────────────────────────────

export type HandoverEscalationResult = { reminded: number; escalated: number; errors: string[]; skipped?: string };

type Send = (chatId: string, html: string) => Promise<{ ok: boolean; description?: string }>;

/**
 * OPEN requests nobody answered: a reminder to the manager (fallback: owner) from 24 h, every active admin
 * and owner with a linked chat from 48 h. The stamp is a conditional claim written before the send (so two
 * runs never both send) and released again when every send failed, so the next run retries. With no chat
 * linked at all the stamp stays: nobody can be told, and the request still shows on Today/Inbox.
 */
export async function runHandoverEscalations(deps: {
  now: Date; siteUrl: string; send: Send; managerChat: (partnerId: string) => Promise<string | null>;
}): Promise<HandoverEscalationResult> {
  const { now } = deps;
  const out: HandoverEscalationResult = { reminded: 0, escalated: 0, errors: [] };
  const rows = await prisma.partnerHandoverRequest.findMany({
    where: { state: "OPEN", createdAt: { lte: new Date(now.getTime() - 24 * 3_600_000) }, OR: [{ remindedAt: null }, { escalatedAt: null }] },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true, leadId: true, partnerId: true, createdAt: true, remindedAt: true, escalatedAt: true,
      partner: { select: PARTNER_SELECT }, lead: { select: { firstName: true, lastName: true } },
    },
  });
  if (!rows.length) return out;
  let admins: string[] | null = null;
  for (const r of rows) {
    const due = escalationDue(r, now);
    if (!due) continue;
    const stamp = (v: Date | null) => (due === "remind" ? { remindedAt: v } : { escalatedAt: v });
    const claimed = await prisma.partnerHandoverRequest.updateMany({ where: { id: r.id, state: "OPEN", ...stamp(null) }, data: stamp(now) });
    if (claimed.count !== 1) continue;
    let chats: string[];
    if (due === "remind") {
      const c = await deps.managerChat(r.partnerId);
      chats = c ? [c] : [];
    } else {
      if (!admins) admins = (await prisma.user.findMany({
        where: { isActive: true, telegramChatId: { not: null }, OR: [{ isOwner: true }, { role: "ADMIN" }] },
        select: { telegramChatId: true },
      })).flatMap((u) => (u.telegramChatId ? [u.telegramChatId] : []));
      chats = admins;
    }
    const html = handoverEscalationHtml({
      kind: due, partnerName: partnerName(r.partner), client: `${r.lead.firstName} ${r.lead.lastName}`.trim() || "a client",
      hours: Math.floor((now.getTime() - r.createdAt.getTime()) / 3_600_000),
      url: `${deps.siteUrl.replace(/\/+$/, "")}/crm/leads/${encodeURIComponent(r.leadId)}`,
    });
    if (!chats.length) {
      // Nobody to tell: the stamp stays (retrying every run would not help) and the run is not failed.
      console.warn("[handover escalation] no Telegram chat linked; skipped", { requestId: r.id, due });
      continue;
    }
    let delivered = 0;
    for (const chatId of Array.from(new Set(chats))) {
      try {
        const s = await deps.send(chatId, html);
        if (s.ok) delivered++;
        else out.errors.push(`${r.id} ${due}: ${s.description ?? "send failed"}`);
      } catch (e) {
        out.errors.push(`${r.id} ${due}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (!delivered) {
      // Nothing went out: release the stamp so the next run tries again.
      await prisma.partnerHandoverRequest.updateMany({ where: { id: r.id, ...stamp(now) }, data: stamp(null) });
      continue;
    }
    if (due === "remind") out.reminded++;
    else out.escalated++;
  }
  return out;
}
