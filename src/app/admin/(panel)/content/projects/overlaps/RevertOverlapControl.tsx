"use client";

import { useState, useTransition } from "react";
import { revertOverlap } from "./actions";

// Undo control for an already-confirmed overlap row. Separate from the
// Confirm/Reject buttons (those only apply to "pending" rows) — this is the
// only way to walk back a confirmed match once it turns out to be wrong,
// e.g. "Azalea Apartments" (Limassol) mistakenly confirmed against "Azalea
// Villas" (Paphos), two unrelated buildings.
export default function RevertOverlapControl({
  legacyProjectId,
  developmentId,
  legacyArchived,
  hasRedirect,
}: {
  legacyProjectId: string;
  developmentId: string;
  legacyArchived: boolean;
  hasRedirect: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [disposition, setDisposition] = useState<"rejected" | "pending">("rejected");
  // The legacy project can only be ARCHIVED via the deactivate-with-redirect
  // flow, which is only reachable through a confirmed link — so ARCHIVED here
  // means it was deactivated *because of* this match. Default this on: an
  // admin reverting a wrong match should not be left with a live 301 pointing
  // at the wrong Development unless they deliberately opt out.
  const showReactivateWarning = legacyArchived;
  const [reactivate, setReactivate] = useState(legacyArchived);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await revertOverlap(legacyProjectId, developmentId, disposition, reactivate);
      setOpen(false);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-[#E5E7EB] text-xs px-3 py-1.5 hover:bg-[#F8F9FA]">
        Revert
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 w-full max-w-md space-y-4">
            <h3 className="text-base font-semibold">Undo this match?</h3>
            <p className="text-sm text-[#6B7280]">
              This clears the link in all languages. Choose what should happen to this pairing next.
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="disposition" className="mt-0.5" checked={disposition === "rejected"} onChange={() => setDisposition("rejected")} />
                <span>
                  <span className="font-medium">Mark as Rejected</span>
                  <span className="block text-xs text-[#6B7280]">Won&apos;t be suggested again on this review page.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="disposition" className="mt-0.5" checked={disposition === "pending"} onChange={() => setDisposition("pending")} />
                <span>
                  <span className="font-medium">Return to Pending</span>
                  <span className="block text-xs text-[#6B7280]">Leave it for review again later.</span>
                </span>
              </label>
            </div>
            {showReactivateWarning && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-2">
                <p className="text-xs text-amber-800">
                  This legacy project is currently <strong>deactivated</strong>
                  {hasRedirect ? " with a redirect pointing at this Development" : ""} — presumably because of this
                  match. Leaving it deactivated would keep it hidden (and any redirect would still point at the wrong
                  building) even after the match is undone.
                </p>
                <label className="flex items-center gap-2 text-xs text-amber-900">
                  <input type="checkbox" checked={reactivate} onChange={(e) => setReactivate(e.target.checked)} />
                  Also reactivate the legacy project and remove its redirects (all languages)
                </label>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]">
                Cancel
              </button>
              <button type="button" onClick={confirm} disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D] disabled:opacity-60">
                {pending ? "Reverting…" : "Revert match"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
