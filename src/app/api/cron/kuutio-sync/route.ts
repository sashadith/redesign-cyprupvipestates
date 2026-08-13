// Kuutio's Dropbox-shared-link sync (2026-08-13) — NOT yet on a schedule.
// This first version is meant to be triggered manually, once, for the
// initial DRAFT review Sascha asked for; a real crontab entry only gets
// added once that first run's results are approved (and this job then
// joins systemRules()'s cron-health JOBS list at the same time — adding it
// now, before there's a real schedule, would fire a false "hasn't run
// recently" URGENT alert against an interval that doesn't exist yet).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeKuutioDraft } from "@/lib/dropboxAvailabilitySync";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function run(force: boolean) {
  const acct = await prisma.developerAccount.findFirst({ where: { name: { contains: "Kuutio", mode: "insensitive" } } });
  if (!acct) return { ok: false as const, message: "Kuutio developer account not found" };
  const result = await writeKuutioDraft(acct.id, { force });
  return { ok: true as const, ...result };
}

// Called manually for now: curl -s "http://127.0.0.1:3200/api/cron/kuutio-sync?key=$CRON_SECRET"
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
  try {
    const result = await withCronLog(
      "kuutio-sync",
      () => run(force),
      (r) => (r.ok ? `${r.created.length} created, ${r.skippedExisting.length} skipped (existing), ${r.skippedEmpty.length} skipped (empty)` : r.message),
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
