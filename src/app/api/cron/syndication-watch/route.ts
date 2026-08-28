// Checks that the portals syndicating our blog keep their copies out of search.
//
// Called by cron: curl -s "http://127.0.0.1:3000/api/cron/syndication-watch?key=$CRON_SECRET"
// Expected schedule: daily. Inert until SYNDICATION_WATCH_URLS is set, so it
// can ship before the consuming portal exists.
//
// Why this exists rather than trusting the integration brief: we send body HTML,
// the consumer builds the page head, so nothing on our side can force a noindex
// onto their pages. If it disappears — a refactor, a template change, a new
// developer — our blog starts losing impressions to a duplicate we cannot see in
// our own Search Console. This is the only part of that loop we control.
import { NextRequest, NextResponse } from "next/server";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { sendTelegramMessage } from "@/lib/telegram";
import { runSyndicationWatch, buildAlert } from "@/lib/publicApi/syndicationWatch";

export const dynamic = "force-dynamic";

const JOB = "syndication-watch";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // A page that is indexable is a real finding, not a job failure — the run
  // itself succeeded. Only an unreachable URL means the check couldn't do its
  // work, and that alone shouldn't mark the cron red either (the portal may
  // simply be down). So the run is "ok" unless it threw; findings are reported
  // through the alert path below.
  const summarize = (r: Awaited<ReturnType<typeof runSyndicationWatch>>) =>
    r.skipped
      ? `skipped: ${r.reason}`
      : `${r.checks.length} URL(s): ${r.critical.length} critical, ${r.warnings.length} warning(s)`;

  try {
    const result = await withCronLog(JOB, runSyndicationWatch, summarize);

    if (!result.skipped && (result.critical.length || result.warnings.length)) {
      // Critical findings page immediately; warnings are throttled so a portal
      // that is merely unreachable for a day doesn't nag every run.
      const notify = result.critical.length > 0 || (await shouldNotifyFailureStreak(JOB, 1));
      if (notify) {
        await sendTelegramMessage(buildAlert(result));
        await markFailureStreakNotified(JOB);
      }
    }

    // The alert text rides along in the response so a manual run shows exactly
    // what would be (or was) sent, without having to trigger a real message.
    const alert =
      !result.skipped && (result.critical.length || result.warnings.length) ? buildAlert(result) : null;
    return NextResponse.json({ ok: true, at: new Date().toISOString(), alert, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (await shouldNotifyFailureStreak(JOB)) {
      await sendTelegramMessage(`🚨 ${JOB} cron failed: ${message}`);
      await markFailureStreakNotified(JOB);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
