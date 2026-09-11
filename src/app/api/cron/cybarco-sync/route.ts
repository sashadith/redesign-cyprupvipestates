// Cybarco has no data feed of any kind — only a website and one downloadable
// PDF price list per project. See src/lib/cybarcoSync.ts for the adapter
// itself (gatherCybarco reads the site + PDFs; syncCybarco writes DRAFT
// Developments and their units) and src/lib/ai/cybarcoPriceTable.ts for how a
// price-list PDF becomes units.
//
// Scheduled at `0 1 * * *`. The nightly chain starts at 02:00 (psi-sync) and
// runs through 06:30, so 01:00 is the only slot with a clear hour ahead of it —
// and a first Cybarco run mirrors several hundred images.
//
// Unlike korantina-sync/kuutio-sync there is no `&scheduled=1`/respectInterval
// concept here: Cybarco has no drive and no DeveloperAccount.driveSyncInterval
// to honour, so syncCybarco() always re-gathers every project on every call —
// contentNeeds() inside it (not this route) is what stops an already-gathered
// or published project from being re-downloaded needlessly. There is also no
// `&dry=1` branch: dryRunCybarcoSync()/dryRunCybarcoSyncDetailed() exist for
// the throwaway scripts/tmp-cybarco-*.mjs runners, not for this route — a
// valid CRON_SECRET always runs the real sync, immediately.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncCybarco } from "@/lib/cybarcoSync";
import { withCronLog, shouldNotifyFailureStreak, markFailureStreakNotified } from "@/lib/cronLog";
import { buildCronFailureMessage, sendFeedNotification } from "@/lib/feedNotifications";

export const dynamic = "force-dynamic";
// Higher than kuutio-sync's 120: a first run mirrors several hundred images
// and rasterises eleven brochures (price lists exist for 9 of the 15 projects,
// but every project's own gallery still needs mirroring).
export const maxDuration = 300;

type RunResult = {
  ok: boolean;
  // Set only when the route itself refuses before syncCybarco ever runs. A sync
  // that DID run describes itself through summarize() below instead.
  fatal: string | null;
  projects: number;
  units: number;
  created: number;
  notes: string[];
  fetchAttempts: number;
  fetchFailures: number;
};

const EMPTY = { projects: 0, units: 0, created: 0, notes: [] as string[], fetchAttempts: 0, fetchFailures: 0 };

async function run(force: boolean): Promise<RunResult> {
  const acct = await prisma.developerAccount.findUnique({ where: { slug: "cybarco" } });
  if (!acct) return { ok: false, fatal: "Cybarco developer account not found", ...EMPTY };
  // syncCybarco's `ok` is now a real verdict rather than a constant: it is false
  // when the site refused a MAJORITY of the run's fetches (runVerdict in
  // cybarcoSync.ts). One flat shape, because a union on a non-literal `ok`
  // cannot discriminate — `fatal` is what separates the two cases.
  return { ...(await syncCybarco(acct.id, { force })), fatal: null };
}

// What lands in CronRunLog.message, and what a failure notification quotes.
// THE NOTE COUNT IS THE POINT: every refused fetch, unreadable price list and
// slug clash is a note, and the old summary dropped `notes` entirely — so a
// night where Cybarco rate-limited every gallery fetch read "0 created, 15
// project(s) touched, 0 unit(s) written", character for character the same row a
// healthy quiet night writes. The refusal ratio is spelled out alongside it so
// the row says WHICH kind of run it was without anyone opening the app.
function summarize(r: RunResult): string {
  if (r.fatal) return r.fatal;
  return [
    `${r.created} created, ${r.projects} project(s) touched, ${r.units} unit(s) written`,
    `${r.notes.length} note(s)`,
    `${r.fetchFailures}/${r.fetchAttempts} fetch(es) refused`,
    r.ok ? null : "SITE REFUSED MOST OF THIS RUN",
  ].filter(Boolean).join(", ");
}

// Add &force=1 to re-gather rich content (photos/plans) for already-synced
// projects too — see contentNeeds() in src/lib/cybarcoSync.ts for exactly what
// that widens. It REPLACES gallery/plans wholesale, so use it only for a
// deliberate content refresh. Published projects are frozen either way
// (FROZEN_WHEN_PUBLISHED in cybarcoSync.ts).
//   crontab:  curl -s ".../api/cron/cybarco-sync?key=$CRON_SECRET"
//   by hand:  curl -s "http://127.0.0.1:3000/api/cron/cybarco-sync?key=$CRON_SECRET&force=1"
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const force = req.nextUrl.searchParams.get("force") === "1";

  try {
    const result = await withCronLog("cybarco-sync", () => run(force), summarize, (r) => r.ok);
    if (!result.ok && (await shouldNotifyFailureStreak("cybarco-sync"))) {
      const msg = buildCronFailureMessage("cybarco-sync", summarize(result));
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("cybarco-sync");
    }
    return NextResponse.json({ at: new Date().toISOString(), ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (await shouldNotifyFailureStreak("cybarco-sync")) {
      const msg = buildCronFailureMessage("cybarco-sync", message);
      await sendFeedNotification(msg.text, msg.subject);
      await markFailureStreakNotified("cybarco-sync");
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
