// AGG Luxury Homes' sync (2026-08-28) — see src/lib/aggSync.ts for the adapter,
// src/lib/agg.ts for the two sources (WordPress REST + a ShareOneDrive price-list
// PDF), and src/lib/ai/aggPricelist.ts for how the PDF becomes units.
//
// Single-developer on purpose, exactly like kuutio-sync and korantina-sync: the
// nightly drive-sync deliberately skips non-Drive accounts, so nothing else covers
// AGG. A second WordPress+ShareOneDrive developer needs its own route or this one
// generalised — it must NOT be left to drive-sync.
//
// The cron fires DAILY; whether a run does anything is the developer's own
// driveSyncInterval, enforced by writeAggDraft's respectInterval guard. A not-due
// night still writes an ok CronRunLog row so cron-health stays honest.
//
//   crontab:  curl -s ".../api/cron/agg-sync?key=$CRON_SECRET&scheduled=1"
//   by hand:  curl -s "http://127.0.0.1:3000/api/cron/agg-sync?key=$CRON_SECRET"
//   dry run:  curl -s "http://127.0.0.1:3000/api/cron/agg-sync?key=$CRON_SECRET&dry=1"
//   refresh:  add &force=1 to re-gather photos/description for already-synced projects
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAggDraft, dryRunAggSync } from "@/lib/aggSync";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

export const dynamic = "force-dynamic";
// A first import reads a 5 MB, 53-page PDF and mirrors up to 40 high-res images
// across 12 projects.
export const maxDuration = 300;

const ACCOUNT = { name: { contains: "AGG", mode: "insensitive" as const } };

async function run(force: boolean, scheduled: boolean) {
  const acct = await prisma.developerAccount.findFirst({ where: ACCOUNT });
  if (!acct) return { ok: false as const, message: "AGG developer account not found" };
  const result = await writeAggDraft(acct.id, { force, respectInterval: scheduled });
  return { ok: true as const, ...result };
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const force = req.nextUrl.searchParams.get("force") === "1";
  const scheduled = req.nextUrl.searchParams.get("scheduled") === "1";

  // &dry=1 — read both sources, write nothing, report the project→units mapping,
  // every REST match, and what would change. The intended way to do the FIRST
  // import and to check a run after AGG re-template their price list. Handled
  // BEFORE withCronLog so a dry run writes no "agg-sync" row.
  if (req.nextUrl.searchParams.get("dry") === "1") {
    const acct = await prisma.developerAccount.findFirst({ where: ACCOUNT });
    if (!acct) return NextResponse.json({ ok: false, error: "AGG developer account not found" }, { status: 404 });
    try {
      return NextResponse.json({ dryRun: true, at: new Date().toISOString(), ...(await dryRunAggSync(acct.id)) });
    } catch (e) {
      return NextResponse.json({ dryRun: true, ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  try {
    const result = await withCronLog(
      "agg-sync",
      () => run(force, scheduled),
      (r) => (!r.ok ? r.message : r.notDue ?? `${r.created.length} created, ${r.updated.length} updated, ${r.skippedExisting.length} skipped (existing), ${r.skippedEmpty.length} skipped (empty)`),
      (r) => r.ok,
    );
    if (!result.ok && (await shouldNotifyFailureStreak("agg-sync"))) {
      const msg = buildCronFailureMessage("agg-sync", result.message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("agg-sync");
    }
    return NextResponse.json({ at: new Date().toISOString(), ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (await shouldNotifyFailureStreak("agg-sync")) {
      const msg = buildCronFailureMessage("agg-sync", message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("agg-sync");
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
