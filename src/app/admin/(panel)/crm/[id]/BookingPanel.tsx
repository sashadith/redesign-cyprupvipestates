import { formatInZone, CYPRUS_TZ } from "@/lib/booking/timezone";
import BookingConfirmCard from "./BookingConfirmCard";
import ZoomLinkReminder from "./ZoomLinkReminder";

export type BookingRow = {
  id: string;
  status: string;
  meetingType: "ZOOM" | "PHONE";
  proposedSlots: { utc: string }[] | null;
  leadTimezone: string | null;
  confirmedSlotUtc: Date | null;
  zoomLinkSentAt: Date | null;
};

// Only surfaces BookingRequests that need Sascha's attention right now —
// PENDING links already have their own copy-link UI in BookingButton, and a
// CONFIRMED meeting with its Zoom link already sent needs nothing further.
// Renders nothing at all when there's nothing to act on.
export default function BookingPanel({ bookings }: { bookings: BookingRow[] }) {
  const proposed = bookings.filter((b) => b.status === "PROPOSED" && b.proposedSlots?.length);
  const needsZoomLink = bookings.filter((b) => b.status === "CONFIRMED" && b.meetingType === "ZOOM" && !b.zoomLinkSentAt);

  if (!proposed.length && !needsZoomLink.length) return null;

  return (
    <div className="space-y-4 mb-6">
      {proposed.map((b) => (
        <div key={b.id} className="bg-white rounded-lg border border-[#E5E7EB] p-4">
          <h2 className="text-sm font-semibold text-[#111827] mb-2">
            Proposed meeting times ({b.meetingType === "ZOOM" ? "Zoom" : "Phone"})
          </h2>
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
      {needsZoomLink.map((b) => (
        <ZoomLinkReminder
          key={b.id}
          bookingRequestId={b.id}
          confirmedAt={b.confirmedSlotUtc ? formatInZone(b.confirmedSlotUtc, b.leadTimezone || CYPRUS_TZ) : ""}
        />
      ))}
    </div>
  );
}
