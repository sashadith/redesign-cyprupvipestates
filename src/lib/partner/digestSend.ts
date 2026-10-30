// Weekly partner digest — server half (candidates, per-partner content, send, log).
// Pure content/planning: digest.ts. Cron entry: src/app/api/cron/partner-digest/route.ts.
// Isolation: every read for a recipient goes through partnerId-scoped functions (scope.ts); the only
// partner-neutral input is the list of recently published projects, priced per recipient.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/sendEmail";
import {
  DIGEST_NOTHING_NEW, DIGEST_NO_RECIPIENT, DIGEST_SENDING, DIGEST_TERMINAL_ERRORS, buildDigestEmail, buildDigestTelegram, digestCandidates, digestChannels,
  digestContent, digestLogAction, digestProfileLink, digestStartFromEnv, digestTotals, isoWeekKey, newProjectUrl,
} from "./digest";
import { pickPartnerLocale } from "./i18n";
import { emailThemeForPartner } from "@/lib/design/store";
import { partnerBaseUrl } from "./mail";
import { TRANSPORT_BREAKER, truncateError } from "./notify";
import { partnerBotConfigured, sendPartnerTelegram } from "./telegramApi";
import { inQuietHours, quietWindow } from "./notifyPrefs";
import { myCommissions, myRecentMilestones, projectRates, recentlyPublishedProjects, type PublishedProjects } from "./scope";

export { digestStartFromEnv };

const WINDOW_MS = 7 * 86_400_000;
const DIGEST_QUIET = "quiet hours";

export type DigestResult = {
  weekKey: string;
  candidates: number;
  sent: number;
  skipped: Record<string, number>;
  failed: number;
  errors: string[];
  stoppedEarly?: string;
};

/** Advisory-lock key of the partner-digest run ("PDIG"). */
const DIGEST_LOCK_KEY = 0x50444947;
const LOCK_HOLD_MS = 30 * 60_000;

/**
 * Runs fn while holding the partner-digest advisory lock; null when another run holds it. Same pattern as
 * withNotifyLock: a transaction-scoped lock on a connection pinned by an otherwise idle interactive
 * transaction (commit/rollback, also a crash, releases it). The per-row claim stays correct without it.
 */
