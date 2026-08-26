"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncDeveloperDriveAction, syncDeveloperDropboxAction } from "../../actions";

// `provider` comes from the developer's own folder link (Dropbox host vs
// anything else — see isDropboxShareUrl), not from a setting: DeveloperAccount
// has no provider column, both providers share the driveFolderUrl field, and
// the URL is the single source of truth the sync code itself already uses.
export default function DriveSyncButton({ developerAccountId, provider = "drive" }: { developerAccountId: string; provider?: "drive" | "dropbox" }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  const run = () =>
    start(async () => {
      try {
        const r = provider === "dropbox"
          ? await syncDeveloperDropboxAction(developerAccountId)
          : await syncDeveloperDriveAction(developerAccountId);
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
        {pending ? "Syncing…" : provider === "dropbox" ? "↻ Sync Dropbox now" : "↻ Sync Drive now"}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-[#166534]" : "text-[#C0392B]"}`}>{msg.text}</span>}
    </div>
  );
}
