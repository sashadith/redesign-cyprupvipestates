// Daily partner rating points (partner portal phase 4b, Decision 6). ENGLISH (internal).
// For every rating season that has started and ended at most 3 days ago (late reviews / status changes):
// the effectively ACTIVE claims created by the season end (ACTIVE, lead not trashed, committed or still
// protected; max 5000, newest first) → claim accepted (at activeSince) and the first VIEWING / RESERVED /
// CLOSED status change after activeSince → pointEventsFor → the ledger (refKey unique, createMany
// skipDuplicates, so a rerun never doubles points). Nothing is sent to anyone. One run at a time (advisory lock).
// Pure parts: src/lib/partner/rating.ts, ratingFlow.ts; DB side: src/lib/partner/ratingStore.ts.
//
// Set PARTNER_POINTS_START (ISO, e.g. 2026-10-26T00:00:00Z): without it the job does nothing, and
// nothing runs before it.
// Crontab (03:30 UTC ≈ 05:30/06:30 Cyprus, daily):
//   30 3 * * * curl -s "http://127.0.0.1:3000/api/cron/partner-points?key=$CRON_SECRET" >/dev/null
import { NextRequest, NextResponse } from "next/server";
import { withCronLog } from "@/lib/cronLog";
import { pointsStartFromEnv } from "@/lib/partner/ratingFlow";
import { runPointsRun, withPointsLock, type PointsRunResult } from "@/lib/partner/ratingStore";

export const dynamic = "force-dynamic";

type RunResult = { skipped: string } | ({ ok: true } & PointsRunResult);

async function runPoints(): Promise<RunResult> {
  const start = pointsStartFromEnv(process.env);
  if (!start) return { skipped: "PARTNER_POINTS_START not set" };
  const run = await withPointsLock(() => runPointsRun(new Date(), start));
  if (!run) return { skipped: "another run active" };
  if (run.errors.length) console.error("[partner-points]", run.errors);
  return { ok: true, ...run };
}

const summarize = (r: RunResult) => {
  if (!("ok" in r)) return `skipped: ${r.skipped}`;
  if (r.skipped) return `skipped: ${r.skipped}`;
  const per = r.seasons.map((s) => `${s.claims} claims${s.truncated ? " (capped)" : ""} → ${s.inserted}/${s.events} new`).join("; ");
  return `${r.seasons.length} seasons${per ? `: ${per}` : ""}${r.errors.length ? `, ${r.errors.length} errors` : ""}`;
};

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog("partner-points", runPoints, summarize, (r) => !("ok" in r) || r.errors.length === 0);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
