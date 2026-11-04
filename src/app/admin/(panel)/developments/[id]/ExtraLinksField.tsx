"use client";

import { useState } from "react";
import { EXTRA_LINK_KINDS, isValidExtraLinkUrl, type ExtraLink, type ExtraLinkKind } from "@/lib/developmentExtraLinks";

// Admin captions for the kinds. Deliberately NOT the public labels from
// developmentCopy: this list is English because the admin is English
// (CLAUDE.md), while the public button text is resolved per visitor language.
const KIND_LABELS: Record<ExtraLinkKind, string> = {
  video: "Project video",
  tour360: "360° tour",
  walkthrough: "Virtual walkthrough",
  camera: "Project camera",
};

/* Rows of (kind, url), serialized into one hidden input the page's single
   <form action={saveOverride}> picks up — same approach PromoBlocksField uses
   for its block arrays. The editor picks a KIND from a fixed list rather than
   typing a caption, so the same link can be rendered in five languages and
   nobody ends up with "360 Tour", "360° Rundgang" and "Virtual Tour" side by
   side.

   Order is input order, which is the order the buttons appear in. A kind
   already used is dropped from the remaining selects, so the page can never
   show one caption twice pointing at two different places. */
export default function ExtraLinksField({ initial }: { initial: ExtraLink[] }) {
  const [rows, setRows] = useState<ExtraLink[]>(initial);

  const used = new Set(rows.map((r) => r.kind));
  const free = EXTRA_LINK_KINDS.filter((k) => !used.has(k));

  const update = (i: number, patch: Partial<ExtraLink>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const field = "w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-sm";

  return (
    <div className="space-y-2">
      {/* The hidden input is what actually gets saved; the rows above it are
          pure UI. An empty list posts "[]" and the action stores null. */}
      <input type="hidden" name="extraLinks" value={JSON.stringify(rows)} />

      {rows.map((r, i) => {
        const bad = r.url.trim().length > 0 && !isValidExtraLinkUrl(r.url);
        return (
          <div key={`${r.kind}-${i}`} className="flex items-start gap-2">
            <select
              value={r.kind}
              onChange={(e) => update(i, { kind: e.target.value as ExtraLinkKind })}
              className={`${field} w-56 shrink-0`}
            >
              {/* The row's own kind plus the still-unused ones — without the
                  first entry a select would have no valid value for itself. */}
              {[r.kind, ...free].map((k) => (
                <option key={k} value={k}>{KIND_LABELS[k]}</option>
              ))}
            </select>
            <div className="flex-1">
              <input
                value={r.url}
                dir="ltr"
                onChange={(e) => update(i, { url: e.target.value })}
                placeholder="https://…"
                className={`${field} ${bad ? "border-[#DC2626]" : ""}`}
              />
              {bad && <p className="mt-1 text-[11px] text-[#DC2626]">Must start with https:// — this row will not be saved.</p>}
            </div>
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              className="shrink-0 rounded-md border border-[#D1D5DB] px-3 py-2 text-sm text-[#6B7280] hover:text-[#111827]"
            >
              Remove
            </button>
          </div>
        );
      })}

      {free.length > 0 && (
        <button
          type="button"
          onClick={() => setRows([...rows, { kind: free[0], url: "" }])}
          className="rounded-md border border-[#D1D5DB] px-3 py-2 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB]"
        >
          + Add link
        </button>
      )}

      <p className="text-[11px] text-[#9CA3AF]">
        Buttons under the description on the project page, in this order. The caption is translated automatically — pick the kind, paste the link. Opens in a new tab, marked nofollow.
      </p>
    </div>
  );
}
