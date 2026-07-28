"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncOneDevelopmentAction, setDevelopmentSyncMode } from "./actions";

type ManualSummary = { count: number; photos: number; attrs: number; amenities: number };

export default function SyncControlPanel({
  developmentId,
  dev,
  canForceSync,
  canToggle,
  isFeedManaged,
  manualSummary,
}: {
  developmentId: string;
  dev: string;
  canForceSync: boolean;
  canToggle: boolean;
  isFeedManaged: boolean;
  manualSummary: ManualSummary;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  if (!canToggle) return null; // "drive" and "manual" devs: no feed to guard against, nothing to show

  const runForceSync = () => {
    setMessage(null);
    start(async () => {
      const r = await syncOneDevelopmentAction(developmentId);
      if (!r.ok) { setMessage(`Sync failed: ${r.error || "unknown error"}`); return; }
      setMessage(r.skippedManual
        ? "Project data updated. Units skipped (manually managed)."
        : `${r.unitsWritten} unit${r.unitsWritten === 1 ? "" : "s"} pulled from the feed.`);
      router.refresh();
    });
  };

  const switchToManual = () => {
    if (!confirm("Freeze this project's units as manually managed? The automatic feed sync will stop overwriting them — you'll still be able to edit and save.")) return;
    setMessage(null);
    start(async () => {
      await setDevelopmentSyncMode(developmentId, "manual");
      setMessage("Switched to manual — units are now protected from the feed sync.");
      router.refresh();
    });
  };

  const switchToAuto = () => {
    const { count, photos, attrs, amenities } = manualSummary;
    const warning = count > 0
      ? `This project has ${count} manually managed unit${count === 1 ? "" : "s"} with ${photos} photo${photos === 1 ? "" : "s"} and ${attrs} extra spec${attrs === 1 ? "" : "s"}${amenities ? ` and ${amenities} feature${amenities === 1 ? "" : "s"}` : ""} that the feed does not provide. Switching to automatic means the next feed sync will replace this data completely and irreversibly. Continue?`
      : "Switch this project back to automatic feed management? The next sync will take over its units.";
    if (!confirm(warning)) return;
    setMessage(null);
    start(async () => {
      await setDevelopmentSyncMode(developmentId, "feed");
      setMessage("Switched to automatic — the next feed sync will manage these units again.");
      router.refresh();
    });
  };

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] px-5 py-3 flex items-center flex-wrap gap-3">
      <div className="text-sm font-semibold text-[#111827]">Sync control</div>
      <div className="flex items-center gap-2 ml-auto">
        {canForceSync && (
          <button type="button" onClick={runForceSync} disabled={pending}
            className="rounded-md border border-[#E5E7EB] text-sm px-3 py-1.5 hover:bg-[#F8F9FA] disabled:opacity-60">
            {pending ? "…" : "Pull units from feed"}
          </button>
        )}
        {isFeedManaged ? (
          <button type="button" onClick={switchToManual} disabled={pending}
            className="rounded-md border border-[#E5E7EB] text-sm px-3 py-1.5 hover:bg-[#F8F9FA] disabled:opacity-60">
            Switch to manual
          </button>
        ) : (
          <button type="button" onClick={switchToAuto} disabled={pending}
            className="rounded-md border border-[#FCA5A5] text-[#991B1B] text-sm px-3 py-1.5 hover:bg-[#FEF2F2] disabled:opacity-60">
            Switch to automatic
          </button>
        )}
      </div>
      {message && <div className="w-full text-xs text-[#6B7280]">{message}</div>}
    </div>
  );
}
