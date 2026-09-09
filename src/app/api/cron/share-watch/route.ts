import { NextRequest, NextResponse } from "next/server";
import { withCronLog, logCronRun } from "@/lib/cronLog";
import { buildShareChangeMessage, sendFeedNotification } from "@/lib/feedNotifications";
import { WATCHED_SHARES, checkWatchedShare, hasChanges } from "@/lib/shareWatch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/* Weekly watch over shared folders we deliberately do NOT sync (see
   src/lib/shareWatch.ts for why Marfields is watched rather than adapted).
   Called by cron: curl -s "http://127.0.0.1:3000/api/cron/share-watch?key=$CRON_SECRET"
   Suggested schedule: 0 5 * * 1 — Monday, after the nightly syncs are done. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const results = await withCronLog(
      "share-watch",
      async () => {
        const out = [];
        for (const share of WATCHED_SHARES) {
          // One share failing must not cost the others their check: each is
          // caught, logged under its own job name, and the run continues.
          try {
            out.push({ ok: true as const, ...(await checkWatchedShare(share)) });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`share-watch: ${share.key} failed:`, e);
            out.push({ ok: false as const, share, changes: null, message });
          }
        }
        return out;
      },
      (r) => {
        const moved = r.filter((x) => x.ok && x.changes && hasChanges(x.changes)).length;
        return `${r.length} share(s) checked, ${moved} with changes, ${r.filter((x) => !x.ok).length} failed`;
      },
      (r) => r.every((x) => x.ok),
    );

    for (const r of results) {
      await logCronRun(`share-watch:${r.share.key}`, r.ok, r.ok ? summarise(r.changes) : r.message);
      if (!r.ok || !r.changes || !hasChanges(r.changes)) continue;
      const msg = buildShareChangeMessage(r.share.label, r.changes);
      // Best-effort, like every other cron here: a Telegram or mail hiccup must
      // not fail the run, whose real work (the new baseline) is already stored.
      if (msg) await sendFeedNotification(msg.text, msg.subject).catch((e) => console.error("share-watch: notify failed:", e));
    }
    return NextResponse.json({ ok: true, at: new Date().toISOString(), results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

function summarise(c: { added: string[]; changed: string[]; removed: string[]; total: number; firstRun: boolean } | null): string {
  if (!c) return "no result";
  if (c.firstRun) return `baseline stored, ${c.total} files`;
  return `${c.changed.length} changed, ${c.added.length} added, ${c.removed.length} removed, ${c.total} files`;
}
