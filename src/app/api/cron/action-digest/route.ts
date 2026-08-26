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
import type { ActionItem, Category } from "@/lib/actionCenter/types";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/sendEmail";
import { withCronLog } from "@/lib/cronLog";
import { prisma } from "@/lib/prisma";
import type { StoredSuggestion } from "@/lib/seoAdvisor/types";
import { mdInlineToTelegramHtml } from "@/lib/telegramFormat";
import { flagHyperactiveSessions } from "@/lib/analyticsBotDetect";
import { formatInZone, cyprusWallTimeToUtc, CYPRUS_TZ } from "@/lib/booking/timezone";
import { classifyForDigest, chunkLines, REMINDER_THROTTLE_DAYS } from "@/lib/actionCenter/digestNotify";

// Piggybacks on this existing daily cron, same pattern as feed-sync's
// purgeOldTrash/purgeOldCronLogs — best-effort, never blocks the digest.
// Catches UA-spoofing crawlers the track-time isbot() check can't (2026-07-21,
// found via a single visitorHash racking up 70+ pageviews/day on a generic
// Chrome UA and skewing the Top Countries card).
async function runBotCleanup() {
  try {
    return await flagHyperactiveSessions();
  } catch (e) {
    console.error("Bot session cleanup failed:", e);
    return { hashDaysFlagged: 0, rowsFlagged: 0 };
  }
}

export const dynamic = "force-dynamic";

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

// Batch C part 3 (2026-07-25): today's confirmed meetings, folded into this
// existing daily push rather than a second 08:00 message. "Today" is the
// Cyprus calendar day the digest itself fires in, computed as a UTC range
// (start-of-day inclusive, start-of-next-day exclusive) — the same
// wall-clock<->UTC conversion the booking slot generator already uses, not
// a new calculation.
async function todaysAppointmentLines(): Promise<string[]> {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: CYPRUS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  const d = Number(parts.find((p) => p.type === "day")!.value);
  const start = cyprusWallTimeToUtc(y, m, d, 0, 0);
  const end = cyprusWallTimeToUtc(y, m, d + 1, 0, 0); // next Cyprus midnight — Date.UTC rolls month/year over correctly

  const meetings = await prisma.bookingRequest.findMany({
    where: { status: "CONFIRMED", confirmedSlotUtc: { gte: start, lt: end } },
    orderBy: { confirmedSlotUtc: "asc" },
    include: { lead: { select: { firstName: true, lastName: true } } },
  });
  if (!meetings.length) return [];

  return [
    "",
    `<b>📅 Today's appointments (${meetings.length})</b>`,
    ...meetings.map((b) => {
      const time = formatInZone(b.confirmedSlotUtc!, CYPRUS_TZ);
      const leadName = escapeHtml(`${b.lead.firstName} ${b.lead.lastName}`.trim());
      const typeLabel = b.meetingType === "ZOOM" ? "Zoom" : "Phone";
      return `• ${time} — ${leadName} (${typeLabel})`;
    }),
  ];
}

// GROSSER AUFTRAG Teil 5 (2026-08-13) — daily confirmation of the 4am sync
// batch (feed-sync 04:00, drive-sync 04:30), sent even when everything went
// fine (that's the point — a silent night currently looks identical to a
// cron that never fired at all). Piggybacks onto this existing 05:00 digest
// rather than a new crontab entry, same pattern as the SEO Advisor/
// appointments sections below. Reads CronRunLog directly — both aggregate
// rows (job "feed-sync"/"drive-sync") AND their per-developer sub-rows
// (job "feed-sync:<dev>"/"drive-sync:<dev>", written by those routes
// themselves) — so this doubles as "did the sync even run" detection: if
// neither aggregate row exists in the lookback window, that's surfaced
// explicitly rather than the summary just silently having nothing to say.
const MORNING_SUMMARY_WINDOW_HOURS = 4;

