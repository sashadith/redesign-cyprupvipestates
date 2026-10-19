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
import { buildTelegramNotification, routeNotification, type TelegramNotificationInput } from "./telegram";
import { partnerBotConfigured, sendPartnerTelegram } from "./telegramApi";
import { PARTIAL_PREFIX, deliveryOutcome, permanentFallbackToEmail, telegramFailureResult, type ChannelResult, type DeliveryOutcome } from "./telegramBot";
import {
  INTERRUPTED_ERROR, SENDING_MARK, TransportStreak, beforeStart, buildClaimOutcomeEmail, buildMatchEmail, buildMessageEmail, buildPayoutEmail,
  buildPresentationOpenedEmail, buildStageEmail, buildTierUpEmail, clientLink, commissionsLink, deadWhere, dueWhere, firstNameOf, formatPayoutAmount, isUnchangedStage,
  stuckSendingWhere, messageIdFromRefKey, notificationGate, notifyStartFromEnv, optOutGate, partnerStatusGate, payoutDealIdFromRefKey,
  planStageNotifications, presentationsLink, stageKeyFor, stageRefKey, truncateError, unhandledKind, type NotificationKind, type StageRow,
} from "./notify";
import { MATCH_CHANGE_TYPES } from "./matchAlerts";
import { isOwnProjectUrl, localizedProjectUrl } from "./matchGlue";
import { parseTierUpPayload } from "./tierFlow";

export { notifyStartFromEnv };

const LOOKBACK_MS = 7 * 86_400_000;
const INTERACTION_CAP = 1000;
const CLAIM_SCAN_CAP = 5000;
/** Skip-counter keys for rows closed because Telegram failed permanently and no e-mail was allowed. */
const TELEGRAM_BLOCKED = "telegram blocked";
const TELEGRAM_REJECTED = "telegram rejected";

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

/** What to deliver for one row: e-mail and/or Telegram (routeNotification), plus an e-mail fallback for a permanent Telegram failure. */
type Delivery = {
  partnerId: string;
  email: { to: string; mail: BuiltEmail } | null;
  telegram: { chatId: string; html: string } | null;
  /** E-mail allowed for this row but not routed (the partner chose Telegram only): used when Telegram fails permanently (blocked, 4xx, not configured). */
  fallbackEmail: { to: string; mail: BuiltEmail } | null;
};
type Outcome = { skip: string } | Delivery;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

type OutboxRow = {
  id: string; kind: NotificationKind; refKey: string; partnerId: string; claimId: string | null; leadId: string | null;
  payload: unknown; createdAt: Date;
};

