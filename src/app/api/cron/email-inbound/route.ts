import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { pollInboundEmailForUser, ImapNotConfiguredError } from "@/lib/emailInbound/processInbound";
import { pollOfficeMailbox, type OfficePollResult } from "@/lib/emailInbound/officeInbound";
import { pollSentForUser } from "@/lib/crm/commSync";
import { MailboxNotFoundError } from "@/lib/emailInbound/imapClient";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";
import { checkCronFreshness } from "@/lib/metaLeadgen/watchdog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type UserSummary = { userId: string; ok: boolean; fetched?: number; matched?: number; ambiguous?: number; skipped?: number; reset?: boolean; error?: string };

async function pollAllConfiguredMailboxes(): Promise<UserSummary[]> {
  const rows = await prisma.userEmailSettings.findMany({
    where: { imapHost: { not: null }, imapUser: { not: null }, imapPasswordEnc: { not: null } },
    select: { userId: true, fromAddress: true },
  });

  const results: UserSummary[] = [];
  for (const { userId, fromAddress } of rows) {
    try {
      const r = await pollInboundEmailForUser(userId);
      results.push({ userId, ok: !r.stoppedEarlyOnError, ...r });
    } catch (e) {
      // One advisor's mailbox being unreachable (IMAP down, login failure,
      // timeout) must never block another's, and must never crash the whole
      // cron run — log and move on, retry this user again next poll.
      if (e instanceof ImapNotConfiguredError) continue; // not an error — just nothing to do for this user
      console.error(`email-inbound: poll failed for user ${userId}:`, e);
      results.push({ userId, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    // Mail the operator sent from their own mail program (2026-10-29, see crm/commSync.ts). Its own
    // entry: a Sent-folder hiccup must not hide whether the inbox poll worked, and vice versa.
    try {
      const sent = await pollSentForUser(userId, fromAddress);
      results.push({ userId: `${userId}:sent`, ok: true, fetched: sent.scanned, matched: sent.filed });
    } catch (e) {
      if (e instanceof ImapNotConfiguredError) continue;
      // No recognisable Sent folder: nothing to read, not an outage — a failed entry here would keep
      // the whole job red and mute the streak alert for a real inbox failure.
      if (e instanceof MailboxNotFoundError) {
        results.push({ userId: `${userId}:sent`, ok: true, skipped: 0, error: "no sent folder" });
        continue;
      }
      console.error(`email-inbound: sent-folder poll failed for user ${userId}:`, e);
      results.push({ userId: `${userId}:sent`, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  // Developer registration replies land in the office mailbox (env credentials,
  // not a UserEmailSettings row). Unconfigured = nothing to do, not an error.
  try {
    const r = await pollOfficeMailbox();
    if (!("skipped" in r && r.skipped === "not configured")) {
      const o = r as OfficePollResult;
      results.push({ userId: "office", ok: !o.stoppedEarlyOnError, fetched: o.fetched, matched: o.handled, skipped: o.skipped, reset: o.reset, ...(o.stoppedEarlyOnError ? { error: o.stoppedEarlyOnError } : {}) });
    }
  } catch (e) {
    console.error("email-inbound: office poll failed:", e);
    results.push({ userId: "office", ok: false, error: e instanceof Error ? e.message : String(e) });
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
  const okFrom = (results: UserSummary[]) => results.every((r) => r.ok);
  try {
    const summaries = await withCronLog(
      "email-inbound",
      pollAllConfiguredMailboxes,
      (results) => {
        const totals = results.reduce(
          (acc, r) => ({ matched: acc.matched + (r.matched ?? 0), skipped: acc.skipped + (r.skipped ?? 0), errors: acc.errors + (r.ok ? 0 : 1) }),
          { matched: 0, skipped: 0, errors: 0 },
        );
        return `${results.length} mailbox(es) polled — ${totals.matched} matched, ${totals.skipped} skipped, ${totals.errors} error(s)`;
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
    const message = e instanceof Error ? e.message : String(e);
    if (await shouldNotifyFailureStreak("email-inbound")) {
      const msg = buildCronFailureMessage("email-inbound", message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("email-inbound");
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
