import { NextRequest, NextResponse } from "next/server";
import { syncAllDrives } from "@/lib/driveAvailabilitySync";
import { withCronLog, logCronRun } from "@/lib/cronLog";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Daily availability sync for every developer with a Drive folder link.
// Called by cron: curl -s "http://127.0.0.1:3200/api/cron/drive-sync?key=$CRON_SECRET"
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const content = req.nextUrl.searchParams.get("content") === "1";
  const force = req.nextUrl.searchParams.get("force") === "1";
  try {
    const results = await withCronLog(
      "drive-sync",
      () => syncAllDrives(force, content),
      (r) => `${r.length} developer(s), ${r.filter((x) => !x.result.ok).length} failed`,
    );
    // Per-developer rows too — Action Center rule (e) needs "which developer
    // failed", not just "the drive-sync job as a whole had a bad run".
    for (const r of results) await logCronRun(`drive-sync:${r.developer}`, r.result.ok, r.result.ok ? undefined : r.result.message);
    return NextResponse.json({ ok: true, at: new Date().toISOString(), content, force, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
