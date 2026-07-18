"use client";
import { useState, useTransition } from "react";
import { dismissSuggestion, approveSuggestion } from "./actions";
import type { StoredSuggestion } from "@/lib/seoAdvisor/types";

const IMPACT_COLOR: Record<string, string> = { high: "text-[#1B4B43] bg-[#E2F0E8]", med: "text-[#8A6D1D] bg-[#FBF0D9]", low: "text-[#6B7280] bg-[#F3F4F6]" };
const EFFORT_LABEL: Record<string, string> = { clicks: "A few clicks", small: "Small task (<1h)", session: "Focused session" };

export default function SuggestionCard({ runId, suggestion }: { runId: string; suggestion: StoredSuggestion }) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  if (suggestion.status === "dismissed") return null; // rule already filters these; belt-and-suspenders for direct page loads

  const onDismiss = () => startTransition(() => { dismissSuggestion(runId, suggestion.id); });
  const onApprove = () => startTransition(() => { approveSuggestion(runId, suggestion.id); });
  const copyPrompt = async () => {
    if (!suggestion.preparedPrompt) return;
    await navigator.clipboard.writeText(suggestion.preparedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-[#111827]">{suggestion.title}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${IMPACT_COLOR[suggestion.impact_estimate]}`}>{suggestion.impact_estimate} impact</span>
          <span className="text-[10px] font-medium text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">{suggestion.category}</span>
        </div>
      </div>
      <p className="text-sm text-[#374151] mb-2">{suggestion.rationale}</p>
      <p className="text-xs text-[#6B7280] mb-3"><span className="font-medium text-[#374151]">Action:</span> {suggestion.action} · {EFFORT_LABEL[suggestion.effort]}</p>

      {suggestion.implementationNotes && (
        <div className="bg-[#FBF0D9] border border-[#F0E0B8] rounded-md p-3 mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8A6D1D] block mb-1">Follow-up noted</span>
          <p className="text-xs text-[#374151] whitespace-pre-wrap">{suggestion.implementationNotes}</p>
        </div>
      )}

      {suggestion.status === "approved" && suggestion.preparedPrompt ? (
        <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-md p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#1B4B43]">Approved — ready-to-paste prompt</span>
            <button type="button" onClick={copyPrompt} className="text-xs text-[#1B4B43] hover:underline">{copied ? "Copied ✓" : "Copy"}</button>
          </div>
          <pre className="text-xs text-[#374151] whitespace-pre-wrap font-mono leading-relaxed">{suggestion.preparedPrompt}</pre>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={onApprove} className="text-xs font-medium px-3 py-1.5 rounded-md bg-[#1B4B43] text-white hover:bg-[#163d37] disabled:opacity-50">
            Approved — prepare
          </button>
          <button type="button" disabled={pending} onClick={onDismiss} className="text-xs font-medium px-3 py-1.5 rounded-md border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F8F9FA] disabled:opacity-50">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
