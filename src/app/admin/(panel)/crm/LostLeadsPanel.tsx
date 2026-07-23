"use client";

import { useState } from "react";

// Collapsible wrapper around a server-rendered lost-leads table. State isn't
// persisted (default-collapsed is enough per spec) — `defaultOpen` only
// needs to react to filter changes, which the parent handles by keying this
// component on the query string so it remounts (and re-picks defaultOpen)
// whenever the search/filters change.
export default function LostLeadsPanel({
  count, defaultOpen, children,
}: {
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#F8F9FA]"
        aria-expanded={open}
      >
        <span>Lost leads ({count})</span>
        <span className={`text-[#9CA3AF] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>⌄</span>
      </button>
      {open && children}
    </div>
  );
}
