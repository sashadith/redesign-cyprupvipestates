import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronLog } from "@/lib/cronLog";
import { pollInboundEmailForUser, ImapNotConfiguredError } from "@/lib/emailInbound/processInbound";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type UserSummary = { userId: string; ok: boolean; fetched?: number; matched?: number; ambiguous?: number; skipped?: number; reset?: boolean; error?: string };

async function pollAllConfiguredMailboxes(): Promise<UserSummary[]> {
  const rows = await prisma.userEmailSettings.findMany({
    where: { imapHost: { not: null }, imapUser: { not: null }, imapPasswordEnc: { not: null } },
    select: { userId: true },
  });

  const results: UserSummary[] = [];
  for (const { userId } of rows) {
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
    );
    return NextResponse.json({ ok: true, results: summaries });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
