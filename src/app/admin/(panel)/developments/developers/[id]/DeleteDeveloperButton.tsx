"use client";

import { useState, useTransition } from "react";
import { deleteDeveloperAccount, getDeveloperAccountDeleteImpact } from "@/app/admin/actions";
import { deleteConfirmationMatches } from "@/lib/developerLifecycle";
import type { AccountDeleteImpact } from "@/lib/developerAccountDelete";

// This used to be a bare <form action={del}>, then a window.confirm(). Why a
// dialog with a typed name now (2026-10-10):
//
// 1. deleteDeveloperAccount can refuse — when the developer is delivered to the
//    Xellex portal (its cascade would leave those projects online there), or
//    when the typed name does not match. A plain form action drops the returned
//    value, so a refusal would have been a click that silently did nothing.
// 2. It cascades: every Development of the account, their units, overrides and
//    client-presentation items. Published project pages 404 afterwards. One
//    "OK" in a browser prompt was the whole guard for that; the dialog now
//    names the published pages and the other losses, and Delete stays disabled
//    until the name is typed (re-checked on the server).
export default function DeleteDeveloperButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<AccountDeleteImpact | null>(null);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const show = () => {
    setOpen(true); setImpact(null); setTyped(""); setError(null);
    start(async () => {
      try { setImpact(await getDeveloperAccountDeleteImpact(id)); }
      catch { setError("Could not load what this delete would affect. Reload and try again."); }
    });
  };

  const run = () => {
    setError(null);
    start(async () => {
      // try/catch, not just the returned error: `deleteDeveloperAccount` starts
      // with requireSession(), which THROWS "Unauthorized", and the delete
      // itself can throw too. Without this, a rejected promise inside the
      // transition means setError never runs and `pending` just clears — a
      // click that silently did nothing. An admin deactivated in another tab
      // hits precisely that path.
      try {
        // On success the action redirects, so nothing after this runs.
        const res = await deleteDeveloperAccount(id, typed);
        if (res?.error) setError(res.error);
      } catch (e) {
        setError(e instanceof Error && e.message === "Unauthorized"
          ? "Your session is no longer active — reload and sign in again."
          : "The delete failed. Nothing was changed; check the server log and try again.");
      }
    });
  };

  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

  return (
    <div className="pt-1">
      <button type="button" onClick={show} className="text-sm text-[#C0392B] hover:underline">
        Delete developer and all analyses
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 w-full max-w-lg space-y-4">
            <h3 className="text-base font-semibold text-[#991B1B]">Delete “{name}” permanently?</h3>
            {!impact ? (
              <p className="text-sm text-[#6B7280]">{error ?? "Loading…"}</p>
            ) : (
              <>
                <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#991B1B] space-y-1">
                  <p>This deletes the developer account together with {n(impact.developments, "development", "developments")}, {n(impact.units, "unit", "units")} and all feed analyses. It cannot be undone.</p>
                  {impact.published.length > 0 && (
                    <p className="font-medium">{n(impact.published.length, "published project page goes", "published project pages go")} offline (404):</p>
                  )}
                  {impact.presentationItems > 0 && (
                    <p>{n(impact.presentationItems, "entry", "entries")} in client presentations will disappear.</p>
                  )}
                  {impact.redirectsIn > 0 && (
                    <p>{n(impact.redirectsIn, "old URL that redirects", "old URLs that redirect")} to these projects will end in a 404.</p>
                  )}
                  {impact.published.length > 0 && (
                    <p className="text-[#7F1D1D]">To take projects offline without deleting them, archive them instead.</p>
                  )}
                </div>
                {impact.published.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto text-xs border border-[#E5E7EB] rounded-md divide-y divide-[#E5E7EB]">
                    {impact.published.map((p, i) => (
                      <li key={i} className="px-3 py-1 text-[#374151]">{p.name}{p.slug ? <span className="text-[#9CA3AF]"> · /projects/{p.slug}</span> : null}</li>
                    ))}
                  </ul>
                )}
                <label className="block text-sm">
                  Type <span className="font-medium">{impact.name}</span> to confirm
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus
                    className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#991B1B]" />
                </label>
                {error && <p className="text-xs text-[#991B1B]">{error}</p>}
              </>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]">Cancel</button>
              {impact && (
                <button type="button" onClick={run} disabled={pending || !deleteConfirmationMatches(typed, impact.name)}
                  className="rounded-md bg-[#991B1B] text-white text-sm font-medium px-4 py-2 hover:bg-[#7F1D1D] disabled:opacity-60">
                  {pending ? "Deleting…" : "Delete permanently"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
