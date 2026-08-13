import { NextRequest, NextResponse } from "next/server";
import { syncAll, statusOnlySync } from "@/lib/feedSync";
import { prisma } from "@/lib/prisma";
import { withCronLog, logCronRun } from "@/lib/cronLog";
import { sweepOverlapCandidates } from "@/lib/overlapSweep";
import { computeAvailability } from "@/lib/developmentAvailability";
import { buildRemovedUnitsMessage, buildNewUnitsMessage, buildFeedIncompleteMessage, sendFeedNotification, type RemovedUnitLine } from "@/lib/feedNotifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TRASH_RETENTION_DAYS = 90;
const CRON_LOG_RETENTION_DAYS = 90;

// Hard-delete leads that have sat in the trash (soft-deleted, see
// admin/actions.ts's softDeleteLeadAction) for over 90 days. Piggybacks on
// this existing daily cron rather than provisioning a new VPS crontab entry.
// Best-effort: a failure here must never block the actual feed sync.
async function purgeOldTrash() {
  try {
    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000);
    const { count } = await prisma.lead.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    return { purged: count };
  } catch (e) {
    console.error("Trash purge failed:", e);
    return { purged: 0, error: String(e) };
  }
}

// Same piggyback pattern as purgeOldTrash above, for CronRunLog itself (Action
// Center's sync-health data, see src/lib/actionCenter/rules/system.ts) — no
// point keeping this forever.
async function purgeOldCronLogs() {
  try {
    const cutoff = new Date(Date.now() - CRON_LOG_RETENTION_DAYS * 86_400_000);
    const { count } = await prisma.cronRunLog.deleteMany({ where: { ranAt: { lt: cutoff } } });
    return { purged: count };
  } catch (e) {
    console.error("CronRunLog purge failed:", e);
    return { purged: 0, error: String(e) };
  }
}

// Overlap-candidate sweep (2026-08-03) — same piggyback pattern as
// purgeOldTrash/purgeOldCronLogs above: an error here must never fail the
// actual feed sync (own try/catch, never rethrows), and this cron's existing
// daily cadence is reused rather than a new crontab entry. Runs AFTER
// syncAll/statusOnlySync above so it sees tonight's freshly-synced
// Developments. Logged via logCronRun (job "overlap-sweep") so a silent
// failure is as visible as any other daily job; Action Center rule
// overlapCandidatesPending (rules/developers.ts) reads the resulting
// OverlapCandidate rows independently of how any single run went.
async function runOverlapSweep() {
  try {
    const result = await sweepOverlapCandidates();
    await logCronRun("overlap-sweep", true, `${result.inserted} new of ${result.found} matched`);
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Overlap sweep failed:", e);
    await logCronRun("overlap-sweep", false, message);
    return { found: 0, inserted: 0, error: message };
  }
}

