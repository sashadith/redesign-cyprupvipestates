// Daily Action Center digest — one Telegram message per day, ENGLISH, only
// sent when at least one URGENT or ACTION item is open (INFO items are not
// digest-worthy on their own; they're still visible on the dashboard). This
// is the only scheduled/batched Telegram push in the app — the existing
// real-time alerts (presentation view/favorite, new lead) are unrelated and
// stay exactly as they are; see src/lib/telegram.ts's call sites.
// Called by cron: curl -s "http://127.0.0.1:3200/api/cron/action-digest?key=$CRON_SECRET"
// Expected schedule: daily at 08:00 Cyprus time (see DEPLOYMENT.md).
import { NextRequest, NextResponse } from "next/server";
import { getActionCenterItems } from "@/lib/actionCenter";
import { sendTelegramMessage } from "@/lib/telegram";
import { withCronLog } from "@/lib/cronLog";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 10;
const SEVERITY_EMOJI: Record<string, string> = { URGENT: "🔴", ACTION: "🟠" };

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function runDigest() {
  const items = (await getActionCenterItems()).filter((i) => i.severity === "URGENT" || i.severity === "ACTION");
  if (!items.length) return { sent: false, count: 0 };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
  const shown = items.slice(0, MAX_ITEMS);
  const lines = shown.map((i) => `${SEVERITY_EMOJI[i.severity]} ${escapeHtml(i.title)}`);
  const more = items.length - shown.length;

  const text = [
    "<b>📋 Daily Action Center Digest</b>",
    "",
    ...lines,
    more > 0 ? `\n…and ${more} more.` : "",
    "",
    `<a href="${siteUrl}/admin">Open Action Center</a>`,
  ].filter(Boolean).join("\n");

  await sendTelegramMessage(text);
  return { sent: true, count: items.length };
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog("action-digest", runDigest, (r) => (r.sent ? `sent, ${r.count} item(s)` : "nothing to send"));
    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
