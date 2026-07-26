import { formatInZone, CYPRUS_TZ } from "@/lib/booking/timezone";
import BookingConfirmCard from "./BookingConfirmCard";
import ConfirmedMeetingCard from "./ConfirmedMeetingCard";
import DeclineProposalButton from "./DeclineProposalButton";

export type BookingRow = {
  id: string;
  status: string;
  meetingType: "ZOOM" | "PHONE";
  proposedSlots: { utc: string }[] | null;
  leadTimezone: string | null;
  confirmedSlotUtc: Date | null;
  zoomLinkSentAt: Date | null;
};

// Surfaces every BookingRequest that's still "live" for this lead — a
// PENDING link already has its own copy-link UI in BookingButton, and a
// CANCELLED one is dead (see cancelBookingAction) and needs no further
// display. A CONFIRMED meeting is now ALWAYS shown here (2026-07-26 —
// previously this only rendered when a Zoom link still needed sending,
// which meant a fully wrapped-up meeting had no cancel entry point at all)
// alongside its Cancel action; PROPOSED candidates get a Decline action
// next to the existing per-slot Confirm buttons. Renders nothing at all
// when there's truly nothing live.
export default function BookingPanel({ bookings, leadName }: { bookings: BookingRow[]; leadName: string }) {
  const proposed = bookings.filter((b) => b.status === "PROPOSED" && b.proposedSlots?.length);
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED" && b.confirmedSlotUtc);

  if (!proposed.length && !confirmed.length) return null;

  return (
    <div className="space-y-4 mb-6">
      {proposed.map((b) => (
        <div key={b.id} className="bg-white rounded-lg border border-[#E5E7EB] p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-[#111827]">
              Proposed meeting times ({b.meetingType === "ZOOM" ? "Zoom" : "Phone"})
            </h2>
            <DeclineProposalButton bookingRequestId={b.id} leadName={leadName} />
          </div>
          <ul className="space-y-2">
            {(b.proposedSlots ?? []).map((slot) => (
              <BookingConfirmCard
                key={slot.utc}
                bookingRequestId={b.id}
                slotUtc={slot.utc}
                cyprusLabel={formatInZone(new Date(slot.utc), CYPRUS_TZ)}
                leadLabel={formatInZone(new Date(slot.utc), b.leadTimezone || CYPRUS_TZ)}
              />
            ))}
          </ul>
        </div>
      ))}
      {confirmed.map((b) => (
        <ConfirmedMeetingCard
          key={b.id}
          bookingRequestId={b.id}
          leadName={leadName}
          meetingType={b.meetingType}
          confirmedAtCyprus={formatInZone(b.confirmedSlotUtc!, CYPRUS_TZ)}
          needsZoomLink={b.meetingType === "ZOOM" && !b.zoomLinkSentAt}
        />
      ))}
    </div>
  );
}
