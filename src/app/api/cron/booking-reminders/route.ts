// Telegram meeting reminders for confirmed bookings (Batch C part 3,
// 2026-07-25) — reuses the same sendTelegramMessage mechanism as every other
// Telegram push in the app (see src/lib/telegram.ts).
// Called by cron: curl -s "http://127.0.0.1:3200/api/cron/booking-reminders?key=$CRON_SECRET"
// Suggested schedule: every 5 minutes, offset from publish-scheduled's (*/5)
// and email-inbound's (2,7,12,...) identical cadence — see DEPLOYMENT.md.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronLog } from "@/lib/cronLog";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/sendEmail";
import { formatInZone, CYPRUS_TZ } from "@/lib/booking/timezone";
import type { BookingRequest } from "@prisma/client";

export const dynamic = "force-dynamic";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type ReminderBooking = BookingRequest & { lead: { firstName: string; lastName: string } };

// 2026-08-11 (delivery-blind-spot fix) — ~25 minutes of retries at the 5-min
// cron cadence, comfortably covering a transient Telegram blip within the 1h
// reminder's own window. The 10m reminder's window (≤10 min) closes out via
// the past-due branch below well before this cap would ever actually bind —
// it exists mainly so the 1h reminder doesn't retry silently for the full
// hour before anyone is told.
const MAX_REMINDER_ATTEMPTS = 5;

type SendOutcome = "sent" | "skipped" | "failed";

// Distinguishes a genuine delivery failure (Telegram down/erroring — must
// NOT be marked sent, must retry) from a deliberate no-op (Telegram not
// configured, e.g. staging — sendTelegramMessage returns null; that's not a
// failure and must not retry or alert). Previously this swallowed the error
// entirely and the caller marked SentAt unconditionally regardless of which
// of these two cases it was.
async function sendReminder(booking: ReminderBooking, label: "1h" | "10m", siteUrl: string): Promise<SendOutcome> {
  const leadName = `${booking.lead.firstName} ${booking.lead.lastName}`.trim();
  const time = formatInZone(booking.confirmedSlotUtc!, CYPRUS_TZ);
  const typeLabel = booking.meetingType === "ZOOM" ? "Zoom" : "Phone";
  const whenLabel = label === "1h" ? "in 1 hour" : "in 10 minutes";
  const zoomNote = booking.meetingType === "ZOOM" && !booking.zoomLinkSentAt
    ? "\n\n⚠️ Send the Zoom link to the client if you haven't already."
    : "";
  const msg =
    `<b>⏰ Meeting ${whenLabel}</b>\n` +
    `${esc(leadName)} — ${time} (Cyprus time) · ${typeLabel}` +
    zoomNote +
    `\n\n<a href="${siteUrl}/admin/crm/${booking.leadId}">Open in CRM</a>`;
  try {
    const result = await sendTelegramMessage(msg);
    return result === null ? "skipped" : "sent";
  } catch (e) {
    console.error(`booking-reminders: Telegram send failed (${label}, booking ${booking.id}):`, e);
    return "failed";
  }
}

// Fired once per reminder that's given up on (MAX_REMINDER_ATTEMPTS
// exhausted) — same Telegram+email transport as the feed/drive-sync failure
// notifications (src/lib/feedNotifications.ts's sendFeedNotification), but
// defined locally rather than added there: that module is scoped to the 4am
// feed-sync cron's own inventory-change messages, not booking events.
async function sendFailureAlert(booking: ReminderBooking, label: "1h" | "10m", siteUrl: string): Promise<void> {
  const leadName = `${booking.lead.firstName} ${booking.lead.lastName}`.trim();
  const time = formatInZone(booking.confirmedSlotUtc!, CYPRUS_TZ);
  const text = [
    `🔴 Meeting reminder (${label}) failed to send — ${leadName}`,
    `Meeting at ${time} (Cyprus time). Telegram delivery failed ${MAX_REMINDER_ATTEMPTS} times in a row — giving up, the client was not notified by this system.`,
    `Reach out manually if the meeting is still upcoming.`,
    `${siteUrl}/admin/crm/${booking.leadId}`,
  ].join("\n");
  const subject = `Meeting reminder (${label}) failed — ${leadName}`;
  await Promise.allSettled([sendTelegramMessage(text), sendEmail({ subject, text })]);
}

