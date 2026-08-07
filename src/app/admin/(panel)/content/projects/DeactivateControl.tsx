"use client";

import { useEffect, useState, useTransition } from "react";
import { toggleProjectActive, deactivateProjectWithRedirect, getDeactivateSuggestions, type DeactivateSuggestion } from "../../../actions";

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
  const [linkedTarget, setLinkedTarget] = useState<{ kind: "development" | "developer"; slug: string } | null>(null);
  const [suggestions, setSuggestions] = useState<DeactivateSuggestion[] | null>(null);
  const [pending, startTransition] = useTransition();

  // Suggestions are only relevant without a confirmed Development link — that
  // case already has a fixed, correct target. Fetched once per dialog open,
  // not on mount, so the (up to 300-row) list page never pays for it.
  useEffect(() => {
    if (open && !hasConfirmedLink && suggestions === null) {
      getDeactivateSuggestions(projectId).then(setSuggestions);
    }
  }, [open, hasConfirmedLink, suggestions, projectId]);

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

  function pickSuggestion(s: DeactivateSuggestion) {
    setLinkedTarget({ kind: s.kind, slug: s.slug });
    setTarget(s.detail.startsWith("/") ? s.detail : `/${s.kind === "developer" ? "developers" : "projects"}/${s.slug}`);
  }

  function editTarget(value: string) {
    setTarget(value);
    setLinkedTarget(null); // a hand edit no longer follows the picked suggestion's per-locale rule
  }

  function confirm() {
    startTransition(async () => {
      await deactivateProjectWithRedirect(projectId, addRedirect ? target : null, addRedirect ? linkedTarget : null);
      setOpen(false);
    });
  }

  const willHaveNoTarget = !addRedirect || !target.trim();

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
            {!hasConfirmedLink && (
              <p className="text-xs text-[#9CA3AF]">No confirmed Development match — pick a redirect target below, or leave it unset.</p>
            )}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={addRedirect} onChange={(e) => setAddRedirect(e.target.checked)} />
                Redirect visitors to a different page (301)
              </label>
              {addRedirect && (
                <div className="space-y-2">
                  <input value={target} onChange={(e) => editTarget(e.target.value)} className={input} placeholder="/projects/slug" />
                  {!hasConfirmedLink && (
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions === null && <span className="text-xs text-[#9CA3AF]">Loading suggestions…</span>}
                      {suggestions?.length === 0 && <span className="text-xs text-[#9CA3AF]">No nearby developments or developer page found.</span>}
                      {suggestions?.map((s) => (
                        <button
                          key={`${s.kind}:${s.slug}`}
                          type="button"
                          onClick={() => pickSuggestion(s)}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            linkedTarget?.kind === s.kind && linkedTarget.slug === s.slug
                              ? "border-[#1B4B43] bg-[#1B4B43]/10 text-[#1B4B43]"
                              : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F8F9FA]"
                          }`}
                          title={s.detail}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {willHaveNoTarget && (
              <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No redirect target set — visitors will see the standard 404 page.
              </p>
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
