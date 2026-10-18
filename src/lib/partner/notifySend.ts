// Partner notification outbox — server half (collect STATUS_CHANGE events, send pending rows).
// Pure builders and the planner: notify.ts. Cron entry: src/app/api/cron/partner-notify/route.ts.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/sendEmail";
import { REAL_CONTACT_TYPES } from "./claims";
import { displayState, visibleName } from "./clientDto";
import { pickPartnerLocale } from "./i18n";
import { partnerBaseUrl, type BuiltEmail } from "./mail";
import {
  MAX_ATTEMPTS, buildClaimOutcomeEmail, buildMessageEmail, buildStageEmail, clientLink, firstNameOf,
  messageIdFromRefKey, notifyStartFromEnv, planStageNotifications, stageKeyFor, stageRefKey, truncateError, type StageRow,
} from "./notify";

export { notifyStartFromEnv };

const LOOKBACK_MS = 7 * 86_400_000;
const INTERACTION_CAP = 1000;
const CLAIM_SCAN_CAP = 5000;

export type CollectResult = { scanned: number; pending: number; collapsed: number; settlingLeads: number; inserted: number };

/** Scans recent STATUS_CHANGE rows on leads with an ACTIVE claim and writes STAGE outbox rows. */
export async function collectStageEvents(now: Date, start: Date): Promise<CollectResult> {
  const since = new Date(Math.max(start.getTime(), now.getTime() - LOOKBACK_MS));
  const claims = await prisma.partnerClaim.findMany({
    where: { state: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: CLAIM_SCAN_CAP,
    select: { id: true, leadId: true, partnerId: true, createdAt: true },
  });
  if (claims.length === 0) return { scanned: 0, pending: 0, collapsed: 0, settlingLeads: 0, inserted: 0 };
  const claimByLead = new Map(claims.map((c) => [c.leadId, c]));

  const interactions = await prisma.leadInteraction.findMany({
    where: { type: "STATUS_CHANGE", leadId: { in: Array.from(claimByLead.keys()) }, occurredAt: { gte: since } },
    orderBy: { occurredAt: "desc" }, // the cap drops the oldest, never the newest
    take: INTERACTION_CAP,
    select: { id: true, leadId: true, occurredAt: true, metadata: true },
  });
  if (interactions.length === 0) return { scanned: 0, pending: 0, collapsed: 0, settlingLeads: 0, inserted: 0 };

  const rows: StageRow[] = interactions.flatMap((i) => {
    const c = claimByLead.get(i.leadId);
    if (!c) return [];
    const meta = i.metadata && typeof i.metadata === "object" && !Array.isArray(i.metadata) ? (i.metadata as Record<string, unknown>) : {};
    return [{
      interactionId: i.id, leadId: i.leadId, occurredAt: i.occurredAt, toStatus: meta.toStatus,
      claimId: c.id, partnerId: c.partnerId, claimCreatedAt: c.createdAt,
    }];
  });
  const existing = await prisma.partnerNotification.findMany({
    where: { refKey: { in: rows.map((r) => stageRefKey(r.interactionId)) } },
    select: { refKey: true },
  });
  const plan = planStageNotifications({ rows, existingRefKeys: existing.map((e) => e.refKey), now, start });
  let inserted = 0;
  if (plan.rows.length) {
    const r = await prisma.partnerNotification.createMany({
      data: plan.rows.map((p) => ({
        kind: p.kind, refKey: p.refKey, partnerId: p.partnerId, leadId: p.leadId, claimId: p.claimId,
        payload: p.payload, sentAt: p.sentAt, error: p.error,
      })),
      skipDuplicates: true,
    });
    inserted = r.count;
  }
  return { scanned: rows.length, pending: plan.pending, collapsed: plan.collapsed, settlingLeads: plan.settlingLeads, inserted };
}

export type SendResult = { sent: number; skipped: Record<string, number>; failed: number; errors: string[] };

type Outcome = { skip: string } | { mail: BuiltEmail; to: string };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Decides what to do with one outbox row: a reason to drop it, or the mail to send. */
async function prepare(
  row: { id: string; kind: "STAGE" | "MESSAGE" | "CLAIM_OUTCOME"; refKey: string; partnerId: string; claimId: string | null; leadId: string | null; payload: unknown },
  now: Date,
  base: string,
): Promise<Outcome> {
  const partner = await prisma.partner.findUnique({
    where: { id: row.partnerId },
    select: {
      status: true, firstName: true, language: true,
      users: { orderBy: { createdAt: "asc" }, take: 1, select: { email: true } },
    },
  });
  if (!partner) return { skip: "partner missing" };
  if (partner.status === "SUSPENDED") return { skip: "suspended" };
  if (partner.status !== "ACTIVE") return { skip: "pending" };
  const to = partner.users[0]?.email?.trim();
  if (!to) return { skip: "no recipient" };

  const claim = row.claimId
    ? await prisma.partnerClaim.findUnique({
        where: { id: row.claimId },
        select: {
          id: true, state: true, createdAt: true, submission: true, partnerId: true, leadId: true,
          lead: { select: { id: true, status: true, deletedAt: true } },
        },
      })
    : null;
  if (!claim || claim.partnerId !== row.partnerId) return { skip: row.kind === "CLAIM_OUTCOME" ? "claim missing" : "claim inactive" };
  if (row.kind !== "CLAIM_OUTCOME" && claim.state !== "ACTIVE") return { skip: "claim inactive" };
  if (!claim.lead || claim.lead.deletedAt) return { skip: "lead trashed" };

  const locale = pickPartnerLocale({ partnerLanguage: partner.language });
  const common = { partnerFirstName: partner.firstName, clientName: visibleName(claim), link: clientLink(base, claim.id) };

  if (row.kind === "STAGE") {
    const stageKey = stageKeyFor(obj(row.payload).toStatus);
    if (!stageKey) return { skip: "invalid status" };
    const [last, liveDeals] = await Promise.all([
      prisma.leadInteraction.aggregate({
        where: { leadId: claim.leadId, type: { in: [...REAL_CONTACT_TYPES] } },
        _max: { occurredAt: true },
      }),
      prisma.deal.count({ where: { leadId: claim.leadId, commissionStatus: { not: "CANCELLED" } } }),
    ]);
    const state = displayState(
      { state: claim.state, createdAt: claim.createdAt, lead: claim.lead },
      last._max.occurredAt ?? null, now, liveDeals > 0,
    );
    if (state === "EXPIRED") return { skip: "protection ended" };
    if (state !== "ACTIVE") return { skip: "claim inactive" };
    return { to, mail: buildStageEmail(locale, { ...common, stageKey }) };
  }

  if (row.kind === "MESSAGE") {
    const messageId = messageIdFromRefKey(row.refKey);
    const msg = messageId
      ? await prisma.partnerMessage.findUnique({
          where: { id: messageId },
          select: { partnerId: true, leadId: true, body: true, author: { select: { name: true } } },
        })
      : null;
    if (!msg || msg.partnerId !== row.partnerId || msg.leadId !== claim.leadId) return { skip: "message missing" };
    return { to, mail: buildMessageEmail(locale, { ...common, body: msg.body, authorFirstName: firstNameOf(msg.author?.name) }) };
  }

  return { to, mail: buildClaimOutcomeEmail(locale, { ...common, accepted: obj(row.payload).accepted === true }) };
}

/** Sends up to `limit` pending outbox rows, oldest first. sentAt is set only after a successful send. */
export async function sendPendingNotifications(now: Date, limit = 50): Promise<SendResult> {
  const result: SendResult = { sent: 0, skipped: {}, failed: 0, errors: [] };
  const rows = await prisma.partnerNotification.findMany({
    where: { sentAt: null, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, kind: true, refKey: true, partnerId: true, claimId: true, leadId: true, payload: true, attempts: true },
  });
  if (rows.length === 0) return result;
  const base = partnerBaseUrl(); // throws in production without PARTNER_HOST — never mail a localhost link

  for (const row of rows) {
    try {
      const o = await prepare(row, now, base);
      if ("skip" in o) {
        await prisma.partnerNotification.update({ where: { id: row.id }, data: { sentAt: now, error: o.skip } });
        result.skipped[o.skip] = (result.skipped[o.skip] ?? 0) + 1;
        continue;
      }
      await sendEmail({ to: o.to, subject: o.mail.subject, text: o.mail.text, html: o.mail.html });
      await prisma.partnerNotification.update({ where: { id: row.id }, data: { sentAt: new Date(), error: null } });
      result.sent++;
    } catch (e) {
      const error = truncateError(e);
      result.failed++;
      result.errors.push(`${row.refKey}: ${error}`);
      await prisma.partnerNotification
        .update({ where: { id: row.id }, data: { attempts: { increment: 1 }, failedAt: new Date(), error } })
        .catch((e2) => result.errors.push(`${row.refKey}: could not record failure: ${truncateError(e2)}`));
    }
  }
  return result;
}
