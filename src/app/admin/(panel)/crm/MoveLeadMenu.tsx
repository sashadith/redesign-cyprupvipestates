"use client";

import { useState, useTransition } from "react";
import { moveLeadToBucket } from "../../actions";
import { LEAD_BUCKETS, BUCKET_LABEL, bucketOf, type LeadBucket } from "@/lib/crm/leadBucket";

// An action menu, not a state display. Its value is always "" and the lead's
// current bucket is filtered out of the options, so picking an option can only
// ever mean "move there".
//
// A controlled <select> showing the current bucket would be wrong here: when the
// user cancels the confirm dialog nothing re-renders, so the browser would keep
// showing the bucket they picked while the lead never moved.
//
// A <select> rather than a popover like StatusPopover next door: that one is a
// portal-rendered panel because changing a status can require capturing a
// contact afterwards. Moving a bucket never does.
export default function MoveLeadMenu({
  id, source, className,
}: {
  id: string;
  source: string;
  className?: string;
}) {
  // Pending is held in useState, not taken from useTransition. Under React 18 a
  // transition does not track an async callback past its first await, so
  // isPending would flip back to false before the server action even started and
  // `disabled` would never engage — leaving a double-click free to fire two moves.
  // DeleteLeadButton next door avoids this by using the synchronous form of
  // startTransition; that is not available here, because the try/catch needs the
  // await.
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const current = bucketOf(source);

  return (
    <select
      aria-label="Move lead to another list"
      disabled={pending}
      value=""
      // Defensive, matching DeleteLeadButton next door: the row is a plain <tr>
      // today, so nothing is intercepted, but a future row-level click-to-open
      // would otherwise navigate away the moment this menu is opened.
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const next = e.target.value as LeadBucket;
        if (!next || next === current) return;
        if (!confirm(`Move this lead to ${BUCKET_LABEL[next]}?`)) return;
        setPending(true);
        startTransition(async () => {
          try {
            await moveLeadToBucket(id, next);
          } catch (err) {
            // Every other action in this admin is called bare inside a
            // transition, so a thrown error reaches nobody: the row simply does
            // not move and the operator is left guessing. One alert is a small
            // price for not silently swallowing a failed write.
            alert(`Could not move the lead: ${err instanceof Error ? err.message : String(err)}`);
          } finally {
            setPending(false);
          }
        });
      }}
      title={pending ? "Moving…" : "Move to another list"}
      /* A square icon button rather than a labelled dropdown: it sits in the
         actions column next to Delete on every row, and the word "Move…" cost
         more width there than it earned. The chevron is drawn as a background
         image because appearance-none removes the native one; the first option
         carries no text so the closed control shows only that chevron. The
         label lives in aria-label and title. */
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
      /* 26px square: that is exactly what DeleteLeadButton next door measures
         (12px text on a 16px line, 4px padding, 1px border), and the two sit
         side by side in every row. */
      className={className ?? "h-[26px] w-[26px] shrink-0 cursor-pointer appearance-none rounded-md border border-[#E5E7EB] bg-white text-xs text-[#6B7280] transition-colors hover:border-[#1B4B43] disabled:opacity-50"}
    >
      <option value="">{pending ? "Moving…" : ""}</option>
      {LEAD_BUCKETS.filter((b) => b !== current).map((b) => (
        <option key={b} value={b}>{BUCKET_LABEL[b]}</option>
      ))}
    </select>
  );
}
