"use client";

import { useTransition } from "react";
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
  const [pending, startTransition] = useTransition();
  const current = bucketOf(source);

  return (
    <select
      aria-label="Move lead to another list"
      disabled={pending}
      value=""
      // The table row is wrapped in a link; without this, opening the menu
      // navigates to the lead instead.
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const next = e.target.value as LeadBucket;
        if (!next || next === current) return;
        if (!confirm(`Move this lead to ${BUCKET_LABEL[next]}?`)) return;
        startTransition(async () => {
          try {
            await moveLeadToBucket(id, next);
          } catch (err) {
            // Every other action in this admin is called bare inside a
            // transition, so a thrown error reaches nobody: the row simply does
            // not move and the operator is left guessing. One alert is a small
            // price for not silently swallowing a failed write.
            alert(`Could not move the lead: ${err instanceof Error ? err.message : String(err)}`);
          }
        });
      }}
      className={className ?? "rounded-md border border-[#E5E7EB] bg-white text-xs px-2 py-1 text-[#6B7280] disabled:opacity-50"}
    >
      <option value="">{pending ? "Moving…" : "Move…"}</option>
      {LEAD_BUCKETS.filter((b) => b !== current).map((b) => (
        <option key={b} value={b}>{BUCKET_LABEL[b]}</option>
      ))}
    </select>
  );
}
