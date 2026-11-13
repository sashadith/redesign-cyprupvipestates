// DTA Group's price-list sync (2026-11-13) — see src/lib/dtaSync.ts.
//
// One Dropbox share (DeveloperAccount.developerCloudUrl of slug "dta"), one
// folder per project, a "Price List" subfolder with the PDF. The cron fires
// DAILY; an unchanged list costs a few folder listings and no download, so
// daily is cheap and a new list shows up the next morning. The account's
// driveSyncInterval can still slow it down (or switch it off).
//
//   crontab:  curl -s ".../api/cron/dta-sync?key=$CRON_SECRET&scheduled=1"
//   by hand:  curl -s "http://127.0.0.1:3000/api/cron/dta-sync?key=$CRON_SECRET"
//   &force=1  re-read every list even when unchanged
//   &dry=1    read and report what would change, write nothing (and no cron log row)
//   &dev=<id> limit to one Development
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncDta, DTA_ACCOUNT_SLUG } from "@/lib/dtaSync";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

export const dynamic = "force-dynamic";
// Six small PDFs, no model call.
export const maxDuration = 120;

const JOB = "dta-sync";
const account = () => prisma.developerAccount.findUnique({ where: { slug: DTA_ACCOUNT_SLUG } });

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
    if (!acct) return NextResponse.json({ ok: false, error: "DTA developer account not found" }, { status: 404 });
    try {
      return NextResponse.json({ dryRun: true, at: new Date().toISOString(), ...(await syncDta(acct.id, { dryRun: true, onlyDevelopmentId })) });
    } catch (e) {
      return NextResponse.json({ dryRun: true, ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  try {
    const result = await withCronLog(
      JOB,
      async () => {
        const acct = await account();
        if (!acct) return { ok: false, message: "DTA developer account not found", projects: [] };
        return syncDta(acct.id, { force, respectInterval: scheduled, onlyDevelopmentId });
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
