// Daily partner match alerts (partner portal phase 3e, Decision 6). ENGLISH (internal).
// Catalogue changes of the last 24 h (inventoryChanges: published, new units, priceFrom / unit price
// decreases, back on market) are matched against every effectively ACTIVE claim whose lead has a budget
// and is not CLOSED/LOST (max 2000 claims, 500 changes). Each match becomes a MATCH row in the partner
// outbox (refKey match:<claimId>:<developmentId>:<Cyprus date>, max 3 per claim per day, repeats of the
// last 14 days with the same change and price dropped); the partner-notify cron delivers them by e-mail
// and/or Telegram. Each lead owner gets one English e-mail listing the day's alerts on their leads,
// marked per lead with a SYSTEM interaction after the send (a rerun the same day never mails twice).
// One run at a time (advisory lock).
// Pure parts: src/lib/partner/matchAlerts.ts, matchGlue.ts; DB side: src/lib/partner/matchSend.ts.
//
// Set PARTNER_MATCH_START (ISO, e.g. 2026-10-26T00:00:00Z): without it the job does nothing, and
// nothing runs before it. Partner delivery additionally follows PARTNER_NOTIFY_START.
// Crontab (04:00 UTC ≈ 06:00/07:00 Cyprus, daily):
//   0 4 * * * curl -s "http://127.0.0.1:3000/api/cron/partner-match?key=$CRON_SECRET" >/dev/null
import { NextRequest, NextResponse } from "next/server";
import { withCronLog } from "@/lib/cronLog";
import { matchStartFromEnv, runMatchAlerts, withMatchLock, type MatchRunResult } from "@/lib/partner/matchSend";

export const dynamic = "force-dynamic";

type RunResult = { skipped: string } | ({ ok: true } & MatchRunResult);

async function runMatch(): Promise<RunResult> {
  const start = matchStartFromEnv(process.env);
  if (!start) return { skipped: "PARTNER_MATCH_START not set" };
  const now = new Date();
  const run = await withMatchLock(() => runMatchAlerts(now, start));
  if (!run) return { skipped: "another run active" };
  if (run.errors.length) console.error("[partner-match]", run.errors);
  return { ok: true, ...run };
}

const summarize = (r: RunResult) => {
  if (!("ok" in r)) return `skipped: ${r.skipped}`;
  const skipped = Object.entries(r.owners.skipped).map(([k, v]) => `${v} ${k}`).join(", ");
  return `${r.today}: ${r.changes} changes × ${r.claims} claims → ${r.planned} planned, ${r.repeated} repeated, ${r.inserted} inserted; ` +
    `owners sent ${r.owners.sent}${r.owners.failed ? `, ${r.owners.failed} failed` : ""}${skipped ? `, skipped (${skipped})` : ""}` +
    `${r.stoppedEarly ? ` (stopped: ${r.stoppedEarly})` : ""}`;
};

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog("partner-match", runMatch, summarize, (r) => !("ok" in r) || r.errors.length === 0);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
