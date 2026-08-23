// One place that decides what "17:08" means in the admin.
//
// Every admin date used to be formatted with a bare toLocaleString("en-GB"),
// with no timeZone. That takes the runtime's own zone, which differs by where
// the component renders:
//   - server components → the VPS, which runs UTC. "Last synced 17:08" while
//     the office clock said 20:08 (Cyprus is UTC+3 in summer).
//   - client components → whatever the viewer's browser is set to, so the same
//     timestamp reads differently depending on where the admin is sitting.
// Two timestamps side by side could therefore mean different things with
// nothing on screen to say so, and the size of the error changes twice a year
// with DST (+3 in summer, +2 in winter).
//
// The business runs on Cyprus time and the codebase already says so — the
// booking flow pins Asia/Nicosia (src/lib/booking/timezone.ts). Admin displays
// now pin the same zone, so a rendered time means one thing everywhere.
//
// Deliberately import-free so client components can use it without dragging a
// server-only module into the browser bundle — same reasoning as
// src/lib/seoPlaceholders.ts. It re-declares the zone rather than importing it
// from booking/timezone.ts, which also exports offset MATH that has no place in
// a display helper.
const CYPRUS_TZ = "Asia/Nicosia";

type DateInput = Date | string | number;

/** Date only, Cyprus time — "22 Aug 2026". */
export function adminDate(d: DateInput): string {
  return new Date(d).toLocaleDateString("en-GB", {
    timeZone: CYPRUS_TZ, day: "2-digit", month: "short", year: "numeric",
  });
}

/** Date and time, Cyprus time — "22 Aug 2026, 20:08". */
export function adminDateTime(d: DateInput): string {
  return new Date(d).toLocaleString("en-GB", {
    timeZone: CYPRUS_TZ, day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export { CYPRUS_TZ };
