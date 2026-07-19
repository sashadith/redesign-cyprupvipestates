"use client";
import { useState, useTransition } from "react";
import { dismissSuggestion, approveSuggestion, setImplementationNote } from "./actions";
import type { StoredSuggestion } from "@/lib/seoAdvisor/types";

const IMPACT_COLOR: Record<string, string> = { high: "text-[#1B4B43] bg-[#E2F0E8]", med: "text-[#8A6D1D] bg-[#FBF0D9]", low: "text-[#6B7280] bg-[#F3F4F6]" };
const EFFORT_LABEL: Record<string, string> = { clicks: "A few clicks", small: "Small task (<1h)", session: "Focused session" };

// First line of whichever note explains why this suggestion is closed —
// the collapsed row's one-line outcome summary.
function outcomeOneLiner(s: StoredSuggestion): string {
  const note = s.status === "dismissed" ? s.dismissalReason : s.implementationNotes;
  if (!note) return "";
  const firstLine = note.split("\n")[0].trim();
  return firstLine.length > 140 ? `${firstLine.slice(0, 140)}…` : firstLine;
}

function outcomeDate(s: StoredSuggestion): string | null {
  const iso = s.status === "dismissed" ? s.dismissedAt : s.approvedAt;
  return iso ? iso.slice(0, 10) : null;
}

export default function SuggestionCard({ runId, suggestion }: { runId: string; suggestion: StoredSuggestion }) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const isClosed = suggestion.status !== "open";
  // Open cards always render in full; closed ones start collapsed and expand on click.
  const [expanded, setExpanded] = useState(!isClosed);
  const [addingNote, setAddingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const onDismiss = () => startTransition(() => { dismissSuggestion(runId, suggestion.id); });
  const onApprove = () => startTransition(() => { approveSuggestion(runId, suggestion.id); });
  const saveNote = () => {
    if (!noteDraft.trim()) return;
    startTransition(() => { setImplementationNote(runId, suggestion.id, noteDraft.trim()); });
    setAddingNote(false);
  };
  const copyPrompt = async () => {
    if (!suggestion.preparedPrompt) return;
    await navigator.clipboard.writeText(suggestion.preparedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isClosed && !expanded) {
    const icon = suggestion.status === "dismissed" ? "✗" : "✓";
    const iconColor = suggestion.status === "dismissed" ? "text-[#9CA3AF]" : "text-[#1B4B43]";
    const date = outcomeDate(suggestion);
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 bg-white rounded-lg border border-[#E5E7EB] px-4 py-2.5 text-left hover:bg-[#F8F9FA] cursor-pointer"
      >
        <span className={`text-sm font-semibold shrink-0 ${iconColor}`}>{icon}</span>
        <span className="text-sm font-medium text-[#111827] shrink-0">{suggestion.title}</span>
        <span className="text-xs text-[#6B7280] truncate flex-1">{outcomeOneLiner(suggestion)}</span>
        {date && <span className="text-xs text-[#9CA3AF] shrink-0">{date}</span>}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <div
        className={`flex items-start justify-between gap-3 mb-2 ${isClosed ? "cursor-pointer" : ""}`}
        onClick={isClosed ? () => setExpanded((v) => !v) : undefined}
      >
        <div className="flex items-center gap-2">
          {isClosed && <span className={`text-sm font-semibold ${suggestion.status === "dismissed" ? "text-[#9CA3AF]" : "text-[#1B4B43]"}`}>{suggestion.status === "dismissed" ? "✗" : "✓"}</span>}
          <h3 className="text-sm font-semibold text-[#111827]">{suggestion.title}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${IMPACT_COLOR[suggestion.impact_estimate]}`}>{suggestion.impact_estimate} impact</span>
          <span className="text-[10px] font-medium text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{suggestion.category}</span>
          {isClosed && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
              className="text-xs text-[#6B7280] hover:underline ml-1"
            >
              Collapse
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-[#374151] mb-2">{suggestion.rationale}</p>
      <p className="text-xs text-[#6B7280] mb-3"><span className="font-medium text-[#374151]">Action:</span> {suggestion.action} · {EFFORT_LABEL[suggestion.effort]}</p>

      {suggestion.status === "dismissed" && suggestion.dismissalReason && (
        <div className="bg-[#F3F4F6] border border-[#E5E7EB] rounded-md p-3 mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280] block mb-1">Dismissed</span>
          <p className="text-xs text-[#374151] whitespace-pre-wrap">{suggestion.dismissalReason}</p>
        </div>
      )}

      {suggestion.implementationNotes && (
        <div className="bg-[#FBF0D9] border border-[#F0E0B8] rounded-md p-3 mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8A6D1D] block mb-1">Follow-up noted</span>
          <p className="text-xs text-[#374151] whitespace-pre-wrap">{suggestion.implementationNotes}</p>
        </div>
      )}

      {isClosed && !suggestion.implementationNotes && (
        <div className="mb-3" onClick={(e) => e.stopPropagation()}>
          {addingNote ? (
            <div className="bg-[#FBF0D9] border border-[#F0E0B8] rounded-md p-3">
              <textarea
                autoFocus
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="What happened when this was implemented/dismissed?"
                className="w-full text-xs text-[#374151] bg-white border border-[#E5E7EB] rounded-md p-2 mb-2 min-h-[70px]"
              />
              <div className="flex gap-2">
                <button type="button" disabled={pending} onClick={saveNote} className="text-xs font-medium px-3 py-1 rounded-md bg-[#1B4B43] text-white hover:bg-[#163d37] disabled:opacity-50">
                  Save note
                </button>
                <button type="button" onClick={() => setAddingNote(false)} className="text-xs text-[#6B7280] hover:underline">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingNote(true)} className="text-xs text-[#8A6D1D] hover:underline">
              + Add follow-up note
            </button>
          )}
        </div>
      )}

      {suggestion.status === "approved" && suggestion.preparedPrompt ? (
        <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-md p-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#1B4B43]">Approved — ready-to-paste prompt</span>
            <button type="button" onClick={copyPrompt} className="text-xs text-[#1B4B43] hover:underline">{copied ? "Copied ✓" : "Copy"}</button>
          </div>
          <pre className="text-xs text-[#374151] whitespace-pre-wrap font-mono leading-relaxed">{suggestion.preparedPrompt}</pre>
        </div>
      ) : suggestion.status === "open" ? (
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={onApprove} className="text-xs font-medium px-3 py-1.5 rounded-md bg-[#1B4B43] text-white hover:bg-[#163d37] disabled:opacity-50">
            Approved — prepare
          </button>
          <button type="button" disabled={pending} onClick={onDismiss} className="text-xs font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F8F9FA] disabled:opacity-50">
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