async function morningSyncSummaryLines(): Promise<string[]> {
  const since = new Date(Date.now() - MORNING_SUMMARY_WINDOW_HOURS * 3_600_000);
  const rows = await prisma.cronRunLog.findMany({
    where: {
      ranAt: { gte: since },
      OR: [
        { job: { in: ["feed-sync", "drive-sync", "kuutio-sync"] } },
        { job: { startsWith: "feed-sync:" } },
        { job: { startsWith: "drive-sync:" } },
      ],
    },
    orderBy: { ranAt: "desc" },
  });
  const aggFeed = rows.find((r) => r.job === "feed-sync");
  const aggDrive = rows.find((r) => r.job === "drive-sync");
  // Scheduled since 2026-08-26 (`0 3 * * *`, inside this 4h lookback window on
  // purpose), so it is now reported exactly like feed-sync/drive-sync —
  // including a "did not run" warning, which before that date would have been
  // a false alarm against a schedule that did not exist. A night where the
  // developer's own weekly interval says "not due" still produces a row and
  // reads as a normal ✅.
  const aggKuutio = rows.find((r) => r.job === "kuutio-sync");

  // No own section header (2026-08-15 digest restructure) — the caller now
  // nests this directly under its own "🔧 SYSTEM & SYNCS" header, right at
  // the top of the message. See runDigest().
  const lines: string[] = [];
  if (!aggFeed && !aggDrive && !aggKuutio) {
    lines.push(`⚠️ None of feed-sync, drive-sync or kuutio-sync ran in the last ${MORNING_SUMMARY_WINDOW_HOURS}h — the cron itself may not have fired.`);
    return lines;
  }
  lines.push(aggFeed ? `Feed sync: ${aggFeed.ok ? "✅" : "❌"} ${escapeHtml(aggFeed.message ?? "")}` : "Feed sync: ⚠️ did not run");
  lines.push(aggDrive ? `Drive sync: ${aggDrive.ok ? "✅" : "❌"} ${escapeHtml(aggDrive.message ?? "")}` : "Drive sync: ⚠️ did not run");
  lines.push(aggKuutio ? `Kuutio sync: ${aggKuutio.ok ? "✅" : "❌"} ${escapeHtml(aggKuutio.message ?? "")}` : "Kuutio sync: ⚠️ did not run");

  const seen = new Set<string>();
  const perDev = rows
    .filter((r) => (r.job.startsWith("feed-sync:") || r.job.startsWith("drive-sync:")) && !seen.has(r.job) && seen.add(r.job))
    .sort((a, b) => a.job.localeCompare(b.job));
  for (const r of perDev) {
    const name = r.job.replace(/^(feed-sync|drive-sync):/, "");
    lines.push(`${r.ok ? "✅" : "❌"} ${escapeHtml(name)}: ${escapeHtml((r.message ?? "").slice(0, 150))}`);
  }
  return lines;
}

// 2026-08-13 — was: top-10-by-oldest-first, everything else folded into an
// unreadable "...and N more". With 50-86 open URGENT/ACTION items on a given
// day (a real, persistent backlog) and oldest-first sorting, a genuinely NEW
// problem always sorted to the bottom of its severity tier and could sit
// buried for weeks (confirmed: this is exactly how Salt's missing-from-feed
// alert and 3 stale Aristo projects went unseen). Now: every item that has
// NEVER been shown in a digest before goes out in full, uncapped, the same
// day it appears. Items already shown before only repeat as a weekly
// reminder (classifyForDigest's REMINDER_THROTTLE_DAYS) — silently-recurring
// noise doesn't get re-announced daily, but nothing genuinely open can ever
// go permanently unmentioned again. Telegram's 4096-char limit means a large
// batch (notably the first run after this deploy, when the whole existing
// backlog counts as "fresh" once) may need more than one message — chunkLines
// handles that; email has no such limit so always goes out as one message.
// 2026-08-15 restructure (Sascha: "sechzig Zeilen liest niemand jeden
// Morgen") — items now group by category instead of one flat list, capped
// at CATEGORY_CAP each with an "…and N more" link to the rest, and the
// morning sync summary moves to the very top (merged into its own "SYSTEM &
// SYNCS" category block) instead of buried in the footer. Order: SYSTEM &
// SYNCS, DEVELOPERS & PROJECTS, CRM, SEO — chosen for the digest
// specifically; the admin dashboard's own CATEGORY_ORDER (CRM-first, see
// src/lib/actionCenter/index.ts) is a separate, unrelated ordering and
// stays untouched. Items arrive already severity+age sorted (getActionCenterItems's
// sortItems()), so bucketing by category below preserves that order with no
// re-sort needed.
const CATEGORY_CAP = 5;
// Aggregate cron-health items are already fully covered — with real
// per-developer detail — by the morning sync summary lines above; showing
// them again here would just repeat the same fact ("drive-sync cron
// failed") twice in one message.
const SUPPRESSED_SYSTEM_IDS = new Set(["cron-health:feed-sync", "cron-health:drive-sync", "cron-health:kuutio-sync"]);

type TaggedItem = { item: ActionItem; fresh: boolean };

function formatItemLine(t: TaggedItem): string {
  return `${t.fresh ? "🆕" : "🔁"} ${SEVERITY_EMOJI[t.item.severity]} ${escapeHtml(t.item.title)}`;
}

