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
import { formatInZone, CYPRUS_TZ } from "@/lib/booking/timezone";
import type { BookingRequest } from "@prisma/client";

export const dynamic = "force-dynamic";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type ReminderBooking = BookingRequest & { lead: { firstName: string; lastName: string } };

// Best-effort — a Telegram outage must never block the cron from marking
// the flag and moving on (a failed send still counts as "handled" here,
// same tradeoff as every other notify call site in the app; retrying a
// failed Telegram send is not worth risking a duplicate on the next tick).
async function sendReminder(booking: ReminderBooking, label: "1h" | "10m", siteUrl: string) {
  try {
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
    await sendTelegramMessage(msg);
  } catch (e) {
    console.error(`booking-reminders: Telegram send failed (${label}, booking ${booking.id}):`, e);
  }
}

async function scanAndSendReminders() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
  const now = Date.now();

  // Only rows with at least one flag still null — once both are set (sent
  // or deliberately skipped) a booking never needs to be looked at again.
  const bookings = await prisma.bookingRequest.findMany({
    where: {
      status: "CONFIRMED",
      confirmedSlotUtc: { not: null },
      OR: [{ reminder1hSentAt: null }, { reminder10mSentAt: null }],
    },
    include: { lead: { select: { firstName: true, lastName: true } } },
  });

  let sent1h = 0, sent10m = 0, closedOutPast = 0;
  for (const booking of bookings) {
    const minutesUntil = (booking.confirmedSlotUtc!.getTime() - now) / 60_000;
    const data: { reminder1hSentAt?: Date; reminder10mSentAt?: Date } = {};

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
    if (!booking.reminder1hSentAt && minutesUntil <= 60) {
      await sendReminder(booking, "1h", siteUrl);
      data.reminder1hSentAt = new Date();
      sent1h++;
    }
    if (!booking.reminder10mSentAt && minutesUntil <= 10) {
      await sendReminder(booking, "10m", siteUrl);
      data.reminder10mSentAt = new Date();
      sent10m++;
    }
    if (Object.keys(data).length) {
      await prisma.bookingRequest.update({ where: { id: booking.id }, data });
    }
  }

  return { scanned: bookings.length, sent1h, sent10m, closedOutPast };
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
      (r) => `scanned ${r.scanned}, sent 1h=${r.sent1h}, sent 10m=${r.sent10m}, closed out (past)=${r.closedOutPast}`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
