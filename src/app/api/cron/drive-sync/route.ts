import { NextRequest, NextResponse } from "next/server";
import { syncAllDrives } from "@/lib/driveAvailabilitySync";
import { withCronLog, logCronRun, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { buildDriveSyncFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Daily availability sync for every developer with a Drive folder link.
// Called by cron: curl -s "http://127.0.0.1:3200/api/cron/drive-sync?key=$CRON_SECRET"
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const content = req.nextUrl.searchParams.get("content") === "1";
  const force = req.nextUrl.searchParams.get("force") === "1";
  try {
    const results = await withCronLog(
      "drive-sync",
      () => syncAllDrives(force, content),
      (r) => `${r.length} developer(s), ${r.filter((x) => !x.result.ok).length} failed`,
      // 2026-08-11 (Olias incident) — syncAllDrives() catches every developer's
      // error internally and always resolves normally, so without this the
      // aggregate row logged ok:true even when every developer failed. See
      // withCronLog's own comment in src/lib/cronLog.ts for the full story.
      (r) => r.every((x) => x.result.ok),
    );
    // Per-developer rows too — Action Center rule (e) needs "which developer
    // failed", not just "the drive-sync job as a whole had a bad run".
    for (const r of results) {
      const job = `drive-sync:${r.developer}`;
      await logCronRun(job, r.result.ok, r.result.ok ? undefined : r.result.message);
      if (!r.result.ok && (await shouldNotifyFailureStreak(job))) {
        const msg = buildDriveSyncFailureMessage(r.developer, r.result.message);
        if (msg) {
          await sendFeedNotification(msg.text, msg.subject);
          await markFailureStreakNotified(job);
        }
      }
      // Per-project pruning summary (writeProject's `pruned`, see
      // driveAvailabilitySync.ts) — informational only, not an alert: the DB
      // is meant to mirror the developer's current list exactly, so a
      // deletion here is the intended, correct behavior, not a failure.
      // Logged (ok:true) purely so a sync's deletions are traceable after
      // the fact without needing to diff a DB backup by hand.
      for (const pr of r.result.pruned ?? []) {
        await logCronRun(`drive-prune:${r.developer}:${pr.project}`, true, `${pr.deleted} unit(s) removed, ${pr.remaining} remain`);
      }
    }
    return NextResponse.json({ ok: true, at: new Date().toISOString(), content, force, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
