"use client";

import { useTransition } from "react";
import { setDriveSyncInterval } from "../../actions";

export default function DriveIntervalSelect({ developerAccountId, value }: { developerAccountId: string; value: string }) {
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
      Sync
      <select
        defaultValue={value}
        disabled={pending}
        onChange={(e) => start(() => setDriveSyncInterval(developerAccountId, e.target.value))}
        className="rounded-md border border-[#E5E7EB] px-2 py-1 text-sm text-[#111827] outline-none focus:border-[#1B4B43] disabled:opacity-60"
      >
        <option value="daily">daily</option>
        <option value="2day">every 2 days</option>
        <option value="weekly">weekly</option>
        <option value="off">off</option>
      </select>
    </label>
  );
}
