// Kuutio's Dropbox-shared-link sync (2026-08-13). Manual-only until
// 2026-08-26, when it joined the crontab at `0 3 * * *` (DEPLOYMENT.md) and,
// as the comment here always said it would at that same moment,
// systemRules()'s cron-health JOBS list. The 03:00 slot is deliberate: psi-sync
// (02:00) is done by ~02:21 and feed-sync (04:00) hasn't started, so a ~12-min
// run overlaps nothing, and it still lands inside action-digest's 4h lookback
// window so the 05:00 digest reports it.
//
// Why it needed a schedule at all: between the last manual run (2026-08-13)
// and 2026-08-26, NOTHING refreshed Kuutio's inventory. syncAllDrives skips
// Dropbox accounts by design, so the nightly drive-sync never covered them —
// 6 projects / 93 units sat frozen for 13 days with no job responsible for them.
//
// The cron fires DAILY; how often a run actually does anything is the
// developer's own driveSyncInterval (weekly for Kuutio today), enforced by
// writeKuutioDraft's respectInterval guard. A not-due night still writes an
// ok CronRunLog row, which is what keeps cron-health's "did it fire at all"
// detection honest.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeKuutioDraft } from "@/lib/dropboxAvailabilitySync";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function run(force: boolean, scheduled: boolean) {
  const acct = await prisma.developerAccount.findFirst({ where: { name: { contains: "Kuutio", mode: "insensitive" } } });
  if (!acct) return { ok: false as const, message: "Kuutio developer account not found" };
  const result = await writeKuutioDraft(acct.id, { force, respectInterval: scheduled });
  return { ok: true as const, ...result };
}

// The crontab calls this with &scheduled=1 — the ONLY caller that lets the
// developer's driveSyncInterval skip the run. A bare call (by hand, or the
// admin panel's own button, which goes through the server action rather than
// this route) always syncs, because a human pressing it has already decided.
//   crontab:  curl -s ".../api/cron/kuutio-sync?key=$CRON_SECRET&scheduled=1"
//   by hand:  curl -s "http://127.0.0.1:3200/api/cron/kuutio-sync?key=$CRON_SECRET"
// Add &force=1 to re-gather rich content (photos/plans/amenities/description/
// stage) for already-synced projects too — otherwise isNewDev only fires for
// a project whose gallery is still empty. Re-downloads and REPLACES the
// gallery/plans wholesale, so only use for a deliberate content refresh.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const force = req.nextUrl.searchParams.get("force") === "1";
  const scheduled = req.nextUrl.searchParams.get("scheduled") === "1";
  try {
    const result = await withCronLog(
      "kuutio-sync",
      () => run(force, scheduled),
      (r) => (!r.ok ? r.message : r.notDue ?? `${r.created.length} created, ${r.skippedExisting.length} skipped (existing), ${r.skippedEmpty.length} skipped (empty)`),
      (r) => r.ok,
    );
    if (!result.ok && (await shouldNotifyFailureStreak("kuutio-sync"))) {
      const msg = buildCronFailureMessage("kuutio-sync", result.message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("kuutio-sync");
    }
    return NextResponse.json({ at: new Date().toISOString(), ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (await shouldNotifyFailureStreak("kuutio-sync")) {
      const msg = buildCronFailureMessage("kuutio-sync", message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("kuutio-sync");
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
