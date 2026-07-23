"use client";

import { useMemo, useState } from "react";
import CollapsibleList from "../CollapsibleList";

export type TimelineRow = {
  id: string;
  type: string;
  direction: string | null;
  channel: string | null;
  subject: string | null;
  body: string | null;
  occurredAt: string; // ISO — passed as a string across the server/client boundary
  createdByName: string | null;
};

const TYPE_META: Record<string, { label: string; className: string; group: "messages" | "presentation" | "system" }> = {
  EMAIL_OUT: { label: "Email", className: "bg-blue-100 text-blue-700", group: "messages" },
  EMAIL_IN: { label: "Email", className: "bg-blue-100 text-blue-700", group: "messages" },
  WHATSAPP_OUT: { label: "WhatsApp", className: "bg-green-100 text-green-700", group: "messages" },
  WHATSAPP_IN: { label: "WhatsApp", className: "bg-green-100 text-green-700", group: "messages" },
  CALL: { label: "Call", className: "bg-purple-100 text-purple-700", group: "messages" },
  NOTE: { label: "Note", className: "bg-yellow-100 text-yellow-800", group: "messages" },
  STATUS_CHANGE: { label: "Status", className: "bg-gray-100 text-gray-700", group: "system" },
  PRESENTATION_EVENT: { label: "Presentation", className: "bg-[#FDF3E3] text-[#8E6B3D]", group: "presentation" },
  SYSTEM: { label: "System", className: "bg-gray-100 text-gray-500", group: "system" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "messages", label: "Messages" },
  { key: "presentation", label: "Presentation" },
  { key: "system", label: "System" },
] as const;

const DIRECTION_ARROW: Record<string, string> = { INBOUND: "←", OUTBOUND: "→" };

export default function UnifiedTimeline({
  interactions,
  addNoteAction,
  addCallAction,
}: {
  interactions: TimelineRow[];
  addNoteAction: (formData: FormData) => void;
  addCallAction: (formData: FormData) => void;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [quickAdd, setQuickAdd] = useState<"note" | "call" | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? interactions : interactions.filter((r) => (TYPE_META[r.type]?.group ?? "system") === filter)),
    [interactions, filter],
  );

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-sm font-semibold">Timeline</h2>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${filter === f.key ? "bg-[#1B4B43] text-white" : "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setQuickAdd(quickAdd === "note" ? null : "note")}
          className="rounded-md border border-[#E5E7EB] text-xs px-2.5 py-1.5 hover:bg-[#F8F9FA]"
        >
          + Note
        </button>
        <button
          type="button"
          onClick={() => setQuickAdd(quickAdd === "call" ? null : "call")}
          className="rounded-md border border-[#E5E7EB] text-xs px-2.5 py-1.5 hover:bg-[#F8F9FA]"
        >
          + Call log
        </button>
      </div>

      {quickAdd && (
        <form
          action={quickAdd === "note" ? addNoteAction : addCallAction}
          className="mb-4 space-y-2"
        >
          <textarea
            name="note"
            rows={2}
            required
            autoFocus
            placeholder={quickAdd === "note" ? "Internal note…" : "What was discussed on the call…"}
            className="w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button className="rounded-md bg-[#1B4B43] text-white text-xs px-3 py-1.5 hover:bg-[#142E2D]">
              Add {quickAdd === "note" ? "note" : "call log"}
            </button>
            <button type="button" onClick={() => setQuickAdd(null)} className="text-xs text-[#6B7280] hover:underline">
              Cancel
            </button>
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No activity{filter !== "all" ? " in this category" : " yet"}.</p>
      ) : (
        <CollapsibleList itemCount={filtered.length} previewCount={5}>
          {filtered.map((r, i) => {
            const meta = TYPE_META[r.type] ?? TYPE_META.SYSTEM;
            return (
              <div key={r.id} className={`text-sm ${i > 0 ? "mt-3 pt-3 border-t border-[#F3F4F6]" : ""}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                    {meta.label}
                  </span>
                  {r.direction && <span className="text-xs text-[#9CA3AF]">{DIRECTION_ARROW[r.direction] ?? ""}</span>}
                  <span className="text-xs text-[#6B7280]">
                    {new Date(r.occurredAt).toLocaleString("en-GB")}
                    {r.createdByName ? ` · ${r.createdByName}` : ""}
                  </span>
                </div>
                {r.subject && <div className="text-sm font-medium mt-1">{r.subject}</div>}
                {r.body && <div className="mt-0.5 whitespace-pre-wrap">{r.body}</div>}
              </div>
            );
          })}
        </CollapsibleList>
      )}
    </div>
  );
}