/** Decides what to do with one outbox row: a reason to drop it, or what to send on which channel(s). */
async function prepare(row: OutboxRow, now: Date, start: Date, base: string): Promise<Outcome> {
  if (beforeStart(row, start)) return { skip: "before start" };
  const partner = await prisma.partner.findUnique({
    where: { id: row.partnerId },
    select: {
      status: true, firstName: true, language: true, emailNotifications: true, notifyChannel: true, telegramChatId: true,
      users: { orderBy: { createdAt: "asc" }, take: 1, select: { email: true } },
    },
  });
  const partnerSkip = partnerStatusGate(partner?.status);
  if (partnerSkip || !partner) return { skip: partnerSkip ?? "partner missing" };
  const to = partner.users[0]?.email?.trim() || null;
  const chatId = partner.telegramChatId?.trim() || null;
  // Channel(s) per Decision 2. The profile switch (3d) suppresses STAGE/MESSAGE e-mail only, never Telegram.
  // Without the bot env no Telegram send is attempted: the row routes as if no chat were linked.
  const route = routeNotification({
    kind: row.kind, notifyChannel: partner.notifyChannel, chatLinked: !!chatId, botConfigured: partnerBotConfigured(),
    emailNotifications: partner.emailNotifications,
  });
  const emailAllowed = !!to && !optOutGate(row.kind, partner.emailNotifications);
  const sendEmailToo = route.email && !!to;
  const sendTelegram = route.telegram && !!chatId;
  if (!sendEmailToo && !sendTelegram) {
    // Switched off in the profile: the row is closed as sent with error "opted out" (never mailed later).
    const optedOut = optOutGate(row.kind, partner.emailNotifications);
    return { skip: optedOut ?? "no recipient" };
  }

  const claim = row.claimId
    ? await prisma.partnerClaim.findUnique({
        where: { id: row.claimId },
        select: { id: true, state: true, createdAt: true, reviewedAt: true, submission: true, partnerId: true, leadId: true },
      })
    : null;
  const accepted = obj(row.payload).accepted === true;
  // A rejection, a payout and a presentation-opened row never need the lead; everything else is gated on the claim's effective state.
  const needsState = !!claim && row.kind !== "PAYOUT" && row.kind !== "PRESENTATION_OPENED" && row.kind !== "TIER_UP" && !(row.kind === "CLAIM_OUTCOME" && !accepted);
  const skip = notificationGate({
    kind: row.kind,
    accepted,
    claim: claim
      ? { ownedByPartner: claim.partnerId === row.partnerId, effective: needsState ? await effectiveStateOf(prisma, claim, now) : claim.state }
      : null,
  });
  if (skip) return { skip };

  const locale = pickPartnerLocale({ partnerLanguage: partner.language });
  const deliver = (mail: BuiltEmail, tg: TelegramNotificationInput): Delivery => ({
    partnerId: row.partnerId,
    email: sendEmailToo && to ? { to, mail } : null,
    telegram: sendTelegram && chatId ? { chatId, html: buildTelegramNotification(locale, tg) } : null,
    fallbackEmail: !sendEmailToo && emailAllowed && to ? { to, mail } : null,
  });
  if (!claim && row.kind !== "PRESENTATION_OPENED" && row.kind !== "TIER_UP") return { skip: "claim missing" };
  // Every kind but PRESENTATION_OPENED and TIER_UP has a claim from here on (checked just above); those cases never read it.
  const own = claim as NonNullable<typeof claim>;
  const common = { partnerFirstName: partner.firstName, clientName: claim ? visibleName(claim) : "", link: claim ? clientLink(base, claim.id) : base };
  const tgCommon = { clientName: common.clientName, url: common.link, portalUrl: base };

  // Explicit per kind: a kind without a case is a compile error (unhandledKind), never another kind's mail.
  switch (row.kind) {
    case "STAGE": {
      const toStatus = obj(row.payload).toStatus;
      const stageKey = stageKeyFor(toStatus);
      if (!stageKey) return { skip: "invalid status" };
      const lastMailed = await prisma.partnerNotification.findFirst({
        where: {
          claimId: own.id, kind: "STAGE", sentAt: { not: null }, id: { not: row.id },
          OR: [{ error: null }, { error: { startsWith: PARTIAL_PREFIX } }],
        },
        orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
        select: { payload: true },
      });
      if (lastMailed && isUnchangedStage(toStatus, obj(lastMailed.payload).toStatus)) return { skip: "unchanged" };
      return deliver(buildStageEmail(locale, { ...common, stageKey }), { ...tgCommon, kind: "STAGE", stageKey });
    }
    case "MESSAGE": {
      const messageId = messageIdFromRefKey(row.refKey);
      const msg = messageId
        ? await prisma.partnerMessage.findUnique({
            where: { id: messageId },
            select: { partnerId: true, leadId: true, body: true, author: { select: { name: true } } },
          })
        : null;
      if (!msg || msg.partnerId !== row.partnerId || msg.leadId !== own.leadId) return { skip: "message missing" };
      return deliver(
        buildMessageEmail(locale, { ...common, body: msg.body, authorFirstName: firstNameOf(msg.author?.name) }),
        { ...tgCommon, kind: "MESSAGE", messageBody: msg.body },
      );
    }
    case "CLAIM_OUTCOME":
      return deliver(buildClaimOutcomeEmail(locale, { ...common, accepted }), { ...tgCommon, kind: "CLAIM_OUTCOME", accepted });
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
      if (!note || note.deal.leadId !== own.leadId || payoutDealIdFromRefKey(row.refKey) !== note.dealId) return { skip: "credit note missing" };
      const dev = note.deal.development;
      const amount = formatPayoutAmount(locale, note.totalAmount);
      return deliver(
        buildPayoutEmail(locale, {
          ...common,
          link: commissionsLink(base),
          project: dev ? dev.override?.alias?.trim() || dev.publicName : null,
          unit: note.deal.unitLabel,
          amount,
          creditNoteNumber: note.number,
        }),
        { ...tgCommon, kind: "PAYOUT", url: commissionsLink(base), amount, creditNoteNumber: note.number },
      );
    }
    case "MATCH": {
      // Gated above: partner ACTIVE and the claim still effectively ACTIVE (notificationGate).
      const p = obj(row.payload);
      const projectName = typeof p.projectName === "string" ? p.projectName.trim() : "";
      const changeType = typeof p.changeType === "string" && (MATCH_CHANGE_TYPES as readonly string[]).includes(p.changeType) ? p.changeType : null;
      const price = typeof p.priceFrom === "number" && Number.isFinite(p.priceFrom) && p.priceFrom > 0 ? p.priceFrom : null;
      if (!projectName || !changeType || !isOwnProjectUrl(p.url)) return { skip: "invalid payload" };
      const url = localizedProjectUrl(p.url, locale);
      return deliver(
        buildMatchEmail(locale, {
          partnerFirstName: partner.firstName, clientName: common.clientName, projectName, changeType, priceFrom: price, url, portalUrl: common.link,
        }),
        {
          ...tgCommon, kind: "MATCH", projectName, changeType, url, portalUrl: common.link,
          priceFrom: price != null ? formatPayoutAmount(locale, price) : null,
        },
      );
    }
    case "PRESENTATION_OPENED": {
      // Gated on the partner only. The client name the presentation was made for comes from the producer's payload.
      const raw = obj(row.payload).clientName;
      const clientName = typeof raw === "string" ? raw.trim().slice(0, 120) : "";
      const link = presentationsLink(base);
      return deliver(
        buildPresentationOpenedEmail(locale, { partnerFirstName: partner.firstName, clientName, link }),
        { kind: "PRESENTATION_OPENED", clientName, url: link, portalUrl: base },
      );
    }
    case "TIER_UP": {
      // Gated on the partner only (ACTIVE, above); no claim. The tier and shares come from the CRM Accept's payload.
      const tier = parseTierUpPayload(row.payload);
      if (!tier) return { skip: "invalid payload" };
      const link = commissionsLink(base);
      return deliver(
        buildTierUpEmail(locale, { partnerFirstName: partner.firstName, tierName: tier.tierName, handoverShare: tier.handoverShare, fixShare: tier.fixShare, portalUrl: link }),
        { kind: "TIER_UP", tierName: tier.tierName, handoverShare: tier.handoverShare, fixShare: tier.fixShare, url: link, portalUrl: base },
      );
    }
    default:
      return unhandledKind(row.kind);
  }
}

