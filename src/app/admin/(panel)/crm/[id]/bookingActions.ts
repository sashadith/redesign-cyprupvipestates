"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSignatureHtml, stripHtmlToText } from "@/lib/emailSignature";
import { sendUserEmail, getUserEmailSettingsRow } from "@/lib/crm/sendCrmEmail";
import { bodyToHtml, SIGNATURE_SPACER } from "@/lib/crm/emailBodyHtml";
import { buildEmailClosing } from "@/lib/crm/compose/closing";
import { uniqueBookingToken } from "@/lib/crm/bookingToken";
import { buildBookingIcs } from "@/lib/booking/ics";
import { formatInZone, CYPRUS_TZ } from "@/lib/booking/timezone";
import { BOOKING_CONFIRMATION_EMAIL, INTL_LOCALE } from "@/lib/crm/bookingMessages";
import type { Locale } from "@/lib/crm/presentationMessages";
import type { MeetingType } from "@prisma/client";

// Local, self-contained (mirrors every other CRM "use server" file's
// requireSession — not imported from admin/actions.ts since exporting it
// from there would turn an internal auth helper into a publicly-callable
// action).
async function requireSession() {
  const session = await auth();
  const uid = (session?.user as any)?.id;
  if (!session || !uid) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { isActive: true } });
  if (!user || !user.isActive) throw new Error("Unauthorized");
  return session;
}

function toLocale(pref: string | null | undefined): Locale {
  return (["en", "de", "pl", "ru"] as const).includes(pref as any) ? (pref as Locale) : "en";
}

// Same "build from the actual incoming request, never a hardcoded prod
// domain" reasoning as api/admin/presentations/route.ts's requestOrigin —
// this admin panel also runs on staging under its own host.
function requestOrigin(): string {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("host");
  return host ? `${proto}://${host}` : "https://cyprusvipestates.com";
}

export type BookingRequestSummary = {
  id: string;
  token: string;
  url: string;
  status: string;
  meetingType: MeetingType;
};

