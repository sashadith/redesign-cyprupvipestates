"use client";

import { useTransition } from "react";
import { setManualSyncReminder, markDeveloperSyncedNow } from "../../actions";

// Manual-sync reminder control for hand-synced developers (e.g. AGG). The dropdown
// sets DeveloperAccount.manualSyncReminderDays; the Action Center's manualSyncDue()
// rule then surfaces a "sync due" item once driveSyncedAt is older than that.
// "Mark synced now" stamps driveSyncedAt (the sync scripts also do this, so it's an
// override for a sync done outside them).
export default function ManualReminderSelect({ developerAccountId, value }: { developerAccountId: string; value: number | null }) {
  const [pending, start] = useTransition();
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
        Reminder
        <select
          defaultValue={value ?? 0}
          disabled={pending}
          onChange={(e) => start(() => setManualSyncReminder(developerAccountId, Number(e.target.value)))}
          className="rounded-md border border-[#E5E7EB] px-2 py-1 text-sm text-[#111827] outline-none focus:border-[#1B4B43] disabled:opacity-60"
        >
          <option value={0}>off</option>
          <option value={30}>monthly</option>
        </select>
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => markDeveloperSyncedNow(developerAccountId))}
        className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs text-[#6B7280] hover:border-[#1B4B43] disabled:opacity-60"
      >
        Mark synced now
      </button>
    </div>
  );
}
