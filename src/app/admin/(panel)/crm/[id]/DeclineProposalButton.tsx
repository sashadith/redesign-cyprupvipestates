"use client";

import { useState, useTransition } from "react";
import { cancelBookingAction } from "./bookingActions";

// Declines a lead's set of proposed candidate times when none of them work —
// flips the BookingRequest to CANCELLED (see cancelBookingAction) so it
// disappears from the calendar and this panel. The public /book/[token]
// link then shows the same "Gone" page as an expired link; the link is
// permanently dead (2026-07-26 decision) — a fresh booking link is created
// separately if Sascha wants to try again with this lead.
export default function DeclineProposalButton({ bookingRequestId, leadName }: { bookingRequestId: string; leadName: string }) {
  const [pending, startTransition] = useTransition();
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decline = () => {
    if (!confirm(`Decline the proposed meeting times from ${leadName}? None of these will work.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await cancelBookingAction(bookingRequestId);
      if (res.error) setError(res.error);
      else setDeclined(true);
    });
  };

  if (declined) return null;

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-[#DC2626]">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={decline}
        className="rounded-md border border-[#9CA3AF] text-[#6B7280] text-xs px-3 py-1.5 hover:bg-[#F3F4F6] disabled:opacity-50"
      >
        {pending ? "Declining…" : "None of these work"}
      </button>
    </div>
  );
}
