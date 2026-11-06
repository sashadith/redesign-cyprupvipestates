"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setToolEnabledAction } from "./toolSwitchActions";

export default function ToolSwitchToggle({
  toolKey, label, enabled, canEdit, offEffect, updatedAt, updatedByName,
}: {
  toolKey: string;
  label: string;
  enabled: boolean;
  canEdit: boolean;
  /** What OFF stops, in one sentence — shown under the switch. */
  offEffect: string;
  updatedAt: string | null;
  updatedByName: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const flip = () =>
    start(async () => {
      setError(null);
      const res = await setToolEnabledAction(toolKey, !enabled);
      if (res.error) setError(res.error);
      else router.refresh();
    });

  return (
    <div className={`rounded-lg border p-4 mb-6 flex items-start justify-between gap-4 ${enabled ? "bg-white border-[#E5E7EB]" : "bg-[#FEF3F2] border-[#F5C2BE]"}`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {label} is {enabled ? "ON" : "OFF"}
        </p>
        <p className="text-xs text-[#6B7280] mt-1 max-w-prose">{offEffect}</p>
        {updatedAt && (
          <p className="text-xs text-[#9CA3AF] mt-1">
            Last switched {updatedAt.slice(0, 16).replace("T", " ")} UTC{updatedByName ? ` by ${updatedByName}` : ""}.
          </p>
        )}
        {!canEdit && <p className="text-xs text-[#9CA3AF] mt-1">Only admins can change this.</p>}
        {error && <p className="text-xs text-[#B3261E] mt-1">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${label} ${enabled ? "on" : "off"}`}
        disabled={!canEdit || pending}
        onClick={flip}
        className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-[#1B4B43]" : "bg-[#D1D5DB]"}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
