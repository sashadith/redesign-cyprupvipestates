"use client";

import { useTransition } from "react";
import { setMonthlyManualSync, markMonthlySyncDone } from "../../actions";

// The monthly manual-sync round (2026-10-16): first Monday of every month, one
// Action Center item listing the accounts still open. "In the round" puts this
// account on that list; "Mark done" takes it off for the current round.
export default function MonthlySyncControl({ developerAccountId, inRound }: { developerAccountId: string; inRound: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
        <input
          type="checkbox"
          defaultChecked={inRound}
          disabled={pending}
          onChange={(e) => start(() => setMonthlyManualSync(developerAccountId, e.target.checked))}
          className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-[#1B4B43]"
        />
        In the monthly round (first Monday)
      </label>
      {inRound && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => markMonthlySyncDone(developerAccountId))}
          className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs text-[#6B7280] hover:border-[#1B4B43] disabled:opacity-60"
        >
          Mark this month&apos;s sync done
        </button>
      )}
    </div>
  );
}
