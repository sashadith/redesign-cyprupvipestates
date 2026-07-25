import { cyprusWallTimeToUtc } from "./timezone";

// Fixed hourly slots rather than vague "morning/afternoon" blocks — Sascha's
// confirmation is a single click on one of the lead's picks (see the Phase 3
// spec), so a proposed slot has to already be a concrete, calendar-invite-
// ready time, not a loose window that would need a follow-up to pin down.
const DAILY_HOURS = [9, 11, 13, 15, 17]; // Cyprus time
const DAYS_AHEAD = 14;
const MIN_LEAD_HOURS = 3; // don't offer a slot less than 3h from now

export type BookingSlot = { utc: string }; // ISO string — the shape stored in proposedSlots/passed around the UI

/** The full list of offerable slots for the next DAYS_AHEAD days, as UTC instants. */
export function generateAvailableSlots(now: Date = new Date()): BookingSlot[] {
  const slots: BookingSlot[] = [];
  const minInstant = now.getTime() + MIN_LEAD_HOURS * 3_600_000;

  // Iterate calendar days in Cyprus time so "the next 14 days" means what a
  // Cyprus-based advisor would expect, not an arbitrary UTC day boundary.
  const cyprusNow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Nicosia", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [startY, startM, startD] = cyprusNow.split("-").map(Number);
  const startOfDayUtc = Date.UTC(startY, startM - 1, startD);

  for (let d = 0; d < DAYS_AHEAD; d++) {
    const dayMs = startOfDayUtc + d * 86_400_000;
    const day = new Date(dayMs);
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const dd = day.getUTCDate();
    for (const hour of DAILY_HOURS) {
      const utc = cyprusWallTimeToUtc(y, m, dd, hour, 0);
      if (utc.getTime() >= minInstant) slots.push({ utc: utc.toISOString() });
    }
  }
  return slots;
}
