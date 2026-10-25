// Weekly partner digest — server half (candidates, per-partner content, send, log).
// Pure content/planning: digest.ts. Cron entry: src/app/api/cron/partner-digest/route.ts.
// Isolation: every read for a recipient goes through partnerId-scoped functions (scope.ts); the only
// partner-neutral input is the list of recently published projects, priced per recipient.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/sendEmail";
import {
  DIGEST_NOTHING_NEW, DIGEST_NO_RECIPIENT, DIGEST_SENDING, DIGEST_TERMINAL_ERRORS, buildDigestEmail, digestCandidates, digestContent,
  digestLogAction, digestProfileLink, digestStartFromEnv, digestTotals, isoWeekKey, newProjectUrl,
} from "./digest";
import { pickPartnerLocale } from "./i18n";
import { emailThemeForPartner } from "@/lib/design/store";
import { partnerBaseUrl } from "./mail";
import { TRANSPORT_BREAKER, truncateError } from "./notify";
import { myCommissions, myRecentMilestones, projectRates, recentlyPublishedProjects, type PublishedProjects } from "./scope";

export { digestStartFromEnv };

const WINDOW_MS = 7 * 86_400_000;

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
  handoverShare: unknown; fixShare: unknown; trustMode: boolean;
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
      handoverShare: true, fixShare: true, trustMode: true,
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
    let to: string;
    try {
      const recipient = p.users[0]?.email?.trim();
      if (!recipient) {
        await close(logId, p.id, DIGEST_NO_RECIPIENT);
        continue;
      }
      to = recipient;
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
    } catch (e) {
      await fail(logId, p.id, e);
      continue;
    }

    try {
      await sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html });
    } catch (e) {
      await fail(logId, p.id, e);
      if (++streak >= TRANSPORT_BREAKER) {
        result.stoppedEarly = "mail transport failing";
        break;
      }
      continue;
    }
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
