"use client";

import { useState, useTransition } from "react";
import { confirmBookingSlotAction } from "./bookingActions";

// One proposed slot, one click to confirm — sends the localized confirmation
// email + .ics immediately. Once any slot on this BookingRequest is
// confirmed, the whole request flips to CONFIRMED and revalidatePath drops
// this card from the page on the next render, so there's no client-side
// bookkeeping needed for the sibling slots.
export default function BookingConfirmCard({
  bookingRequestId,
  slotUtc,
  cyprusLabel,
  leadLabel,
}: {
  bookingRequestId: string;
  slotUtc: string;
  cyprusLabel: string;
  leadLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);

  const confirm = () => {
    startTransition(async () => {
      setResult(await confirmBookingSlotAction(bookingRequestId, slotUtc));
    });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#F8F9FA] px-3 py-2">
      <span className="text-sm">
        <span className="font-medium">{leadLabel}</span>
        <span className="text-[#6B7280]"> their time · {cyprusLabel} Cyprus time</span>
      </span>
      {result?.ok ? (
        <span className="text-sm text-[#2D6E62]">{result.ok}</span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={confirm}
          className="rounded-md bg-[#1B4B43] text-white text-xs px-3 py-1.5 hover:bg-[#142E2D] disabled:opacity-50"
        >
          {pending ? "Confirming…" : "Confirm this time"}
        </button>
      )}
      {result?.error && <span className="text-xs text-[#DC2626] w-full">{result.error}</span>}
    </li>
  );
}
