// Nightly Plus Properties sync — see src/lib/plusPropertiesSync.ts and
// docs/superpowers/specs/2026-09-25-plus-properties-connector-design.md.
//   crontab:  30 2 * * * … curl -s ".../api/cron/plus-sync?key=$CRON_SECRET"
//   by hand:  &force=1 re-mirrors every project's media
//             &dryRun=1 reports what would be written and writes nothing
// Invented parameters are ignored — only these two are read.
//
// The cron-health JOBS entry ("plus-sync") in src/lib/actionCenter/rules/system.ts
// is added together with the crontab entry, once the operator installs it —
// same convention as kuutio-sync and cybarco-sync there. Adding it now would
// have systemRules() raise an URGENT "hasn't run recently" item with no
// cron_run_logs row to satisfy it yet.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPlusProperties, PLUS_ACCOUNT_SLUG, type PlusRunResult } from "@/lib/plusPropertiesSync";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function summarize(r: PlusRunResult): string {
  return [
    `${r.projects} project(s), ${r.created} created, ${r.units} unit(s) written`,
    r.failed.length ? `${r.failed.length} failed (${r.failed.slice(0, 3).join("; ")})` : null,
    r.blocked.length ? `${r.blocked.length} blocked` : null,
    r.reason,
  ].filter(Boolean).join(", ");
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const opts = {
    force: req.nextUrl.searchParams.get("force") === "1",
    dryRun: req.nextUrl.searchParams.get("dryRun") === "1",
  };
  const acct = await prisma.developerAccount.findUnique({ where: { slug: PLUS_ACCOUNT_SLUG } });
  if (!acct) return NextResponse.json({ ok: false, error: `no DeveloperAccount "${PLUS_ACCOUNT_SLUG}"` }, { status: 500 });
  try {
    /* A dry run is not a sync: it is never logged as one, so it can neither
       satisfy nor trip cron health. */
    const result = opts.dryRun
      ? await syncPlusProperties(acct.id, opts)
      : await withCronLog("plus-sync", () => syncPlusProperties(acct.id, opts), summarize, (r) => r.ok);
    if (!opts.dryRun && !result.ok && (await shouldNotifyFailureStreak("plus-sync"))) {
      const msg = buildCronFailureMessage("plus-sync", summarize(result));
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("plus-sync");
    }
    return NextResponse.json({ at: new Date().toISOString(), ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
