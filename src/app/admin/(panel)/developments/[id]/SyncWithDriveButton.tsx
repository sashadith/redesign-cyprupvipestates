"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncThisDevelopmentAction, syncThisDevelopmentUnitsAction } from "./actions";

// mode="full" (Images/Floor plans blocks): full re-import — price list + images +
// floor plans + description. mode="units" (Units block): price/availability list
// only — same fast path as the nightly cron, no media download/conversion, so it
// can't hit the longer timeout the full import needs.
export default function SyncWithDriveButton({ developmentId, mode = "full" }: { developmentId: string; mode?: "full" | "units" }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  const run = () =>
    start(async () => {
      try {
        const r = mode === "units" ? await syncThisDevelopmentUnitsAction(developmentId) : await syncThisDevelopmentAction(developmentId);
        setMsg({ ok: r.ok, text: r.message });
        if (r.ok) router.refresh();
      } catch (e: any) {
        setMsg({ ok: false, text: String(e?.message ?? e).slice(0, 200) });
      }
    });

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        title={mode === "units" ? "Re-read the current price/availability list only — no images or documents" : "Full re-import of this project from the developer's Drive price list"}
        className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA] disabled:opacity-60 whitespace-nowrap"
      >
        {pending ? "Syncing…" : "↻ Sync with Drive"}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-[#166534]" : "text-[#C0392B]"}`}>{msg.text}</span>}
    </div>
  );
}