// Daily data+image sync for every XML/API feed developer (Island Blue, INEX, BBF,
// Aristo, Pafilia, Domenica, Medousa, AGG, Square One) — mirrors images to our own
// storage (src/lib/imageMirror.ts), same as cron/drive-sync already does for
// Drive-folder developers. The admin "Sync now" button stays fast/data-only on
// purpose (mirroring many projects' images can take minutes); this cron is the
// "own job" referenced in feedSync.ts's runSync() comment, which never existed
// until now — images were silently staying hotlinked on the developers' own
// servers instead.
// Called by cron: curl -s "http://127.0.0.1:3200/api/cron/feed-sync?key=$CRON_SECRET"
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const results = await withCronLog(
      "feed-sync",
      () => syncAll({ mirror: true }),
      (r) => `${r.reduce((a, x) => a + x.created + x.updated, 0)} updated, ${r.reduce((a, x) => a + x.failed, 0)} failed across ${r.length} developer(s)`,
      // 2026-08-11 — same aggregate-blindness fix as drive-sync (see withCronLog's
      // comment in src/lib/cronLog.ts): syncAll() catches every per-project error
      // internally and always resolves normally, so without this the aggregate row
      // logged ok:true regardless of how many projects failed. A blocked developer
      // (feed-completeness guard) isn't a failure here — it already gets its own
      // feed-incomplete: job row below — so only a genuine per-project failure
      // (r.failed > 0) counts against this aggregate.
      (r) => r.every((x) => x.failed === 0),
    );
    // Per-developer rows — Action Center rule (e) ("Medousa feed failed last
    // sync") needs per-developer status, not just the whole job's outcome.
    // A blocked developer (feed-completeness guard tripped, see
    // checkFeedCompleteness in feedSync.ts) gets its own job key instead —
    // logging it as a plain "0/N failed" success would misrepresent a
    // deliberate skip as a clean run.
    for (const r of results) {
      if (r.blocked) {
        await logCronRun(`feed-incomplete:${r.dev}`, false, r.blockedMessage);
        continue;
      }
      // 2026-08-13 (GROSSER AUFTRAG Teil 5) — was undefined on success, so the
      // morning summary (action-digest) had nothing to show per developer
      // beyond a bare checkmark. found/created/updated are already computed.
      const message = r.failed === 0
        ? `${r.found} project(s), ${r.created} new, ${r.updated} updated`
        : `${r.failed}/${r.found} project(s) failed`;
      await logCronRun(`feed-sync:${r.dev}`, r.failed === 0, message);
    }
    // Status-only sync for manual developments — the normal syncAll() above
    // skips them entirely (any manual unit locks the whole Development out
    // of the regular resync), so this is their only path back to a current
    // sold/reserved/available status. Same piggyback pattern as
    // purgeOldTrash/purgeOldCronLogs: reuses this cron's existing daily
    // cadence instead of a new crontab entry. See feedSync.ts for scope
    // (Island Blue/Domenica live, Aristo prepared, qubehub pending API access).
    const statusResults = await statusOnlySync();
    for (const r of statusResults) {
      await logCronRun(`status-only-sync:${r.dev}`, true, `${r.updated} updated, ${r.matched} matched, ${r.skipped} skipped across ${r.developmentsChecked} development(s)`);
      // Per-change detail lines — deliberately NOT for skips (63 skips/run
      // would be pure noise; they stay a number in the aggregate row above).
      // This is what the A302 investigation (2026-07-27) needed and didn't
      // have: no way to tell a genuine correction from a report artifact
      // without diffing a raw DB backup by hand.
      for (const c of r.changes) await logCronRun(`status-only-sync-change:${r.dev}`, true, `${c.slug} / ${c.unitRef}: ${c.from} → ${c.to}`);
    }

    // Inventory-change notifications (Telegram + email) — merges the two
    // independent "unit no longer in the feed" sources: the published-
    // development diff sync above (results[].unitsUnlisted) and the manual-
    // development status-only sync (statusResults[].changes with to:"unlisted").
    // One message per developer per category, never per unit — see
    // src/lib/feedNotifications.ts for the exact wording (reviewed and
    // approved by Sascha 2026-08-06).
    const removedByDev = new Map<string, RemovedUnitLine[]>();
    const devByDevelopmentId = new Map<string, string>();
    const touchedDevelopmentIds = new Set<string>();
    const pushRemoved = (dev: string, line: RemovedUnitLine, developmentId: string) => {
      const arr = removedByDev.get(dev) ?? [];
      arr.push(line);
      removedByDev.set(dev, arr);
      devByDevelopmentId.set(developmentId, dev);
      touchedDevelopmentIds.add(developmentId);
    };
    for (const r of results) {
      for (const u of r.unitsUnlisted) pushRemoved(r.dev, { development: u.development, ref: u.ref, label: u.label }, u.developmentId);
    }
    for (const r of statusResults) {
      for (const c of r.changes) {
        if (c.to !== "unlisted") continue;
        pushRemoved(r.dev, { development: c.developmentName, ref: c.unitRef, label: c.unitRef }, c.developmentId);
      }
    }

    // Which of the touched developments are now fully sold out as a direct
    // result of today's removals — its own line in the "removed" message
    // ("Salt now shows as sold out."), not folded silently into the count.
    const soldOutNamesByDev = new Map<string, Set<string>>();
    if (touchedDevelopmentIds.size) {
      const touched = await prisma.development.findMany({
        where: { id: { in: Array.from(touchedDevelopmentIds) } },
        select: { id: true, publicName: true, units: { select: { status: true } } },
      });
      for (const d of touched) {
        if (!computeAvailability(d.units).soldOut) continue;
        const dev = devByDevelopmentId.get(d.id);
        if (!dev) continue;
        const set = soldOutNamesByDev.get(dev) ?? new Set<string>();
        set.add(d.publicName);
        soldOutNamesByDev.set(dev, set);
      }
    }

    const notifications: Promise<void>[] = [];
    for (const [dev, lines] of Array.from(removedByDev)) {
      const msg = buildRemovedUnitsMessage(dev, lines, Array.from(soldOutNamesByDev.get(dev) ?? []));
      if (msg) notifications.push(sendFeedNotification(msg.text, msg.subject));
    }
    for (const r of results) {
      if (r.unitsCreated > 0) {
        const msg = buildNewUnitsMessage(r.dev, r.unitsCreated);
        if (msg) notifications.push(sendFeedNotification(msg.text, msg.subject));
      }
      if (r.blocked) {
        const msg = buildFeedIncompleteMessage(r.dev, r.blockedMissing ?? 0, r.blockedTotal ?? 0);
        if (msg) notifications.push(sendFeedNotification(msg.text, msg.subject));
      }
    }
    // Best-effort: a Telegram/email hiccup must never fail the cron itself —
    // the sync already succeeded and is logged; a missed notification is
    // recoverable from the Action Center (feed-incomplete:/sync-fail: rules)
    // and cron_run_logs on the next check, not from retrying this request.
    await Promise.allSettled(notifications);

    const trash = await purgeOldTrash();
    const cronLogCleanup = await purgeOldCronLogs();
    const overlapSweep = await runOverlapSweep();
    return NextResponse.json({ ok: true, at: new Date().toISOString(), results, statusResults, trash, cronLogCleanup, overlapSweep });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
