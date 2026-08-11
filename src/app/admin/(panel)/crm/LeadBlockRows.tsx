"use client";

import { useState, Children } from "react";

// 2026-08-11 — lead-list rebuild: each urgency/status block shows a preview
// of `previewCount` rows with a "Show all" toggle, rather than the old
// single-table pagination. Deliberately a plain slice/toggle (no measured-
// height animation like CollapsibleList.tsx) — that component wraps children
// in a <div>, which can't hold <tr> elements; this renders straight into a
// <tbody> instead.
export default function LeadBlockRows({
  children,
  previewCount = 6,
}: {
  children: React.ReactNode;
  previewCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = Children.toArray(children);
  const visible = expanded ? rows : rows.slice(0, previewCount);

  return (
    <>
      {visible}
      {rows.length > previewCount && (
        <tr>
          <td colSpan={9} className="px-4 py-2 text-center border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-[#1B4B43] hover:underline"
            >
              {expanded ? "Show less" : `Show all (${rows.length})`}
            </button>
          </td>
        </tr>
      )}
    </>
  );
}