/**
 * Sends one prepared row on its channel(s). A permanent Telegram failure (classifyTelegramFailure: blocked
 * chat, other 4xx except 429, bot not configured) e-mails the row instead when allowed; a blocked chat is
 * also unlinked — only if it is still the partner's chat.
 */
async function deliverRow(d: Delivery, refKey: string, errors: string[]): Promise<DeliveryOutcome> {
  const results: { email?: ChannelResult; telegram?: ChannelResult } = {};
  if (d.telegram) {
    const r = await sendPartnerTelegram(d.telegram.chatId, d.telegram.html);
    results.telegram = r.ok ? { ok: true } : telegramFailureResult(truncateError(`${r.status} ${r.description}`), r.failure);
    if (!r.ok && r.failure === "blocked") {
      await prisma.partner
        .updateMany({
          where: { id: d.partnerId, telegramChatId: d.telegram.chatId },
          data: { telegramChatId: null, telegramLinkedAt: null, notifyChannel: "EMAIL" },
        })
        .catch((e) => errors.push(`${refKey}: could not unlink blocked chat: ${truncateError(e)}`));
    }
  }
  const tg = results.telegram;
  const telegramPermanent = !!tg && !tg.ok && tg.permanent === true;
  const email = d.email ?? (permanentFallbackToEmail({ telegramPermanent, emailAttempted: false, emailAllowed: !!d.fallbackEmail }) ? d.fallbackEmail : null);
  if (email) {
    try {
      await sendEmail({ to: email.to, subject: email.mail.subject, text: email.mail.text, html: email.mail.html });
      results.email = { ok: true };
    } catch (e) {
      results.email = { ok: false, error: truncateError(e), transport: true };
    }
  }
  return deliveryOutcome(results);
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
 * Delivery goes to the partner's channel(s) (deliverRow): sent when at least one channel succeeded; a row
 * whose every channel failed permanently (blocked chat, Telegram 4xx, bot not configured, no e-mail allowed)
 * is closed. When no channel got through, the row is released as above. Only shared transport failures
 * (mail transport, Telegram 5xx/429/network/timeout) feed the breaker: three in a row stop the batch
 * without charging those rows; any other failure is charged an attempt at once and never stops the batch.
 * Rows left at "sending" for over an hour (a run died mid-send) are first released as a failed attempt.
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
    const out = await deliverRow(o, row.refKey, result.errors);
    if (out.state === "closed") {
      // Nothing went out and nothing can (Telegram failed permanently, no e-mail allowed): done, with the reason.
      await prisma.partnerNotification
        .update({ where: { id: row.id }, data: { sentAt: new Date(), error: truncateError(out.error) } })
        .catch((e) => result.errors.push(`${row.refKey}: could not record outcome: ${truncateError(e)}`));
      const key = out.blocked ? TELEGRAM_BLOCKED : TELEGRAM_REJECTED;
      result.skipped[key] = (result.skipped[key] ?? 0) + 1;
      continue;
    }
    if (out.state === "failed") {
      if (!out.transport) {
        // Not a shared outage: charge the attempt now (normal backoff); the breaker is not involved.
        await release(row, truncateError(out.error), true);
        continue;
      }
      await release(row, truncateError(out.error), false);
      if (streak.fail(row.id)) {
        tripped = true;
        result.stoppedEarly = "delivery transport failing";
        break;
      }
      continue;
    }
    result.sent++;
    if (out.error) result.errors.push(`${row.refKey}: ${out.error}`);
    await charge(streak.succeed());
    // It went out on at least one channel: a failure to clear the marker must not turn into a resend.
    try {
      await prisma.partnerNotification.update({ where: { id: row.id }, data: { sentAt: new Date(), error: out.error ? truncateError(out.error) : null } });
    } catch (e) {
      console.error("[partner-notify] sent but could not mark", row.refKey, truncateError(e));
    }
  }
  await charge(streak.finish(tripped));
  return result;
}
