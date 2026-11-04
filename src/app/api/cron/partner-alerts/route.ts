// Daily partner alerts (partner notifications v2, 2026-10-30). ENGLISH (internal).
// Plans the partner-wide and reminder notifications into the partner outbox: new projects of the last 24 h
// (PROJECT_NEWS), changes on projects from the partner's own presentations (WATCH), client protection
// ending in 30 / 7 days (PROTECTION_ENDING), clients without news for 14 days (CLIENT_QUIET), live deals of
// partners without bank details (BANK_MISSING) and one closed deal to the next tier (TIER_NEAR). Rows only:
// the partner-notify cron delivers them by e-mail and/or Telegram and re-checks each one at send time.
// One run at a time (advisory lock); refKeys are unique, so a rerun the same day adds nothing.
// Pure parts: src/lib/partner/alerts.ts; DB side: src/lib/partner/alertsSend.ts.
//
// Set PARTNER_ALERTS_START (ISO, e.g. 2026-11-02T00:00:00Z): without it the job does nothing, and nothing
// runs before it. Partner delivery additionally follows PARTNER_NOTIFY_START.
// Crontab (05:30 UTC ≈ 07:30/08:30 Cyprus, daily):
//   30 5 * * * curl -s "http://127.0.0.1:3000/api/cron/partner-alerts?key=$CRON_SECRET" >/dev/null
import { NextRequest, NextResponse } from "next/server";
import { withCronLog } from "@/lib/cronLog";
import { alertsStartFromEnv, runPartnerAlerts, withAlertsLock, type AlertsRunResult } from "@/lib/partner/alertsSend";

export const dynamic = "force-dynamic";

type RunResult = { skipped: string } | ({ ok: true } & AlertsRunResult);

async function runAlerts(): Promise<RunResult> {
  const start = alertsStartFromEnv(process.env);
  if (!start) return { skipped: "PARTNER_ALERTS_START not set" };
  const now = new Date();
  const run = await withAlertsLock(() => runPartnerAlerts(now, start));
  if (!run) return { skipped: "another run active" };
  if (run.errors.length) console.error("[partner-alerts]", run.errors);
  return { ok: true, ...run };
}

const summarize = (r: RunResult) => {
  if (!("ok" in r)) return `skipped: ${r.skipped}`;
  const planned = Object.entries(r.planned).map(([k, v]) => `${v} ${k}`).join(", ");
  return `${r.today}: ${r.partners} partners → ${planned || "nothing"} planned, ${r.inserted} inserted` +
    `${r.errors.length ? `, ${r.errors.length} error(s)` : ""}`;
};

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog("partner-alerts", runAlerts, summarize, (r) => !("ok" in r) || r.errors.length === 0);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
