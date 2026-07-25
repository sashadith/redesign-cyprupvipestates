"use client";

import { useState, useTransition } from "react";
import { createOrGetBookingRequestAction } from "./bookingActions";

// The Cockpit's "Booking link" button (Phase 3). Always goes through
// createOrGetBookingRequestAction, which itself dedupes against any already-
// open (PENDING/PROPOSED) request — so re-clicking after one already exists
// just re-shows the same link instead of creating a second one. No email is
// ever sent from here; Sascha shares the link himself.
export default function BookingButton({ leadId }: { leadId: string }) {
  const [phase, setPhase] = useState<"idle" | "pick" | "result" | "error">("idle");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ url: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = (meetingType: "ZOOM" | "PHONE") => {
    startTransition(async () => {
      const res = await createOrGetBookingRequestAction(leadId, meetingType);
      if ("error" in res) {
        setError(res.error);
        setPhase("error");
      } else {
        setResult({ url: res.url, status: res.status });
        setPhase("result");
      }
    });
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const close = () => { setPhase("idle"); setError(null); };

  return (
    <>
      <button
        type="button"
        onClick={() => setPhase("pick")}
        className="flex-1 sm:flex-none text-center rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-2 hover:bg-[#1B4B43]/5"
      >
        Booking link
      </button>

      {phase === "pick" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={close}>
          <div className="bg-white rounded-lg p-6 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#111827]">Meeting type</h3>
            <p className="text-xs text-[#9CA3AF]">If a booking link already exists for this lead, it will be reused instead of creating a new one.</p>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => create("ZOOM")} className="flex-1 rounded-md bg-[#1B4B43] text-white text-sm px-4 py-2 hover:bg-[#142E2D] disabled:opacity-50">Zoom</button>
              <button type="button" disabled={pending} onClick={() => create("PHONE")} className="flex-1 rounded-md bg-[#1B4B43] text-white text-sm px-4 py-2 hover:bg-[#142E2D] disabled:opacity-50">Phone</button>
            </div>
            <button type="button" onClick={close} className="text-sm text-[#6B7280] hover:text-[#111827]">Cancel</button>
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={close}>
          <div className="bg-white rounded-lg p-6 max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#111827]">
              {result.status === "PENDING" ? "Booking link created" : "Existing booking link"}
            </h3>
            <div className="flex items-center gap-2">
              <input readOnly value={result.url} onFocus={(e) => e.target.select()} className="flex-1 rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm" />
              <button type="button" onClick={copy} className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-3 py-1.5 hover:bg-[#1B4B43]/5">{copied ? "Copied" : "Copy"}</button>
            </div>
            <p className="text-[11px] text-[#9CA3AF]">Share this yourself (Compose or manually) — no email is sent automatically.</p>
            <button type="button" onClick={close} className="text-sm text-[#6B7280] hover:text-[#111827]">Close</button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={close}>
          <div className="bg-white rounded-lg p-6 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#111827]">Could not create booking link</h3>
            <p className="text-sm text-[#DC2626]">{error}</p>
            <button type="button" onClick={close} className="text-sm text-[#6B7280] hover:text-[#111827]">Close</button>
          </div>
        </div>
      )}
    </>
  );
}
