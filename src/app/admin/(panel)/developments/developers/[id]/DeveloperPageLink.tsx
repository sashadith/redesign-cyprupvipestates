"use client";

import { useTransition } from "react";
import { setDeveloperPageLink } from "@/app/admin/actions";

// Bündel 3 Schritt 1 (2026-08-01) — auto-submit-on-change select, same
// pattern as DriveIntervalSelect.tsx. Kept as its own small card rather than
// folded into DeveloperContact — a different concern (which public page this
// account maps to, not contact details), and it needs its own "broken link"
// state the contact card has no reason to know about.
export default function DeveloperPageLink({
  developerAccountId, value, options, previewUrl, broken,
}: {
  developerAccountId: string;
  value: string | null;
  options: { translationGroupId: string; title: string }[];
  previewUrl: string | null;
  broken: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-3">
      <h2 className="text-sm font-semibold text-[#111827]">Public developer page</h2>
      {value && broken && (
        <p className="text-xs text-[#C0392B]">
          Linked page no longer exists — it may have been deleted or moved. Pick a different one below, or clear the link.
        </p>
      )}
      {value && !broken && (
        <p className="text-xs text-[#6B7280]">
          Linked
          {previewUrl && (
            <>
              {" — "}
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[#1B4B43] hover:underline">view page ↗</a>
            </>
          )}
        </p>
      )}
      {!value && <p className="text-xs text-[#9CA3AF]">Not linked — this developer has no public profile page yet.</p>}
      <select
        defaultValue={value ?? ""}
        disabled={pending}
        onChange={(e) => start(() => setDeveloperPageLink(developerAccountId, e.target.value))}
        className="w-full max-w-sm rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#1B4B43] disabled:opacity-60"
      >
        <option value="">— none —</option>
        {options.map((o) => (
          <option key={o.translationGroupId} value={o.translationGroupId}>{o.title}</option>
        ))}
      </select>
    </div>
  );
}