async function scanAndSendReminders() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
  const now = Date.now();

  // Only rows with at least one flag still null — once both are set (sent,
  // deliberately skipped, or given up on) a booking never needs to be
  // looked at again.
  const bookings = await prisma.bookingRequest.findMany({
    where: {
      status: "CONFIRMED",
      confirmedSlotUtc: { not: null },
      OR: [{ reminder1hSentAt: null }, { reminder10mSentAt: null }],
    },
    include: { lead: { select: { firstName: true, lastName: true } } },
  });

  let sent1h = 0, sent10m = 0, failed1h = 0, failed10m = 0, closedOutPast = 0;
  const alerts: Promise<void>[] = [];

  for (const booking of bookings) {
    const minutesUntil = (booking.confirmedSlotUtc!.getTime() - now) / 60_000;
    const data: { reminder1hSentAt?: Date; reminder10mSentAt?: Date; reminder1hAttempts?: number; reminder10mAttempts?: number } = {};

    if (minutesUntil < 0) {
      // Already happened (e.g. the cron was down for a while) — close out
      // any still-open flag WITHOUT sending; a reminder for a meeting
      // that's already over makes no sense, but the row must stop
      // reappearing in every future scan.
      if (!booking.reminder1hSentAt) data.reminder1hSentAt = new Date();
      if (!booking.reminder10mSentAt) data.reminder10mSentAt = new Date();
      if (Object.keys(data).length) {
        await prisma.bookingRequest.update({ where: { id: booking.id }, data });
        closedOutPast++;
      }
      continue;
    }

    // Window-based, not exact-minute: a 5-minute cron tick will never land
    // on exactly 60 or 10 minutes out, so "within the next N minutes AND
    // not yet sent" is what actually catches it — the flag is what
    // prevents a double-send on the next tick, not the window's precision.
    //
    // Send-then-mark (2026-08-11): SentAt is only set on a real "sent" or
    // "skipped" (not-configured) outcome. A genuine failure increments the
    // attempts counter and leaves SentAt null so the next tick retries —
    // until MAX_REMINDER_ATTEMPTS, at which point it gives up (sets SentAt
    // so it stops rescanning) and sends its own failure alert.
    if (!booking.reminder1hSentAt && minutesUntil <= 60) {
      const outcome = await sendReminder(booking, "1h", siteUrl);
      if (outcome !== "failed") {
        data.reminder1hSentAt = new Date();
        if (outcome === "sent") sent1h++;
      } else {
        failed1h++;
        const attempts = booking.reminder1hAttempts + 1;
        data.reminder1hAttempts = attempts;
        if (attempts >= MAX_REMINDER_ATTEMPTS) {
          data.reminder1hSentAt = new Date();
          alerts.push(sendFailureAlert(booking, "1h", siteUrl));
        }
      }
    }
    if (!booking.reminder10mSentAt && minutesUntil <= 10) {
      const outcome = await sendReminder(booking, "10m", siteUrl);
      if (outcome !== "failed") {
        data.reminder10mSentAt = new Date();
        if (outcome === "sent") sent10m++;
      } else {
        failed10m++;
        const attempts = booking.reminder10mAttempts + 1;
        data.reminder10mAttempts = attempts;
        if (attempts >= MAX_REMINDER_ATTEMPTS) {
          data.reminder10mSentAt = new Date();
          alerts.push(sendFailureAlert(booking, "10m", siteUrl));
        }
      }
    }
    if (Object.keys(data).length) {
      await prisma.bookingRequest.update({ where: { id: booking.id }, data });
    }
  }

  // Best-effort, same reasoning as feed-sync's own notification batch — a
  // Telegram/email hiccup here must never fail the cron itself.
  await Promise.allSettled(alerts);

  return { scanned: bookings.length, sent1h, sent10m, failed1h, failed10m, closedOutPast };
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await withCronLog(
      "booking-reminders",
      scanAndSendReminders,
      (r) => `scanned ${r.scanned}, sent 1h=${r.sent1h}, sent 10m=${r.sent10m}, failed 1h=${r.failed1h}, failed 10m=${r.failed10m}, closed out (past)=${r.closedOutPast}`,
      // Same aggregate-blindness fix as drive-sync/feed-sync (see withCronLog's
      // comment in src/lib/cronLog.ts) — a failed send attempt this run
      // (still retrying, not yet given up) should already show up here, not
      // just once the retry cap is hit.
      (r) => r.failed1h === 0 && r.failed10m === 0,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
