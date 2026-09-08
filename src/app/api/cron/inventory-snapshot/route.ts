import { NextRequest, NextResponse } from "next/server";
import { withCronLog } from "@/lib/cronLog";
import { sendTelegramMessage } from "@/lib/telegram";
import { captureSnapshots } from "@/lib/crm/inventorySnapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function run() {
  const r = await captureSnapshots(new Date());
  // 0 rows means the query returned nothing (a real outage, not an empty
  // catalogue); a halving means half the catalogue vanished overnight.
  const anomaly = r.captured === 0 && r.skipped === 0 ? "captured 0 developments" : r.previousDayCount > 0 && r.captured + r.skipped < r.previousDayCount / 2 ? `captured ${r.captured + r.skipped}, yesterday ${r.previousDayCount}` : null;
  if (anomaly) await sendTelegramMessage(`⚠️ inventory-snapshot: ${anomaly} — crm_inventory_changes will miss history for today.`).catch(() => {});
  return r;
}

// Called by cron: curl -s "http://127.0.0.1:3000/api/cron/inventory-snapshot?key=$CRON_SECRET"
// Suggested schedule: 50 4 * * * (after feed-sync 04:00 and drive-sync 04:30, before action-digest 05:00).
// NEVER call this against a local dev server — .env.local points at production.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await withCronLog("inventory-snapshot", run, (r) => `${r.captured} captured, ${r.skipped} already today, ${r.deleted} pruned`);
  return NextResponse.json(result);
}