// Creates a fresh BookingRequest, or — if one is already open (PENDING or
// PROPOSED, not expired) — returns that one instead, per the explicit
// "don't create a duplicate link" requirement. No email is sent here; Sascha
// shares the link himself (Compose or manually).
export async function createOrGetBookingRequestAction(leadId: string, meetingType: MeetingType): Promise<BookingRequestSummary | { error: string }> {
  await requireSession();
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true } });
  if (!lead) return { error: "Lead not found." };

  const origin = requestOrigin();
  const existing = await prisma.bookingRequest.findFirst({
    where: { leadId, status: { in: ["PENDING", "PROPOSED"] }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return { id: existing.id, token: existing.token, url: `${origin}/book/${existing.token}`, status: existing.status, meetingType: existing.meetingType };
  }

  const token = await uniqueBookingToken();
  const expiresAt = new Date(Date.now() + 30 * 86_400_000);
  const created = await prisma.bookingRequest.create({ data: { leadId, token, meetingType, expiresAt } });
  revalidatePath(`/admin/crm/${leadId}`);
  return { id: created.id, token: created.token, url: `${origin}/book/${created.token}`, status: created.status, meetingType: created.meetingType };
}

// Called from the public, unauthenticated /book/[token] page — deliberately
// no requireSession(). Validates 2-3 slots and flips PENDING -> PROPOSED.
export async function proposeSlotAction(token: string, selectedUtcSlots: string[], leadTimezone: string): Promise<{ ok?: true; error?: string }> {
  const booking = await prisma.bookingRequest.findUnique({ where: { token } });
  if (!booking) return { error: "not_found" };
  if (booking.expiresAt && booking.expiresAt < new Date()) return { error: "expired" };
  if (booking.status !== "PENDING") return { error: "already_proposed" };

  const slots = selectedUtcSlots.filter((s) => !Number.isNaN(new Date(s).getTime()));
  if (slots.length < 1 || slots.length > 3) return { error: "invalid_slot_count" };
  if (slots.some((s) => new Date(s).getTime() < Date.now())) return { error: "invalid_slot_time" };

  await prisma.bookingRequest.update({
    where: { token },
    data: { status: "PROPOSED", proposedSlots: slots.map((utc) => ({ utc })), leadTimezone: leadTimezone.slice(0, 100) },
  });

  const proposedContent = `Lead proposed ${slots.length} time${slots.length === 1 ? "" : "s"} for a meeting`;
  await prisma.leadActivity.create({ data: { leadId: booking.leadId, type: "BOOKING_PROPOSED", content: proposedContent, createdBy: "lead" } });
  await prisma.leadInteraction.create({
    data: {
      leadId: booking.leadId,
      type: "BOOKING_EVENT",
      channel: "SYSTEM",
      body: proposedContent,
      metadata: { legacyType: "BOOKING_PROPOSED" },
    },
  });

  revalidatePath(`/admin/crm/${booking.leadId}`);
  return { ok: true };
}

// Sascha's one-click confirm: picks one of the lead's proposed slots, emails
// a localized confirmation with an .ics attachment (reusing the exact same
// signature/font/closing apparatus as Compose), and logs the timeline event.
export async function confirmBookingSlotAction(bookingRequestId: string, confirmedSlotUtcIso: string): Promise<{ ok?: string; error?: string }> {
  const session = await requireSession();
  const userId = (session.user as any).id as string;

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    include: { lead: { select: { id: true, firstName: true, lastName: true, email: true, languagePreference: true } } },
  });
  if (!booking) return { error: "Booking request not found." };
  if (!booking.lead.email) return { error: "This lead has no email address." };

  const confirmedSlotUtc = new Date(confirmedSlotUtcIso);
  if (Number.isNaN(confirmedSlotUtc.getTime())) return { error: "Invalid slot." };

  const locale = toLocale(booking.lead.languagePreference);
  const displayTz = booking.leadTimezone || CYPRUS_TZ;
  const formattedDateTime = formatInZone(confirmedSlotUtc, displayTz, INTL_LOCALE[locale]);
  const leadName = `${booking.lead.firstName} ${booking.lead.lastName}`.trim();

  const ics = buildBookingIcs({
    startUtc: confirmedSlotUtc,
    meetingType: booking.meetingType,
    leadName,
    leadEmail: booking.lead.email,
    uid: booking.id,
  });

  const { subject, body } = BOOKING_CONFIRMATION_EMAIL[locale](leadName, formattedDateTime, booking.meetingType);
  const closing = buildEmailClosing(locale);
  const fullBody = `${body}\n\n${closing}`;
  const signatureHtml = await getSignatureHtml(userId, locale);
  const html = `${bodyToHtml(fullBody)}${SIGNATURE_SPACER}${signatureHtml}`;
  const text = stripHtmlToText(html);

  let messageId: string;
  try {
    const settingsRow = await getUserEmailSettingsRow(userId);
    const sent = await sendUserEmail(userId, {
      to: booking.lead.email,
      bcc: settingsRow.fromAddress ?? undefined,
      subject,
      html,
      text,
      attachments: [{ filename: "appointment.ics", content: ics, contentType: "text/calendar; charset=utf-8" }],
    });
    messageId = sent.messageId;
  } catch (e: any) {
    return { error: e?.message || "Send failed." };
  }

  await prisma.bookingRequest.update({
    where: { id: bookingRequestId },
    data: { status: "CONFIRMED", confirmedSlotUtc, confirmedAt: new Date() },
  });

  const confirmedContent = `Meeting confirmed for ${formattedDateTime} (lead time)`;
  await prisma.leadActivity.create({
    data: { leadId: booking.leadId, type: "BOOKING_CONFIRMED", content: confirmedContent, createdBy: session.user?.name ?? "admin", createdById: userId },
  });
  await prisma.leadInteraction.create({
    data: {
      leadId: booking.leadId,
      type: "BOOKING_EVENT",
      channel: "SYSTEM",
      body: confirmedContent,
      createdByUserId: userId,
      createdByName: session.user?.name ?? "admin",
      // Phase 4 (email inbound) — lets a lead's reply thread back to this
      // row via In-Reply-To/References.
      messageId,
      metadata: { legacyType: "BOOKING_CONFIRMED" },
    },
  });

  revalidatePath(`/admin/crm/${booking.leadId}`);
  return { ok: `Confirmation sent to ${booking.lead.email}.` };
}

// Marks the "send the Zoom link separately" reminder as done — no static
// Zoom room exists (2026-07-25 decision), so this is the one manual step
// that must not be forgotten after confirming a ZOOM meeting.
export async function markZoomLinkSentAction(bookingRequestId: string): Promise<void> {
  await requireSession();
  const booking = await prisma.bookingRequest.update({ where: { id: bookingRequestId }, data: { zoomLinkSentAt: new Date() }, select: { leadId: true } });
  revalidatePath(`/admin/crm/${booking.leadId}`);
}
