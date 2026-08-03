"use client";

import { useState, useTransition } from "react";
import { setDeveloperPageLink } from "@/app/admin/actions";

// Bündel 3 Schritt 2 (2026-08-01) — rendered inline in the header, next to
// Edit (see DeveloperContact.tsx's pageLinkSection prop). Linked: two
// buttons (view the public page, edit its profile in the existing content
// editor — no second description/logo field, see the schema investigation
// this was built from: title/excerpt/logo/SEO/description all already
// exist there, and all 12 linked developers already have a description in
// all 4 languages). Not linked, or linked but stale: a short message.
// The select is ALWAYS visible in every state — deliberately, not behind a
// "change" toggle — so re-linking or correcting a wrong match is a single
// dropdown pick, not an edit-mode round trip.
//
// 2026-08-03 — the BBF/Domenica incident: a single misclick here (this
// select had no confirmation, and every page appeared as a plain title with
// no indication another account already held it) silently pointed BBF's
// account at Domenica's public page, showing BBF's entire catalog under
// Domenica's name with zero error. Three changes in response:
//   1. Options already linked to a DIFFERENT account are labelled
//      "— already linked to X" so the risk is visible before a click, not
//      just rejected after (the DB's own @unique(developerTranslationGroupId)
//      constraint is the actual backstop for that, see schema.prisma).
//   2. Re-linking or clearing an EXISTING link asks for confirmation with
//      an explicit before/after (initially setting an empty field does
//      not — that case can't misroute anyone's projects, there's nothing
//      to misroute FROM).
//   3. A rejected write (P2002 from the constraint) surfaces the exact
//      holder's name inline, not a generic failure.
export default function DeveloperPageLink({
  developerAccountId, accountName, value, options, previewUrl, editProfileHref, broken,
}: {
  developerAccountId: string;
  accountName: string;
  value: string | null;
  options: { translationGroupId: string; title: string; takenByName?: string | null }[];
  previewUrl: string | null;
  editProfileHref: string | null;
  broken: boolean;
}) {
  const [pending, start] = useTransition();
  const [selectValue, setSelectValue] = useState(value ?? "");
  const [confirming, setConfirming] = useState<string | null>(null); // the newly-picked value awaiting confirmation, or null
  const [error, setError] = useState<string | null>(null);

  const titleOf = (translationGroupId: string) =>
    options.find((o) => o.translationGroupId === translationGroupId)?.title ?? null;
  const currentTitle = value ? titleOf(value) : null;

  function apply(nextValue: string) {
    setError(null);
    start(async () => {
      const result = await setDeveloperPageLink(developerAccountId, nextValue);
      if (result.ok) {
        setSelectValue(nextValue);
      } else {
        setError(result.error);
        setSelectValue(value ?? ""); // revert the visible selection — the write didn't happen
      }
      setConfirming(null);
    });
  }

  function handleChange(nextValue: string) {
    setError(null);
    if (!value) {
      // Field was empty — nothing to misroute away from, apply directly.
      apply(nextValue);
      return;
    }
    // An existing link is being changed or cleared — confirm first, and
    // keep the select showing the OLD value until confirmed.
    setSelectValue(value);
    setConfirming(nextValue);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {value && !broken && (
        <>
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] text-sm text-[#374151] px-3 py-1.5 hover:bg-[#F8F9FA]">
              View public page ↗
            </a>
          )}
          {editProfileHref && (
            <a href={editProfileHref} className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] text-sm text-[#374151] px-3 py-1.5 hover:bg-[#F8F9FA]">
              Edit developer profile
            </a>
          )}
        </>
      )}
      {!value && <span className="text-xs text-[#9CA3AF] whitespace-nowrap">No public page linked</span>}
      {broken && <span className="text-xs text-[#C0392B] whitespace-nowrap">Linked page no longer exists</span>}
      <select
        value={selectValue}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Link a public developer page"
        className="rounded-md border border-[#E5E7EB] px-2 py-1.5 text-xs text-[#111827] outline-none focus:border-[#1B4B43] disabled:opacity-60 max-w-[220px]"
      >
        <option value="">— none —</option>
        {options.map((o) => (
          <option key={o.translationGroupId} value={o.translationGroupId}>
            {o.takenByName ? `${o.title} — already linked to ${o.takenByName}` : o.title}
          </option>
        ))}
      </select>
      {error && <p className="w-full text-xs text-[#C0392B]">{error}</p>}

      {confirming !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 w-full max-w-md space-y-4">
            <h3 className="text-base font-semibold">Change the linked public page?</h3>
            <p className="text-sm text-[#374151]">
              Aktuell: <span className="font-medium">{currentTitle ?? "—"}</span> → Neu:{" "}
              <span className="font-medium">{confirming ? titleOf(confirming) : "(keine Verknüpfung)"}</span>
            </p>
            <p className="text-sm text-[#6B7280]">
              {confirming
                ? `Die Projekte von ${accountName} erscheinen dann auf der ${titleOf(confirming)}-Seite.`
                : `Die Projekte von ${accountName} erscheinen dann auf keiner öffentlichen Bauträgerseite mehr.`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => apply(confirming)}
                disabled={pending}
                className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D] disabled:opacity-60"
              >
                {pending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
