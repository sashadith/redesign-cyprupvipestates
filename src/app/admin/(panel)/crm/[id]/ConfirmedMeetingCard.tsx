"use client";

import { useState, useTransition } from "react";
import { cancelBookingAction, markZoomLinkSentAction } from "./bookingActions";

// A confirmed meeting is now ALWAYS visible here — regardless of whether
// its Zoom link has already been sent (2026-07-26 fix: it previously
// rendered nothing at all once the link was marked sent, leaving no way to
// ever cancel a fully wrapped-up meeting). The Zoom-link-not-sent reminder
// (folded in from the old standalone ZoomLinkReminder) is a sub-section of
// this same card, not a separate one.
export default function ConfirmedMeetingCard({
  bookingRequestId,
  leadName,
  meetingType,
  confirmedAtCyprus,
  needsZoomLink,
}: {
  bookingRequestId: string;
  leadName: string;
  meetingType: "ZOOM" | "PHONE";
  confirmedAtCyprus: string;
  needsZoomLink: boolean;
}) {
  const [cancelPending, startCancelTransition] = useTransition();
  const [zoomPending, startZoomTransition] = useTransition();
  const [cancelled, setCancelled] = useState(false);
  const [zoomSent, setZoomSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = () => {
    if (!confirm(`Cancel the meeting with ${leadName} on ${confirmedAtCyprus} (Cyprus time)?`)) return;
    setError(null);
    startCancelTransition(async () => {
      const res = await cancelBookingAction(bookingRequestId);
      if (res.error) setError(res.error);
      else setCancelled(true);
    });
  };

  const markZoomSent = () => {
    startZoomTransition(async () => {
      await markZoomLinkSentAction(bookingRequestId);
      setZoomSent(true);
    });
  };

  if (cancelled) return null;

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">{confirmedAtCyprus} Cyprus time</span>
          <span className="text-[#6B7280]"> · {meetingType === "ZOOM" ? "Zoom" : "Phone"}</span>
        </div>
        <button
          type="button"
          disabled={cancelPending}
          onClick={cancel}
          className="rounded-md border border-[#DC2626] text-[#DC2626] text-xs px-3 py-1.5 hover:bg-[#DC2626] hover:text-white disabled:opacity-50"
        >
          {cancelPending ? "Cancelling…" : "Cancel meeting"}
        </button>
      </div>
      {error && <p className="text-xs text-[#DC2626] mt-2">{error}</p>}
      {needsZoomLink && !zoomSent && (
        <div className="mt-3 bg-[#FFF7ED] border border-[#FED7AA] rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[#9A3412]">⚠ Send the Zoom link separately, then mark it as sent.</p>
          <button
            type="button"
            disabled={zoomPending}
            onClick={markZoomSent}
            className="rounded-md border border-[#9A3412] text-[#9A3412] text-xs px-3 py-1.5 hover:bg-[#9A3412] hover:text-white disabled:opacity-50"
          >
            {zoomPending ? "Marking…" : "Zoom link sent"}
          </button>
        </div>
      )}
    </div>
  );
}
