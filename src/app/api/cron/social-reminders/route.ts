// Telegram reminders for planned (unconfirmed) Typefully drafts — evening
// before, T-90, T-30 and missed; see src/lib/social/socialReminders.ts.
// Called by cron every 5 minutes, offset +3 from publish-scheduled's */5
// (email-inbound is +2, booking-reminders +4) — see DEPLOYMENT.md:
//   curl -s "http://127.0.0.1:3000/api/cron/social-reminders?key=$CRON_SECRET"
// Quiet hours are computed in Cyprus time inside the job, so the crontab needs
// no seasonal adjustment.
import { NextRequest, NextResponse } from "next/server";
import { withCronLog } from "@/lib/cronLog";
import { runSocialReminders } from "@/lib/social/socialReminders";
import { realReminderDeps } from "@/lib/social/reminderDeps";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog(
      "social-reminders",
      () => runSocialReminders(realReminderDeps()),
      (r) => r.apiOk
        ? `planned ${r.planned}, sent evening=${r.sent.evening} t90=${r.sent.t90} t30=${r.sent.t30} missed=${r.sent.missed}, failed sends=${r.failed}${r.recovery ? `, recovery: ${r.recovery}` : ""}`
        : r.apiAlert === "below-threshold"
          ? `Typefully check failed ${r.consecutiveFailures}× in a row (${r.apiStatus ?? "no response"}) — logged, no alert yet`
          : `Typefully unreachable (${r.apiStatus ?? "no response"}), ${r.consecutiveFailures} failed checks in a row, alert: ${r.apiAlert}`,
      // A confirmed outage or a failed Telegram send is a failed run, so the
      // cron-health rule raises it in the Action Center as well. A failed check
      // below the alert threshold is logged as ok — cron-health would otherwise
      // turn every single slow Typefully answer into an URGENT item.
      (r) => (r.apiOk || r.apiAlert === "below-threshold") && r.failed === 0,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
