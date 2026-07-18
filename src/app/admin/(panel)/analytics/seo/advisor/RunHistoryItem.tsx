"use client";
import { useState } from "react";
import SuggestionCard from "./SuggestionCard";
import type { StoredSuggestion } from "@/lib/seoAdvisor/types";
import { sortSuggestions } from "./sortSuggestions";

type Props = { runId: string; runDate: string; suggestions: StoredSuggestion[] };

export default function RunHistoryItem({ runId, runDate, suggestions }: Props) {
  const [expanded, setExpanded] = useState(false);
  const implemented = suggestions.filter((s) => s.status === "approved").length;
  const dismissed = suggestions.filter((s) => s.status === "dismissed").length;
  const deferred = suggestions.filter((s) => s.status === "open").length;

  const parts = [
    implemented > 0 && `${implemented} implemented`,
    dismissed > 0 && `${dismissed} dismissed`,
    deferred > 0 && `${deferred} deferred`,
  ].filter(Boolean);

  return (
    <div className="border-b border-[#E5E7EB] last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-1 py-2.5 text-left hover:bg-[#F8F9FA]"
      >
        <span className="text-xs text-[#9CA3AF] shrink-0">{expanded ? "▾" : "▸"}</span>
        <span className="text-sm text-[#374151]">
          Run {runDate} — {suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"}
          {parts.length ? `: ${parts.join(", ")}` : ""}
        </span>
      </button>
      {expanded && (
        <div className="space-y-3 pb-4 pl-1">
          {sortSuggestions(suggestions).map((s) => <SuggestionCard key={s.id} runId={runId} suggestion={s} />)}
        </div>
      )}
    </div>
  );
}
