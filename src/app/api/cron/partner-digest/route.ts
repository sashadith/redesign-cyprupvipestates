// Weekly partner digest (partner portal phase 3d). ENGLISH (internal).
// One e-mail per ACTIVE partner with digestOptIn for the ISO week of the run (Asia/Nicosia): client
// updates of the last 7 days (effectively active claims, max 10), commission totals per stage, and up to
// 5 projects published in the last 7 days with the partner's handover rate. Nothing to report → no mail
// (log "nothing new"); no verified user → log "no recipient". Up to 200 partners per run, one run at a
// time (advisory lock). Each partner's PartnerDigestLog row for the week is claimed before mailing, so a
// rerun in the same week never mails twice; a failed send is retried on the next run of that week.
// Three consecutive transport errors stop the batch.
// Pure parts: src/lib/partner/digest.ts; DB side: src/lib/partner/digestSend.ts.
//
// Set PARTNER_DIGEST_START (ISO, e.g. 2026-10-26T00:00:00Z): without it the job does nothing, and
// nothing is sent before it. PARTNER_HOST must be set in production.
// Crontab (05:00 UTC ≈ 07:00/08:00 Cyprus, Mondays):
//   0 5 * * 1 curl -s "http://127.0.0.1:3000/api/cron/partner-digest?key=$CRON_SECRET" >/dev/null
import { NextRequest, NextResponse } from "next/server";
import { withCronLog } from "@/lib/cronLog";
import { digestStartFromEnv, sendWeeklyDigests, withDigestLock, type DigestResult } from "@/lib/partner/digestSend";

export const dynamic = "force-dynamic";

type RunResult = { skipped: string } | ({ ok: true } & DigestResult);

async function runDigest(): Promise<RunResult> {
  const start = digestStartFromEnv(process.env);
  if (!start) return { skipped: "PARTNER_DIGEST_START not set" };
  const now = new Date();
  const run = await withDigestLock(() => sendWeeklyDigests(now, start));
  if (!run) return { skipped: "another run active" };
  if (run.errors.length) console.error("[partner-digest]", run.errors);
  return { ok: true, ...run };
}

const summarize = (r: RunResult) => {
  if (!("ok" in r)) return `skipped: ${r.skipped}`;
  const skipped = Object.entries(r.skipped).map(([k, v]) => `${v} ${k}`).join(", ");
  return `${r.weekKey}: ${r.candidates} candidates, sent ${r.sent}${skipped ? `, skipped (${skipped})` : ""}` +
    `${r.failed ? `, ${r.failed} failed` : ""}${r.stoppedEarly ? ` (stopped: ${r.stoppedEarly})` : ""}`;
};

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog("partner-digest", runDigest, summarize, (r) => !("ok" in r) || r.failed === 0);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