function buildCategorySection(label: string, items: TaggedItem[], siteUrl: string): string[] {
  if (!items.length) return [];
  const shown = items.slice(0, CATEGORY_CAP);
  const rest = items.length - shown.length;
  const lines = ["", `<b>${label} (${items.length})</b>`, ...shown.map(formatItemLine)];
  if (rest > 0) lines.push(`… and ${rest} more → <a href="${siteUrl}/admin">Action Center</a>`);
  return lines;
}

async function runDigest() {
  const items = (await getActionCenterItems()).filter((i) => i.severity === "URGENT" || i.severity === "ACTION");
  const { fresh, recurring, quiet } = await classifyForDigest(items);
  const advisorLines = await maybeAppendAdvisorSummary();
  const appointmentLines = await todaysAppointmentLines();
  const morningSyncLines = await morningSyncSummaryLines();

  // morningSyncLines is non-empty on every real day (Teil 5: a confirmation
  // every morning, success or not), so in practice this only stays false if
  // CronRunLog itself is unreachable — that already surfaces via the outer
  // catch/withCronLog, not silently here.
  if (!fresh.length && !recurring.length && !advisorLines.length && !appointmentLines.length && !morningSyncLines.length) {
    return { sent: false, count: 0, fresh: 0, recurring: 0, quiet };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";

  const byCategory = new Map<Category, TaggedItem[]>();
  const tagged: TaggedItem[] = [...fresh.map((item) => ({ item, fresh: true })), ...recurring.map((item) => ({ item, fresh: false }))];
  for (const t of tagged) {
    if (t.item.category === "SYSTEM" && SUPPRESSED_SYSTEM_IDS.has(t.item.id)) continue;
    const cat: Category = t.item.category === "SEO_ADVISOR" ? "SEO" : t.item.category;
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), t]);
  }

  const systemExtra = byCategory.get("SYSTEM") ?? [];
  const systemShown = systemExtra.slice(0, CATEGORY_CAP);
  const systemRest = systemExtra.length - systemShown.length;
  const lines: string[] = [
    "",
    "<b>🔧 SYSTEM & SYNCS</b>",
    ...morningSyncLines,
    ...systemShown.map(formatItemLine),
    ...(systemRest > 0 ? [`… and ${systemRest} more → <a href="${siteUrl}/admin">Action Center</a>`] : []),
    ...buildCategorySection("🏗 DEVELOPERS & PROJECTS", byCategory.get("DEVELOPERS") ?? [], siteUrl),
    ...buildCategorySection("👤 CRM", byCategory.get("CRM") ?? [], siteUrl),
    ...appointmentLines,
    ...buildCategorySection("📈 SEO", byCategory.get("SEO") ?? [], siteUrl),
    ...advisorLines,
  ];

  const footerLines = [
    quiet > 0 ? `\n${quiet} other known issue${quiet === 1 ? "" : "s"} still open (reminded within the last ${REMINDER_THROTTLE_DAYS} days, not repeated today).` : "",
    "",
    `<a href="${siteUrl}/admin">Open Action Center</a>`,
  ].filter(Boolean);

  const header = "<b>📋 Daily Action Center Digest</b>";
  const chunks = lines.length ? chunkLines(header, lines) : [header];
  chunks[chunks.length - 1] = [chunks[chunks.length - 1], ...footerLines].join("\n");

  let anySent = false;
  for (const chunk of chunks) {
    const r = await sendTelegramMessage(chunk);
    if (r) anySent = true;
  }

  // Same structure as Telegram, reusing the exact same `lines` (a plain-text
  // strip of the HTML version) so the two can never drift apart — replaces
  // a separately hand-built plain-text version that duplicated all of the
  // section-building logic above.
  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "");
  const emailText = [
    "Daily Action Center Digest",
    ...lines.map(stripHtml),
    quiet > 0 ? `\n${quiet} other known issue(s) still open (not repeated today).` : "",
    "",
    `${siteUrl}/admin`,
  ].filter(Boolean).join("\n");
  await sendEmail({ subject: `Action Center Digest — ${fresh.length} new, ${recurring.length} reminder(s)`, text: emailText })
    .catch((e) => console.error("action-digest email failed:", e));

  return { sent: anySent, count: fresh.length + recurring.length, fresh: fresh.length, recurring: recurring.length, quiet };
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog("action-digest", runDigest, (r) => (r.sent ? `sent, ${r.count} item(s)` : "nothing to send"));
    const botCleanup = await runBotCleanup();
    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result, botCleanup });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
