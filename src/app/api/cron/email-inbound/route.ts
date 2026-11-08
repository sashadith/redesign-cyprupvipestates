import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { ImapNotConfiguredError, type PollResult } from "@/lib/emailInbound/processInbound";
import { pollUserMailboxes, type PhaseOutcome } from "@/lib/emailInbound/pollUser";
import { withTimeout } from "@/lib/emailInbound/imapClient";
import { createDeadline, runIsHealthy, type Deadline } from "@/lib/emailInbound/deadline";
import { pollOfficeMailbox, type OfficePollResult } from "@/lib/emailInbound/officeInbound";
import { type SentFileResult } from "@/lib/emailInbound/sentMail";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";
import { checkCronFreshness } from "@/lib/metaLeadgen/watchdog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* A run must not outlive its own budget (2026-11-08).

   maxDuration above was a declaration, not a limit: nothing enforced it. One
   run opens a session per user plus the office mailbox, and each session may
   spend connectionTimeout 20 s or socketTimeout 60 s (imapClient.ts) before
   giving up — so the arithmetic alone allowed a run far past a minute. On
   2026-11-08 one took 86 s and then failed, while the next run was already due:
   this cron fires every five minutes.

   Nothing is lost by deferring. Both pollers advance a UID cursor, so the next
   run resumes exactly where this one stopped. A deferral is therefore NOT a
   failure and must never raise the alert — the message says so instead, and
   `ok` stays true. Anything else would manufacture the weekly false alarm this
   whole exercise was meant to avoid. */
const RUN_BUDGET_MS = 55_000;
/** Don't start a mailbox we cannot plausibly finish — a healthy poll is ~1 s. */
const MIN_PHASE_MS = 8_000;
const USER_CAP_MS = 30_000;
const OFFICE_CAP_MS = 20_000;

type UserSummary = {
  userId: string;
  ok: boolean;
  fetched?: number;
  matched?: number;
  ambiguous?: number;
  skipped?: number;
  reset?: boolean;
  error?: string;
  /** Budget ran out before this mailbox was reached; the next run picks it up. */
  deferred?: boolean;
};

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

function summarizeInbox(userId: string, o: PhaseOutcome<PollResult>): UserSummary {
  if (!o.ok) return { userId, ok: false, error: o.error };
  if (!("result" in o)) return { userId, ok: true, skipped: 0, error: o.skipped };
  return { userId, ok: !o.result.stoppedEarlyOnError, ...o.result };
}

function summarizeSent(userId: string, o: PhaseOutcome<SentFileResult>): UserSummary {
  if (!o.ok) return { userId, ok: false, error: o.error };
  if (!("result" in o)) return { userId, ok: true, skipped: 0, error: o.skipped };
  return { userId, ok: true, fetched: o.result.scanned, matched: o.result.filed };
}

async function pollAllConfiguredMailboxes(deadline: Deadline): Promise<UserSummary[]> {
  const rows = await prisma.userEmailSettings.findMany({
    where: { imapHost: { not: null }, imapUser: { not: null }, imapPasswordEnc: { not: null } },
    select: { userId: true, fromAddress: true },
  });

  const results: UserSummary[] = [];
  for (const { userId, fromAddress } of rows) {
    if (!deadline.hasRoomFor(MIN_PHASE_MS)) {
      results.push({ userId, ok: true, deferred: true });
      results.push({ userId: `${userId}:sent`, ok: true, deferred: true });
      continue;
    }
    let outcome;
    try {
      // Inbox and Sent share ONE session (pollUser.ts) and are bounded together:
      // whichever is still running when the budget ends is abandoned, and the
      // next run resumes from the stored UID cursor. The abandoned session
      // still closes itself — withImapSession's finally runs when its own work
      // settles, which its socketTimeout guarantees.
      outcome = await withTimeout(
        pollUserMailboxes(userId, fromAddress),
        deadline.budgetFor(USER_CAP_MS),
        `mailbox poll (${userId})`,
      );
    } catch (e) {
      // One advisor's mailbox being unreachable (IMAP down, login failure,
      // timeout) must never block another's, and must never crash the whole
      // cron run — log and move on, retry this user again next poll.
      if (e instanceof ImapNotConfiguredError) continue; // not an error — just nothing to do for this user
      console.error(`email-inbound: session failed for user ${userId}:`, e);
      // Two entries, as when these were two connections: the aggregate counts
      // mailboxes, and a session failure genuinely took both of them down.
      results.push({ userId, ok: false, error: reason(e) });
      results.push({ userId: `${userId}:sent`, ok: false, error: reason(e) });
      continue;
    }
    results.push(summarizeInbox(userId, outcome.inbox));
    results.push(summarizeSent(`${userId}:sent`, outcome.sent));
  }

  // Developer registration replies land in the office mailbox (env credentials,
  // not a UserEmailSettings row). Unconfigured = nothing to do, not an error.
  if (!deadline.hasRoomFor(MIN_PHASE_MS)) {
    results.push({ userId: "office", ok: true, deferred: true });
    return results;
  }
  try {
    const r = await withTimeout(pollOfficeMailbox(), deadline.budgetFor(OFFICE_CAP_MS), "office mailbox poll");
    if (!("skipped" in r && r.skipped === "not configured")) {
      const o = r as OfficePollResult;
      results.push({ userId: "office", ok: !o.stoppedEarlyOnError, fetched: o.fetched, matched: o.handled, skipped: o.skipped, reset: o.reset, ...(o.stoppedEarlyOnError ? { error: o.stoppedEarlyOnError } : {}) });
    }
  } catch (e) {
    console.error("email-inbound: office poll failed:", e);
    results.push({ userId: "office", ok: false, error: reason(e) });
  }
  return results;
}

