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
import { prisma } from "@/lib/prisma";
import type { StoredSuggestion } from "@/lib/seoAdvisor/types";
import { mdInlineToTelegramHtml } from "@/lib/telegramFormat";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 10;
const SEVERITY_EMOJI: Record<string, string> = { URGENT: "🔴", ACTION: "🟠" };

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Piggybacks the weekly SEO Advisor's summary onto whichever daily digest
// fires next after a run completes (Sunday 06:00 UTC run -> next digest is
// Monday 08:00 Cyprus) — see docs: "Monday 08:00 digest" is simply "the next
// daily digest", not a separate crontab entry. `telegramSentAt` makes this
// idempotent: a run's summary goes out exactly once, on whichever digest
// first sees it un-sent, however many days it stays open after that.
async function maybeAppendAdvisorSummary(): Promise<string[]> {
  const latest = await prisma.advisorRun.findFirst({ orderBy: { runDate: "desc" } });
  if (!latest || latest.telegramSentAt) return [];
  const suggestions = (latest.suggestions as unknown as StoredSuggestion[]) ?? [];
  if (!suggestions.length) {
    await prisma.advisorRun.update({ where: { id: latest.id }, data: { telegramSentAt: new Date() } });
    return [];
  }
  await prisma.advisorRun.update({ where: { id: latest.id }, data: { telegramSentAt: new Date() } });
  return [
    "",
    `<b>🧭 SEO Advisor (${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"})</b>`,
    // Advisor titles are LLM-authored freeform text — unlike the
    // code-templated item titles below, they might contain markdown
    // emphasis the model wasn't told to avoid.
    ...suggestions.slice(0, 5).map((s) => `• ${mdInlineToTelegramHtml(s.title)}`),
  ];
}

async function runDigest() {
  const items = (await getActionCenterItems()).filter((i) => i.severity === "URGENT" || i.severity === "ACTION");
  const advisorLines = await maybeAppendAdvisorSummary();
  if (!items.length && !advisorLines.length) return { sent: false, count: 0 };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
  const shown = items.slice(0, MAX_ITEMS);
  const lines = shown.map((i) => `${SEVERITY_EMOJI[i.severity]} ${escapeHtml(i.title)}`);
  const more = items.length - shown.length;

  const text = [
    "<b>📋 Daily Action Center Digest</b>",
    "",
    ...(lines.length ? lines : ["No URGENT/ACTION items today."]),
    more > 0 ? `\n…and ${more} more.` : "",
    ...advisorLines,
    "",
    `<a href="${siteUrl}/admin">Open Action Center</a>`,
  ].filter(Boolean).join("\n");

  await sendTelegramMessage(text);
  return { sent: true, count: items.length + advisorLines.length };
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
