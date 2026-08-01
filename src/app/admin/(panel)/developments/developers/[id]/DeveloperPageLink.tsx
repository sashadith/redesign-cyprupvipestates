"use client";

import { useTransition } from "react";
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
export default function DeveloperPageLink({
  developerAccountId, value, options, previewUrl, editProfileHref, broken,
}: {
  developerAccountId: string;
  value: string | null;
  options: { translationGroupId: string; title: string }[];
  previewUrl: string | null;
  editProfileHref: string | null;
  broken: boolean;
}) {
  const [pending, start] = useTransition();
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
        defaultValue={value ?? ""}
        disabled={pending}
        onChange={(e) => start(() => setDeveloperPageLink(developerAccountId, e.target.value))}
        aria-label="Link a public developer page"
        className="rounded-md border border-[#E5E7EB] px-2 py-1.5 text-xs text-[#111827] outline-none focus:border-[#1B4B43] disabled:opacity-60 max-w-[180px]"
      >
        <option value="">— none —</option>
        {options.map((o) => (
          <option key={o.translationGroupId} value={o.translationGroupId}>{o.title}</option>
        ))}
      </select>
    </div>
  );
}