// Called by cron: curl -s "http://127.0.0.1:3200/api/cron/email-inbound?key=$CRON_SECRET"
// Suggested schedule: every 5 minutes, offset from publish-scheduled's
// identical */5 cadence to avoid both firing in the same wall-clock second
// (harmless either way — separate stateless requests — but avoided anyway).
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Partial deferral is healthy, total deferral is not — see runIsHealthy.
  const okFrom = (results: UserSummary[]) => runIsHealthy(results);
  const deadline = createDeadline(RUN_BUDGET_MS);
  try {
    const summaries = await withCronLog(
      "email-inbound",
      () => pollAllConfiguredMailboxes(deadline),
      (results) => {
        const totals = results.reduce(
          (acc, r) => ({
            matched: acc.matched + (r.matched ?? 0),
            skipped: acc.skipped + (r.skipped ?? 0),
            errors: acc.errors + (r.ok ? 0 : 1),
            deferred: acc.deferred + (r.deferred ? 1 : 0),
          }),
          { matched: 0, skipped: 0, errors: 0, deferred: 0 },
        );
        const deferred = totals.deferred ? `, ${totals.deferred} deferred to the next run` : "";
        return `${results.length} mailbox(es) polled — ${totals.matched} matched, ${totals.skipped} skipped, ${totals.errors} error(s)${deferred}`;
      },
      // 2026-08-11/12 — same aggregate-blindness fix as drive-sync/feed-sync/
      // booking-reminders/psi-sync (see withCronLog's comment in
      // src/lib/cronLog.ts): pollAllConfiguredMailboxes() catches every
      // per-mailbox failure internally (ImapNotConfiguredError is skipped
      // outright, any other error is logged and pushed into the results
      // array) and always resolves normally, so without this the aggregate
      // row logged ok:true even if every configured mailbox failed.
      okFrom,
    );
    // 2026-08-13 (GROSSER AUFTRAG Teil 4) — same reasoning as psi-sync: a
    // partial/total mailbox failure never throws, so check okFrom explicitly.
    if (!okFrom(summaries) && (await shouldNotifyFailureStreak("email-inbound"))) {
      const failed = summaries.filter((r) => !r.ok).map((r) => r.error || r.userId);
      const msg = buildCronFailureMessage("email-inbound", `${failed.length} mailbox(es) failed: ${failed.slice(0, 5).join("; ")}`);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("email-inbound");
    }
    // 2026-10-11 — mutual watchdog with the Meta lead poller (see
    // src/lib/metaLeadgen/watchdog.ts): 3 missed 15-minute runs = alert.
    await checkCronFreshness("meta-leadgen-poll", 45 * 60_000).catch((e) => console.error("watchdog(meta-leadgen-poll) failed", e));
    return NextResponse.json({ ok: true, results: summaries });
  } catch (e) {
    const message = reason(e);
    if (await shouldNotifyFailureStreak("email-inbound")) {
      const msg = buildCronFailureMessage("email-inbound", message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("email-inbound");
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
