"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncDeveloperDriveAction } from "../../actions";

export default function DriveSyncButton({ developerAccountId }: { developerAccountId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  const run = () =>
    start(async () => {
      try {
        const r = await syncDeveloperDriveAction(developerAccountId);
        setMsg({ ok: r.ok, text: r.message });
        if (r.ok) router.refresh();
      } catch (e: any) {
        setMsg({ ok: false, text: String(e?.message ?? e).slice(0, 200) });
      }
    });

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={run}
        disabled={pending}
        className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm font-medium px-3 py-1.5 hover:bg-[#1B4B43]/8 disabled:opacity-60 whitespace-nowrap"
      >
        {pending ? "Syncing…" : "↻ Sync Drive now"}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-[#166534]" : "text-[#C0392B]"}`}>{msg.text}</span>}
    </div>
  );
}
