"use client";

import { useState, useTransition } from "react";
import { toggleProjectActive, deactivateProjectWithRedirect } from "../../../actions";

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

export default function DeactivateControl({
  projectId,
  status,
  hasConfirmedLink,
  prefillTarget,
  locales,
  variant = "default",
}: {
  projectId: string;
  status: string;
  hasConfirmedLink: boolean;
  prefillTarget: string | null;
  locales: string[];
  variant?: "default" | "banner" | "compact";
}) {
  const [open, setOpen] = useState(false);
  const [addRedirect, setAddRedirect] = useState(hasConfirmedLink);
  const [target, setTarget] = useState(prefillTarget ?? "");
  const [pending, startTransition] = useTransition();

  if (status === "ARCHIVED") {
    return (
      <form action={toggleProjectActive.bind(null, projectId)}>
        <button
          type="submit"
          className={
            variant === "compact"
              ? "rounded-md bg-[#1B4B43] text-white text-xs px-3 py-1.5 hover:bg-[#142E2D]"
              : "rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D]"
          }
        >
          Activate
        </button>
      </form>
    );
  }

  const deactivateButtonClass =
    variant === "banner"
      ? "rounded-md bg-amber-800 text-white text-sm font-medium px-3 py-1.5 hover:bg-amber-900 whitespace-nowrap"
      : variant === "compact"
        ? "rounded-md border border-[#E5E7EB] text-xs px-3 py-1.5 hover:bg-[#F8F9FA]"
        : "rounded-md border border-[#E5E7EB] text-sm font-medium px-4 py-2 hover:bg-[#F8F9FA]";

  function confirm() {
    startTransition(async () => {
      await deactivateProjectWithRedirect(projectId, addRedirect ? target : null);
      setOpen(false);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={deactivateButtonClass}>
        {variant === "banner" ? "Deactivate now" : "Deactivate"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 w-full max-w-md space-y-4">
            <h3 className="text-base font-semibold">Deactivate this listing?</h3>
            <p className="text-sm text-[#6B7280]">
              This will deactivate the project in all languages ({locales.map((l) => l.toUpperCase()).join(", ")}) — hidden from the
              listing, its own page, and the sitemap in every one.
            </p>
            {hasConfirmedLink ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={addRedirect} onChange={(e) => setAddRedirect(e.target.checked)} />
                  Redirect visitors to the new listing (301)
                </label>
                {addRedirect && (
                  <input value={target} onChange={(e) => setTarget(e.target.value)} className={input} placeholder="/projects/slug" />
                )}
              </div>
            ) : (
              <p className="text-xs text-[#9CA3AF]">No confirmed Development match — visitors will see the standard 404 page.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]">
                Cancel
              </button>
              <button type="button" onClick={confirm} disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D] disabled:opacity-60">
                {pending ? "Deactivating…" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
