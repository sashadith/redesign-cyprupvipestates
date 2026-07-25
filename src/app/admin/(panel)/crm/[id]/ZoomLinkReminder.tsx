"use client";

import { useState, useTransition } from "react";
import { markZoomLinkSentAction } from "./bookingActions";

// The one manual step that must not go unnoticed: with no static Zoom room
// (2026-07-25 decision), a confirmed ZOOM meeting has no link yet — this
// banner persists (reappears on every page load via bookingRequest.zoomLinkSentAt
// staying null) until Sascha marks it sent.
export default function ZoomLinkReminder({ bookingRequestId, confirmedAt }: { bookingRequestId: string; confirmedAt: string }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  const markSent = () => {
    startTransition(async () => {
      await markZoomLinkSentAction(bookingRequestId);
      setSent(true);
    });
  };

  if (sent) return null;

  return (
    <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[#9A3412]">
        ⚠ Meeting confirmed for {confirmedAt} — send the Zoom link separately, then mark it as sent.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={markSent}
        className="rounded-md border border-[#9A3412] text-[#9A3412] text-xs px-3 py-1.5 hover:bg-[#9A3412] hover:text-white disabled:opacity-50"
      >
        {pending ? "Marking…" : "Zoom link sent"}
      </button>
    </div>
  );
}
