// Korantina Homes' SharePoint shared-link sync (2026-08-26) — see
// src/lib/sharepointAvailabilitySync.ts for the adapter itself and
// src/lib/ai/availabilityTable.ts for how a PDF availability list becomes units.
//
// Scheduled at `20 3 * * *` (DEPLOYMENT.md): psi-sync (02:00) is done by ~02:21,
// kuutio-sync starts at 03:00 and runs ~12 min, and feed-sync starts at 04:00 —
// so a ~15-min run at 03:20 overlaps nothing, and it still lands inside
// action-digest's 4h lookback window so the 05:00 digest reports it.
//
// The cron fires DAILY; how often a run actually does anything is the developer's
// own driveSyncInterval (weekly for Korantina), enforced by writeKorantinaDraft's
// respectInterval guard. A not-due night still writes an ok CronRunLog row, which
// is what keeps cron-health's "did it fire at all" detection honest.
//
// NOTE for whoever adds the NEXT SharePoint developer: this route resolves the
// account by name. It is single-developer on purpose, exactly like kuutio-sync —
// the nightly drive-sync deliberately skips SharePoint accounts (see
// syncAllDrives), so nothing else covers them. A second SharePoint developer needs
// either its own entry here or this route generalised to loop over every account
// whose driveFolderUrl isSharePointShareUrl(); it must NOT be left to drive-sync.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeKorantinaDraft, dryRunKorantinaSync } from "@/lib/sharepointAvailabilitySync";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

export const dynamic = "force-dynamic";
// Higher than kuutio-sync's 120: a first import reads 16 PDFs, mirrors up to 40
// images per project across 18 projects, and rasterises floor-plan PDFs.
export const maxDuration = 300;

const ACCOUNT = { name: { contains: "Korantina", mode: "insensitive" as const } };

async function run(force: boolean, scheduled: boolean) {
  const acct = await prisma.developerAccount.findFirst({ where: ACCOUNT });
  if (!acct) return { ok: false as const, message: "Korantina developer account not found" };
  const result = await writeKorantinaDraft(acct.id, { force, respectInterval: scheduled });
  return { ok: true as const, ...result };
}

// The crontab calls this with &scheduled=1 — the ONLY caller that lets the
// developer's driveSyncInterval skip the run. A bare call (by hand, or the admin
// panel's own button, which goes through the server action rather than this route)
// always syncs, because a human pressing it has already decided.
//   crontab:  curl -s ".../api/cron/korantina-sync?key=$CRON_SECRET&scheduled=1"
//   by hand:  curl -s "http://127.0.0.1:3000/api/cron/korantina-sync?key=$CRON_SECRET"
// Add &force=1 to re-gather rich content (photos/plans/amenities/description) for
// already-synced projects too — otherwise content is gathered only for a project
// whose gallery is still empty. It REPLACES gallery/plans wholesale, so use it only
// for a deliberate content refresh. Published projects are frozen either way.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const force = req.nextUrl.searchParams.get("force") === "1";
  const scheduled = req.nextUrl.searchParams.get("scheduled") === "1";

  /* &dry=1 — read SharePoint, write nothing, and report what differs from the
     database (see dryRunKorantinaSync). This is the intended way to do the FIRST
     import and to check a run after Korantina change one of their templates: it
     shows the folder→table→project mapping, every row that would not be imported
     and why, and every column mapping the validator had to correct.
       curl -s "http://127.0.0.1:3000/api/cron/korantina-sync?key=$CRON_SECRET&dry=1"

     Handled BEFORE withCronLog on purpose: a dry run writes no "korantina-sync"
     row. It is not a sync, and one run at lunchtime would otherwise satisfy
     cron-health's "did the job fire" check and the morning digest's own lookback
     for a night the real job never ran. */
  if (req.nextUrl.searchParams.get("dry") === "1") {
    const acct = await prisma.developerAccount.findFirst({ where: ACCOUNT });
    if (!acct) return NextResponse.json({ ok: false, error: "Korantina developer account not found" }, { status: 404 });
    try {
      return NextResponse.json({ dryRun: true, at: new Date().toISOString(), ...(await dryRunKorantinaSync(acct.id)) });
    } catch (e) {
      return NextResponse.json({ dryRun: true, ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  try {
    const result = await withCronLog(
      "korantina-sync",
      () => run(force, scheduled),
      (r) => (!r.ok ? r.message : r.notDue ?? `${r.created.length} created, ${r.updated.length} updated, ${r.skippedExisting.length} skipped (existing), ${r.skippedEmpty.length} skipped (empty)`),
      (r) => r.ok,
    );
    if (!result.ok && (await shouldNotifyFailureStreak("korantina-sync"))) {
      const msg = buildCronFailureMessage("korantina-sync", result.message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("korantina-sync");
    }
    return NextResponse.json({ at: new Date().toISOString(), ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (await shouldNotifyFailureStreak("korantina-sync")) {
      const msg = buildCronFailureMessage("korantina-sync", message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("korantina-sync");
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
