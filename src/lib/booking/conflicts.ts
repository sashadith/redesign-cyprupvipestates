// Double-booking protection (Batch D, 2026-07-26) — shared between the
// public /book/[token] slot picker (hide/disable already-booked times) and
// the admin confirm action (block a silent double-confirm). Only CONFIRMED
// bookings ever block anything; a PROPOSED booking a lead submitted but
// Sascha never confirmed must never reserve a slot against other leads.
import { prisma } from "@/lib/prisma";

// Simple fixed duration, not a per-meeting-type setting — every confirmed
// meeting (Zoom or phone) is treated as occupying 60 minutes from its start
// for overlap purposes. The public slot grid is 2 hours apart (see
// DAILY_HOURS in slots.ts), so 60 minutes never bleeds into a neighboring
// slot.
export const MEETING_DURATION_MINUTES = 60;

export type ConfirmedBookingBrief = { id: string; confirmedSlotUtc: Date; leadName: string };

function overlaps(aUtc: Date, bUtc: Date): boolean {
  return Math.abs(aUtc.getTime() - bUtc.getTime()) < MEETING_DURATION_MINUTES * 60_000;
}

/** Every currently-CONFIRMED booking, lightweight (id, slot, lead name) — the one source both call sites check against. */
export async function getConfirmedBookings(): Promise<ConfirmedBookingBrief[]> {
  const rows = await prisma.bookingRequest.findMany({
    where: { status: "CONFIRMED", confirmedSlotUtc: { not: null } },
    select: { id: true, confirmedSlotUtc: true, lead: { select: { firstName: true, lastName: true } } },
  });
  return rows.map((r) => ({ id: r.id, confirmedSlotUtc: r.confirmedSlotUtc!, leadName: `${r.lead.firstName} ${r.lead.lastName}`.trim() }));
}

/** The first confirmed booking (if any) whose 60-minute window overlaps this candidate instant. */
export function findConflict(candidateUtc: Date, confirmed: ConfirmedBookingBrief[]): ConfirmedBookingBrief | null {
  return confirmed.find((b) => overlaps(candidateUtc, b.confirmedSlotUtc)) ?? null;
}
