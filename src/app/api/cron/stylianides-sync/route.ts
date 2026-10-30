// Stylianides Group's price-list sync (2026-10-30) — see src/lib/stylianidesSync.ts.
//
// One Dropbox link per project, a dated PDF price list at each folder's root.
// The cron fires DAILY; a project whose price list file has not changed costs one
// folder listing and no model call, so daily is cheap and a new list shows up the
// next morning. The developer's driveSyncInterval can still slow it down.
//
//   crontab:  curl -s ".../api/cron/stylianides-sync?key=$CRON_SECRET&scheduled=1"
//   by hand:  curl -s "http://127.0.0.1:3000/api/cron/stylianides-sync?key=$CRON_SECRET"
//   &force=1  re-read every list even when unchanged
//   &dry=1    read and report what would change, write nothing (and no cron log row)
//   &dev=<id> limit to one Development
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncStylianides } from "@/lib/stylianidesSync";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

export const dynamic = "force-dynamic";
// Eight PDFs, one column-mapping call per table on a changed list.
export const maxDuration = 300;

const JOB = "stylianides-sync";
const account = () => prisma.developerAccount.findUnique({ where: { slug: "stylianides" } });

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (!process.env.CRON_SECRET || q.get("key") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const force = q.get("force") === "1";
  const scheduled = q.get("scheduled") === "1";
  const onlyDevelopmentId = q.get("dev") || undefined;

  // Before withCronLog on purpose: a dry run is not a sync and must not satisfy
  // cron-health's "did the job fire" check for a night the real job never ran.
  if (q.get("dry") === "1") {
    const acct = await account();
    if (!acct) return NextResponse.json({ ok: false, error: "Stylianides developer account not found" }, { status: 404 });
    try {
      return NextResponse.json({ dryRun: true, at: new Date().toISOString(), ...(await syncStylianides(acct.id, { dryRun: true, onlyDevelopmentId })) });
    } catch (e) {
      return NextResponse.json({ dryRun: true, ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  try {
    const result = await withCronLog(
      JOB,
      async () => {
        const acct = await account();
        if (!acct) return { ok: false, message: "Stylianides developer account not found", projects: [] };
        return syncStylianides(acct.id, { force, respectInterval: scheduled, onlyDevelopmentId });
      },
      (r) => r.message,
      (r) => r.ok,
    );
    if (!result.ok && (await shouldNotifyFailureStreak(JOB))) {
      const msg = buildCronFailureMessage(JOB, result.message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified(JOB);
    }
    return NextResponse.json({ at: new Date().toISOString(), ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (await shouldNotifyFailureStreak(JOB)) {
      const msg = buildCronFailureMessage(JOB, message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified(JOB);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
