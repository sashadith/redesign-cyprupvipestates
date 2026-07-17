"use client";

import { useState, useTransition } from "react";
import { batchDeactivateConfirmedOverlaps } from "./actions";

type Pair = { id: string; slug: string; title: string; alreadyArchived: boolean };

// One-time batch action (ADMIN only) for the confirmed legacy<->Development
// overlap pairs from the merge audit — see the overlap review page
// (/admin/content/projects/overlaps). Idempotent: rows already ARCHIVED are
// listed but clearly marked, and the server action skips them rather than
// re-processing, so this stays safe to run again after new pairs get
// confirmed later.
export default function BatchDeactivateControl({ pairs }: { pairs: Pair[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Awaited<ReturnType<typeof batchDeactivateConfirmedOverlaps>> | null>(null);

  const pendingCount = pairs.filter((p) => !p.alreadyArchived).length;

  function run() {
    startTransition(async () => {
      const r = await batchDeactivateConfirmedOverlaps();
      setResult(r);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-amber-800 text-white text-sm font-medium px-4 py-2 hover:bg-amber-900 whitespace-nowrap"
      >
        Deactivate confirmed legacy projects{pendingCount > 0 ? ` (${pendingCount})` : ""}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 w-full max-w-lg space-y-4">
            <h3 className="text-base font-semibold">Deactivate {pairs.length} confirmed legacy projects?</h3>
            <p className="text-sm text-[#6B7280]">
              Each project below will be archived (all languages) with a 301 redirect to its linked Development. This
              is the same effect as the individual deactivate dialog, applied to all {pairs.length} confirmed pairs at
              once. {pendingCount} of them are still live and will actually change;{" "}
              {pairs.length - pendingCount} are already archived and will be skipped.
            </p>
            <ul className="max-h-64 overflow-y-auto text-sm border border-[#E5E7EB] rounded-md divide-y divide-[#E5E7EB]">
              {pairs.map((p) => (
                <li key={p.id} className="px-3 py-1.5 flex items-center justify-between gap-3">
                  <span className="text-[#374151]">{p.title}</span>
                  <span className={p.alreadyArchived ? "text-xs text-[#9CA3AF]" : "text-xs text-amber-700 font-medium"}>
                    {p.alreadyArchived ? "already archived" : "will be deactivated"}
                  </span>
                </li>
              ))}
            </ul>
            {result && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                Done — {result.filter((r) => r.action === "deactivated").length} deactivated,{" "}
                {result.filter((r) => r.action === "skipped_already_archived").length} already archived,{" "}
                {result.filter((r) => r.action === "skipped_no_dev_slug").length} skipped (no Development slug).
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]">
                {result ? "Close" : "Cancel"}
              </button>
              {!result && (
                <button
                  type="button"
                  onClick={run}
                  disabled={pending || pendingCount === 0}
                  className="rounded-md bg-amber-800 text-white text-sm font-medium px-4 py-2 hover:bg-amber-900 disabled:opacity-60"
                >
                  {pending ? "Deactivating…" : `Deactivate ${pendingCount}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
