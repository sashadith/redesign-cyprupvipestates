import { createEvent } from "ics";

// 30 minutes — a real advisory call, not the short initial-contact "quick
// call" Compose offers (see call-offer.md's 15-minute framing for that,
// separate context). Kept as a constant here since it's specific to this
// confirmed-meeting flow.
const DURATION_MINUTES = 30;

const ORGANIZER = { name: "Sascha Dith", email: "sascha.dith@cyprusvipestates.com" };

/**
 * Builds a standards-compliant VCALENDAR/VEVENT string for a confirmed
 * booking. Time is passed as a UTC instant with startInputType/OutputType
 * both "utc" so the ics library emits a bare "Z"-suffixed UTC time — every
 * calendar client resolves that to the recipient's own local time correctly,
 * which is the one place in this feature where getting timezones exactly
 * right actually matters.
 */
export function buildBookingIcs(opts: {
  startUtc: Date;
  meetingType: "ZOOM" | "PHONE";
  leadName: string;
  leadEmail: string;
  uid: string; // stable per BookingRequest, so re-sending doesn't create a duplicate calendar entry
}): string {
  const start = opts.startUtc;
  const kind = opts.meetingType === "ZOOM" ? "Zoom" : "Phone";
  const description =
    opts.meetingType === "ZOOM"
      ? "Sascha will send the Zoom link separately before the call."
      : "Sascha will call you at the agreed time.";

  const { error, value } = createEvent({
    start: [start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes()],
    startInputType: "utc",
    startOutputType: "utc",
    duration: { minutes: DURATION_MINUTES },
    title: `Cyprus VIP Estates — ${kind} with Sascha Dith`,
    description,
    organizer: ORGANIZER,
    attendees: [{ name: opts.leadName, email: opts.leadEmail, rsvp: true }],
    status: "CONFIRMED",
    busyStatus: "BUSY",
    productId: "cyprusvipestates.com/booking",
    uid: opts.uid,
    // Without an explicit METHOD, Gmail renders the .ics as a plain
    // attachment instead of a recognized invite — no "Yes/No/Maybe" RSVP
    // buttons. REQUEST (paired with the ATTENDEE/rsvp above) is what makes
    // Gmail/Apple Mail treat this as a real calendar invitation.
    method: "REQUEST",
  });

  if (error || !value) throw error ?? new Error("ICS generation returned no value");
  return value;
}