export async function withDigestLock<T>(fn: () => Promise<T>): Promise<T | null> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${DIGEST_LOCK_KEY}::bigint) AS locked`;
      if (!rows[0]?.locked) return null;
      return fn();
    },
    { maxWait: 10_000, timeout: LOCK_HOLD_MS },
  );
}

const isUniqueViolation = (e: unknown) => !!e && typeof e === "object" && (e as { code?: unknown }).code === "P2002";

type Candidate = {
  id: string; status: string; digestOptIn: boolean; createdAt: Date; firstName: string; language: string;
  handoverShare: unknown; fixShare: unknown; trustMode: boolean; notifyChannel: string; telegramChatId: string | null;
  quietFrom: number | null; quietTo: number | null;
  users: { email: string }[];
  digestLogs: { id: string; weekKey: string; sentAt: Date | null; error: string | null }[];
};

/**
 * Sends this ISO week's digest to up to `limit` partners (call inside withDigestLock). Nothing happens
 * before `start` (PARTNER_DIGEST_START). Per partner: the week's log row is claimed first — a unique
 * insert (P2002 = another run has it) or, after an earlier failure, a guarded update — then the
 * content is built from the last 7 days; no updates and no new projects → "nothing new", no verified user → "no recipient"
 * (both terminal for the week); a send sets sentAt; a failure stores the error (retried next run).
 * Three consecutive transport errors stop the batch.
 */
export async function sendWeeklyDigests(now: Date, start: Date, limit = 200): Promise<DigestResult> {
  const weekKey = isoWeekKey(now);
  const result: DigestResult = { weekKey, candidates: 0, sent: 0, skipped: {}, failed: 0, errors: [] };
  if (now.getTime() < start.getTime()) {
    result.skipped["before start"] = 1;
    return result;
  }
  const skip = (reason: string) => (result.skipped[reason] = (result.skipped[reason] ?? 0) + 1);

  const rows: Candidate[] = await prisma.partner.findMany({
    where: {
      status: "ACTIVE",
      digestOptIn: true,
      createdAt: { lt: now },
      digestLogs: {
        none: { weekKey, OR: [{ sentAt: { not: null } }, { error: { in: [...DIGEST_TERMINAL_ERRORS, DIGEST_SENDING] } }] },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true, status: true, digestOptIn: true, createdAt: true, firstName: true, language: true,
      handoverShare: true, fixShare: true, trustMode: true, notifyChannel: true, telegramChatId: true, quietFrom: true, quietTo: true,
      users: { where: { emailVerifiedAt: { not: null } }, orderBy: { createdAt: "asc" }, take: 1, select: { email: true } },
      digestLogs: { where: { weekKey }, take: 1, select: { id: true, weekKey: true, sentAt: true, error: true } },
    },
  });
  const candidates = digestCandidates(rows, weekKey, now);
  result.candidates = candidates.length;
  if (!candidates.length) return result;

  const base = partnerBaseUrl(); // throws in production without PARTNER_HOST — never mail a localhost link
  const since = new Date(now.getTime() - WINDOW_MS);
  const published: PublishedProjects = await recentlyPublishedProjects(now, since);

  const fail = async (logId: string, partnerId: string, e: unknown) => {
    const error = truncateError(e) || "failed";
    result.failed++;
    result.errors.push(`${partnerId}: ${error}`);
    await prisma.partnerDigestLog
      .update({ where: { id: logId }, data: { sentAt: null, error } })
      .catch((e2) => result.errors.push(`${partnerId}: could not record failure: ${truncateError(e2)}`));
  };
  const close = async (logId: string, partnerId: string, reason: string) => {
    skip(reason);
    await prisma.partnerDigestLog
      .update({ where: { id: logId }, data: { error: reason } })
      .catch((e) => result.errors.push(`${partnerId}: could not record skip: ${truncateError(e)}`));
  };

  let streak = 0;
  for (const p of candidates) {
    const existing = p.digestLogs[0] ?? null;
    const action = digestLogAction(existing);
    if (action === "skip") {
      skip("already handled");
      continue;
    }
    let logId: string;
    if (action === "create") {
      try {
        logId = (await prisma.partnerDigestLog.create({ data: { partnerId: p.id, weekKey, error: DIGEST_SENDING }, select: { id: true } })).id;
      } catch (e) {
        if (isUniqueViolation(e)) {
          skip("taken by another run");
          continue;
        }
        result.failed++;
        result.errors.push(`${p.id}: could not claim: ${truncateError(e)}`);
        continue;
      }
    } else {
      const claimed = await prisma.partnerDigestLog.updateMany({
        where: { id: existing!.id, sentAt: null, error: existing!.error },
        data: { error: DIGEST_SENDING },
      });
      if (claimed.count !== 1) {
        skip("taken by another run");
        continue;
      }
      logId = existing!.id;
    }

    let mail: ReturnType<typeof buildDigestEmail>;
    let tgHtml: string | null = null;
    let to: string | null;
    let channels: { email: boolean; telegram: boolean };
    try {
      to = p.users[0]?.email?.trim() || null;
      // v2: the summary follows notifyChannel (EMAIL → mail, TELEGRAM → Telegram, BOTH → both).
      channels = digestChannels({ notifyChannel: p.notifyChannel, chatLinked: !!p.telegramChatId, botConfigured: partnerBotConfigured(), hasEmail: !!to });
      if (!channels.email && !channels.telegram) {
        await close(logId, p.id, DIGEST_NO_RECIPIENT);
        continue;
      }
      // Telegram quiet hours: the whole summary waits for a later run this week (crontab runs hourly on
      // Monday mornings); "quiet hours" is not terminal, so digestLogAction retries it.
      if (channels.telegram && inQuietHours(now, quietWindow(p.quietFrom, p.quietTo))) {
        skip(DIGEST_QUIET);
        await prisma.partnerDigestLog
          .update({ where: { id: logId }, data: { error: DIGEST_QUIET } })
          .catch((e) => result.errors.push(`${p.id}: could not record quiet hours: ${truncateError(e)}`));
        continue;
      }
      const locale = pickPartnerLocale({ partnerLanguage: p.language });
      const [milestones, commissions] = await Promise.all([
        myRecentMilestones(p.id, now, since),
        myCommissions(p.id, { from: null, to: null }),
      ]);
      const shares = { handoverShare: Number(p.handoverShare), fixShare: Number(p.fixShare), trustMode: false };
      const publishedAt = new Map(published.rows.map((r) => [r.id, r.publishedAt]));
      const content = digestContent({
        updates: milestones.map((m) => ({ clientName: m.name, key: m.key, at: m.at })),
        totals: digestTotals(commissions.totals),
        newProjects: projectRates(published.rows, published.rates, shares).map((pr) => ({
          name: pr.name, town: pr.town, handoverRate: pr.handoverRate, url: newProjectUrl(locale, pr.slug!),
          publishedAt: publishedAt.get(pr.id) ?? now,
        })),
      });
      if (!content) {
        await close(logId, p.id, DIGEST_NOTHING_NEW);
        continue;
      }
      mail = buildDigestEmail(locale, {
        partnerFirstName: p.firstName,
        content,
        portalUrl: `${base}/home`,
        profileUrl: `${digestProfileLink(base)}#settings`,
      }, await emailThemeForPartner(p.id)); // one lookup per partner per run (one digest each); never throws
      if (channels.telegram) tgHtml = buildDigestTelegram(locale, { content, portalUrl: `${base}/home` });
    } catch (e) {
      await fail(logId, p.id, e);
      continue;
    }

    // Telegram first; a failed Telegram-only summary falls back to e-mail when there is an address.
    let delivered = false;
    let lastError: unknown = null;
    let sendMail = channels.email;
    if (tgHtml && p.telegramChatId) {
      const r = await sendPartnerTelegram(p.telegramChatId, tgHtml);
      if (r.ok) delivered = true;
      else {
        lastError = `telegram ${r.status} ${r.description}`;
        if (!sendMail && to) sendMail = true;
      }
    }
    if (sendMail && to) {
      try {
        await sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html });
        delivered = true;
      } catch (e) {
        lastError = e;
      }
    }
    if (!delivered) {
      await fail(logId, p.id, lastError ?? "not delivered");
      if (++streak >= TRANSPORT_BREAKER) {
        result.stoppedEarly = "delivery transport failing";
        break;
      }
      continue;
    }
    if (lastError) result.errors.push(`${p.id}: partly delivered: ${truncateError(lastError)}`);
    streak = 0;
    result.sent++;
    // The mail went out: a failure to mark it must not turn into a resend (the row stays at "sending").
    try {
      await prisma.partnerDigestLog.update({ where: { id: logId }, data: { sentAt: new Date(), error: null } });
    } catch (e) {
      console.error("[partner-digest] sent but could not mark", p.id, truncateError(e));
    }
  }
  return result;
}
