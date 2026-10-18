// Partner notification outbox — server half (collect STATUS_CHANGE events, send pending rows).
// Pure builders and the planner: notify.ts. Cron entry: src/app/api/cron/partner-notify/route.ts.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/sendEmail";
import { effectiveStateOf } from "./claimFacts";
import { activeSince } from "./claimState";
import { visibleName } from "./clientDto";
import { creditNoteWhere } from "./commissions";
import { pickPartnerLocale } from "./i18n";
import { partnerBaseUrl, type BuiltEmail } from "./mail";
import {
  INTERRUPTED_ERROR, SENDING_MARK, TransportStreak, beforeStart, buildClaimOutcomeEmail, buildMessageEmail, buildPayoutEmail, buildStageEmail, clientLink,
  commissionsLink, deadWhere, dueWhere, firstNameOf, formatPayoutAmount, isUnchangedStage, stuckSendingWhere, messageIdFromRefKey, notificationGate,
  NOT_IMPLEMENTED_ERROR, NOT_IMPLEMENTED_KINDS, notifyStartFromEnv, optOutGate, payoutDealIdFromRefKey, planStageNotifications, stageKeyFor, stageRefKey, truncateError, unhandledKind, type NotificationKind, type StageRow,
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
    select: { id: true, leadId: true, partnerId: true, createdAt: true, reviewedAt: true },
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
      claimId: c.id, partnerId: c.partnerId, claimActiveSince: activeSince(c),
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

export type SendResult = { sent: number; skipped: Record<string, number>; failed: number; dead: number; errors: string[]; stoppedEarly?: string };

type Outcome = { skip: string } | { mail: BuiltEmail; to: string };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

type OutboxRow = {
  id: string; kind: NotificationKind; refKey: string; partnerId: string; claimId: string | null; leadId: string | null;
  payload: unknown; createdAt: Date;
};

/** Decides what to do with one outbox row: a reason to drop it, or the mail to send. */
async function prepare(row: OutboxRow, now: Date, start: Date, base: string): Promise<Outcome> {
  if (beforeStart(row, start)) return { skip: "before start" };
  if (NOT_IMPLEMENTED_KINDS.includes(row.kind)) return { skip: NOT_IMPLEMENTED_ERROR }; // before any gate: no claim/partner lookups
  const partner = await prisma.partner.findUnique({
    where: { id: row.partnerId },
    select: {
      status: true, firstName: true, language: true, emailNotifications: true,
      users: { orderBy: { createdAt: "asc" }, take: 1, select: { email: true } },
    },
  });
  if (!partner) return { skip: "partner missing" };
  if (partner.status === "SUSPENDED") return { skip: "suspended" };
  if (partner.status !== "ACTIVE") return { skip: "pending" };
  const to = partner.users[0]?.email?.trim();
  if (!to) return { skip: "no recipient" };
  // Switched off in the profile: the row is closed as sent with error "opted out" (never mailed later).
  const optedOut = optOutGate(row.kind, partner.emailNotifications);
  if (optedOut) return { skip: optedOut };

  const claim = row.claimId
    ? await prisma.partnerClaim.findUnique({
        where: { id: row.claimId },
        select: { id: true, state: true, createdAt: true, reviewedAt: true, submission: true, partnerId: true, leadId: true },
      })
    : null;
  const accepted = obj(row.payload).accepted === true;
  // A rejection and a payout never need the lead; everything else is gated on the claim's effective state.
  const needsState = !!claim && row.kind !== "PAYOUT" && !(row.kind === "CLAIM_OUTCOME" && !accepted);
  const skip = notificationGate({
    kind: row.kind,
    accepted,
    claim: claim
      ? { ownedByPartner: claim.partnerId === row.partnerId, effective: needsState ? await effectiveStateOf(prisma, claim, now) : claim.state }
      : null,
  });
  if (skip || !claim) return { skip: skip ?? "claim missing" };

  const locale = pickPartnerLocale({ partnerLanguage: partner.language });
  const common = { partnerFirstName: partner.firstName, clientName: visibleName(claim), link: clientLink(base, claim.id) };

  // Explicit per kind: a kind without a case is a compile error (unhandledKind), never another kind's mail.
  switch (row.kind) {
    case "STAGE": {
      const toStatus = obj(row.payload).toStatus;
      const stageKey = stageKeyFor(toStatus);
      if (!stageKey) return { skip: "invalid status" };
      const lastMailed = await prisma.partnerNotification.findFirst({
        where: { claimId: claim.id, kind: "STAGE", sentAt: { not: null }, error: null, id: { not: row.id } },
        orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
        select: { payload: true },
      });
      if (lastMailed && isUnchangedStage(toStatus, obj(lastMailed.payload).toStatus)) return { skip: "unchanged" };
      return { to, mail: buildStageEmail(locale, { ...common, stageKey }) };
    }
    case "MESSAGE": {
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
    case "CLAIM_OUTCOME":
      return { to, mail: buildClaimOutcomeEmail(locale, { ...common, accepted }) };
    case "PAYOUT": {
      const creditNoteId = obj(row.payload).creditNoteId;
      const note = typeof creditNoteId === "string" && creditNoteId
        ? await prisma.creditNote.findFirst({
            where: creditNoteWhere(row.partnerId, creditNoteId),
            select: {
              number: true, totalAmount: true, dealId: true,
              deal: { select: { leadId: true, unitLabel: true, development: { select: { publicName: true, override: { select: { alias: true } } } } } },
            },
          })
        : null;
      if (!note || note.deal.leadId !== claim.leadId || payoutDealIdFromRefKey(row.refKey) !== note.dealId) return { skip: "credit note missing" };
      const dev = note.deal.development;
      return {
        to,
        mail: buildPayoutEmail(locale, {
          ...common,
          link: commissionsLink(base),
          project: dev ? dev.override?.alias?.trim() || dev.publicName : null,
          unit: note.deal.unitLabel,
          amount: formatPayoutAmount(locale, note.totalAmount),
          creditNoteNumber: note.number,
        }),
      };
    }
    case "MATCH":
    case "PRESENTATION_OPENED":
      return { skip: NOT_IMPLEMENTED_ERROR }; // Tasks 3-5 implement these; never fall through to another kind's builder
    default:
      return unhandledKind(row.kind);
  }
}

/** Advisory-lock key of the partner-notify run ("PNOT"). */
const NOTIFY_LOCK_KEY = 0x504e4f54;
const LOCK_HOLD_MS = 15 * 60_000;

/**
 * Runs fn while holding the partner-notify advisory lock; null when another run holds it.
 * The lock is transaction-scoped (pg_try_advisory_xact_lock) on a connection pinned by an otherwise idle
 * interactive transaction: a session lock taken through Prisma's pool could be released on a different
 * connection and stay held forever. Commit/rollback (also a crash) releases it. fn itself uses the
 * normal client; per-row claiming (sendPendingNotifications) stays correct even without the lock.
 */
export async function withNotifyLock<T>(fn: () => Promise<T>): Promise<T | null> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${NOTIFY_LOCK_KEY}::bigint) AS locked`;
      if (!rows[0]?.locked) return null;
      return fn();
    },
    { maxWait: 10_000, timeout: LOCK_HOLD_MS },
  );
}

/**
 * Sends up to `limit` due outbox rows, oldest first (call inside withNotifyLock).
 * Each row is claimed with a guarded update (sentAt: null → now, error "sending") before anything is
 * mailed, so two runs can never mail the same row. A failed send releases the row (sentAt null,
 * failedAt, error) and charges an attempt; due again after the backoff (retryAt), up to MAX_ATTEMPTS.
 * Three consecutive transport errors stop the batch without charging those rows. Rows left at "sending"
 * for over an hour (a run died mid-send) are first released as a failed attempt.
 */
export async function sendPendingNotifications(now: Date, start: Date, limit = 50): Promise<SendResult> {
  const result: SendResult = { sent: 0, skipped: {}, failed: 0, dead: 0, errors: [] };
  // A run that died after claiming a row left it at "sending": release it as a failed attempt (it may or
  // may not have been mailed — at most one duplicate, against a lost mail), then backoff/dead apply as usual.
  const recovered = await prisma.partnerNotification.updateMany({
    where: stuckSendingWhere(now),
    data: { sentAt: null, attempts: { increment: 1 }, failedAt: now, error: INTERRUPTED_ERROR },
  });
  if (recovered.count) result.errors.push(`recovered ${recovered.count} row(s) interrupted while sending`);
  const [rows, dead] = await Promise.all([
    prisma.partnerNotification.findMany({
      where: dueWhere(now),
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true, kind: true, refKey: true, partnerId: true, claimId: true, leadId: true, payload: true, createdAt: true },
    }),
    prisma.partnerNotification.count({ where: deadWhere() }),
  ]);
  result.dead = dead;
  if (rows.length === 0) return result;
  const base = partnerBaseUrl(); // throws in production without PARTNER_HOST — never mail a localhost link

  const streak = new TransportStreak();
  const charge = async (ids: string[]) => {
    if (!ids.length) return;
    await prisma.partnerNotification
      .updateMany({ where: { id: { in: ids }, sentAt: null }, data: { attempts: { increment: 1 } } })
      .catch((e) => result.errors.push(`could not count attempts: ${truncateError(e)}`));
  };
  const release = async (row: OutboxRow, error: string, countAttempt: boolean) => {
    result.failed++;
    result.errors.push(`${row.refKey}: ${error}`);
    await prisma.partnerNotification
      .update({
        where: { id: row.id },
        data: { sentAt: null, failedAt: new Date(), error, ...(countAttempt ? { attempts: { increment: 1 } } : {}) },
      })
      .catch((e2) => result.errors.push(`${row.refKey}: could not record failure: ${truncateError(e2)}`));
  };

  let tripped = false;
  for (const row of rows) {
    const claimed = await prisma.partnerNotification.updateMany({ where: { id: row.id, sentAt: null }, data: { sentAt: new Date(), error: SENDING_MARK } /* claim time, not run start: stuck-row recovery measures from here */ });
    if (claimed.count !== 1) continue; // another run took it

    let o: Outcome;
    try {
      o = await prepare(row, now, start, base);
    } catch (e) {
      await release(row, truncateError(e), true);
      continue;
    }
    if ("skip" in o) {
      await prisma.partnerNotification
        .update({ where: { id: row.id }, data: { error: o.skip } })
        .catch((e) => result.errors.push(`${row.refKey}: could not record skip: ${truncateError(e)}`));
      result.skipped[o.skip] = (result.skipped[o.skip] ?? 0) + 1;
      continue;
    }
    try {
      await sendEmail({ to: o.to, subject: o.mail.subject, text: o.mail.text, html: o.mail.html });
    } catch (e) {
      await release(row, truncateError(e), false);
      if (streak.fail(row.id)) {
        tripped = true;
        result.stoppedEarly = "mail transport failing";
        break;
      }
      continue;
    }
    result.sent++;
    await charge(streak.succeed());
    // The mail went out: a failure to clear the marker must not turn into a resend.
    try {
      await prisma.partnerNotification.update({ where: { id: row.id }, data: { sentAt: new Date(), error: null } });
    } catch (e) {
      console.error("[partner-notify] sent but could not mark", row.refKey, truncateError(e));
    }
  }
  await charge(streak.finish(tripped));
  return result;
}
