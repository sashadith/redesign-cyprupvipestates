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
        // A server action can resolve to undefined when the page was loaded from
        // a PREVIOUS deployment: action ids are content-hashed per build, so after
        // a deploy the old tab calls an id the server no longer knows ("Failed to
        // find Server Action … This request might be from an older or newer
        // deployment"). Reading r.ok then throws, and the catch below rendered the
        // raw minified TypeError — "undefined is not an object (evaluating
        // 'e.ok')" — which says nothing about the actual problem or its one-click
        // fix. Observed in production 2026-08-23 on a tab left open across a deploy.
        if (!r) { setMsg({ ok: false, text: "This page is from an older version of the site — reload and try again." }); return; }
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
        className="inline-flex h-9 items-center rounded-md border border-[#C7A87A] px-4 text-sm text-[#826238] hover:border-[var(--bronze)] hover:bg-[#FDF3E3] disabled:opacity-60 whitespace-nowrap"
      >
        {pending ? "Syncing…" : "↻ Sync with Drive"}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-[#166534]" : "text-[#C0392B]"}`}>{msg.text}</span>}
    </div>
  );
}
