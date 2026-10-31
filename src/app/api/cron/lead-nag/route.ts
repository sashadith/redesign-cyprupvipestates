// Lead reminders (2026-10-31): the CRM nags on Telegram about overdue and due-today leads at 10:00, 12:00,
// 15:00 and 18:00 Cyprus time. Called hourly by cron (DST-proof: the route decides whether this hour is one
// of them, and sends each slot once per day):
//   0 7-16 * * * curl -s "http://127.0.0.1:3000/api/cron/lead-nag?key=$CRON_SECRET"
// ?slot=10&force=1 sends now regardless (manual test).
import { NextRequest, NextResponse } from "next/server";
import { NAG_HOURS, nagSlot } from "@/lib/crm/leadNag";
import { runLeadNag } from "@/lib/crm/leadNagSend";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const force = req.nextUrl.searchParams.get("force") === "1";
  const asked = Number(req.nextUrl.searchParams.get("slot"));
  const slot = force && (NAG_HOURS as readonly number[]).includes(asked) ? asked : nagSlot(now);
  if (slot == null) return NextResponse.json({ ok: true, skipped: "not a reminder hour" });
  const result = await runLeadNag(now, slot, { force });
  return NextResponse.json({ ok: result.errors.length === 0, ...result });
}
