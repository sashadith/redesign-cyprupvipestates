"use client";

import { useMemo, useState, useTransition } from "react";
import CollapsibleList from "../CollapsibleList";
import ComposeEmailModal from "./ComposeEmailModal";
import { isManualInteractionType } from "@/lib/crm/interactionHelpers";

export type TimelineRow = {
  id: string;
  type: string;
  direction: string | null;
  channel: string | null;
  subject: string | null;
  body: string | null;
  occurredAt: string; // ISO — passed as a string across the server/client boundary
  createdByName: string | null;
  metadata: { aiGenerated?: boolean; leadReacted?: boolean; presentationToken?: string } | null;
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

// Local-datetime input default = now, in the format <input type="datetime-local">
// wants ("YYYY-MM-DDTHH:mm"), using the browser's own timezone.
function nowForDatetimeLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function UnifiedTimeline({
  interactions,
  leadEmail,
  leadPhone,
  addNoteAction,
  addCallAction,
  sendEmailAction,
  logWhatsAppAction,
  deleteAction,
}: {
  interactions: TimelineRow[];
  leadEmail: string;
  leadPhone: string | null;
  addNoteAction: (formData: FormData) => void;
  addCallAction: (formData: FormData) => void;
  sendEmailAction: (opts: { subject: string; body: string; leadReacted?: boolean }) => Promise<{ ok?: string; error?: string }>;
  logWhatsAppAction: (formData: FormData) => void;
  deleteAction: (interactionId: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [quickAdd, setQuickAdd] = useState<"note" | "call" | "whatsapp" | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDeleteTransition] = useTransition();

  const filtered = useMemo(
    () => (filter === "all" ? interactions : interactions.filter((r) => (TYPE_META[r.type]?.group ?? "system") === filter)),
    [interactions, filter],
  );

  const handleDelete = (id: string) => {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    setDeletingId(id);
    startDeleteTransition(async () => {
      await deleteAction(id);
      setDeletingId(null);
    });
  };

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-base font-semibold text-[#111827]">Timeline</h2>
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

      <div className="flex flex-wrap gap-2 mb-4">
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
        <button
          type="button"
          onClick={() => setShowCompose(true)}
          className="rounded-md border border-[#E5E7EB] text-xs px-2.5 py-1.5 hover:bg-[#F8F9FA]"
        >
          + Email
        </button>
        {leadPhone && (
          <button
            type="button"
            onClick={() => setQuickAdd(quickAdd === "whatsapp" ? null : "whatsapp")}
            className="rounded-md border border-[#E5E7EB] text-xs px-2.5 py-1.5 hover:bg-[#F8F9FA]"
          >
            + WhatsApp
          </button>
        )}
      </div>

      {/* Note/Call/WhatsApp all log the same way — a short body, a
          backdatable occurredAt, and a "Lead reacted" flag for the
          auto-follow-up cadence (src/lib/crm/followUpCadence.ts). WhatsApp
          used to also open a wa.me tab here; removed per walkthrough-2
          feedback — sending happens on the advisor's own phone regardless,
          this is purely a log entry (the Client Presentation "Share via
          WhatsApp" flow is unrelated and unchanged). */}
      {(quickAdd === "note" || quickAdd === "call" || quickAdd === "whatsapp") && (
        <form
          action={quickAdd === "note" ? addNoteAction : quickAdd === "call" ? addCallAction : logWhatsAppAction}
          className="mb-4 space-y-2"
        >
          <textarea
            name="note"
            rows={2}
            required
            autoFocus
            placeholder={quickAdd === "note" ? "Internal note…" : quickAdd === "call" ? "What was discussed on the call…" : "What was sent via WhatsApp…"}
            className="w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              When
              <input
                type="datetime-local"
                name="occurredAt"
                defaultValue={nowForDatetimeLocal()}
                className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <input type="checkbox" name="leadReacted" />
              Lead reacted (resets the auto-follow-up chain)
            </label>
          </div>
          <div className="flex gap-2">
            <button className="rounded-md bg-[#1B4B43] text-white text-xs px-3 py-1.5 hover:bg-[#142E2D]">
              Add {quickAdd === "note" ? "note" : quickAdd === "call" ? "call log" : "WhatsApp log"}
            </button>
            <button type="button" onClick={() => setQuickAdd(null)} className="text-xs text-[#6B7280] hover:underline">
              Cancel
            </button>
          </div>
        </form>
      )}

      {showCompose && (
        <ComposeEmailModal
          leadEmail={leadEmail}
          sendAction={sendEmailAction}
          onClose={() => setShowCompose(false)}
        />
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No activity{filter !== "all" ? " in this category" : " yet"}.</p>
      ) : (
        <CollapsibleList itemCount={filtered.length} previewCount={5}>
          {filtered.map((r, i) => {
            const meta = TYPE_META[r.type] ?? TYPE_META.SYSTEM;
            const deletable = isManualInteractionType(r.type as any);
            return (
              <div key={r.id} className={`text-sm ${i > 0 ? "mt-3 pt-3 border-t border-[#F3F4F6]" : ""}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                    {meta.label}
                  </span>
                  {r.metadata?.aiGenerated && (
                    <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-[#F3F4F6] text-[#6B7280]" title="Drafted by Claude, reviewed and sent by a human">
                      AI draft
                    </span>
                  )}
                  {r.direction && <span className="text-xs text-[#9CA3AF]">{DIRECTION_ARROW[r.direction] ?? ""}</span>}
                  <span className="text-xs text-[#6B7280]">
                    {new Date(r.occurredAt).toLocaleString("en-GB")}
                    {r.createdByName ? ` · ${r.createdByName}` : ""}
                  </span>
                  {deletable && (
                    <button
                      type="button"
                      disabled={deletingId === r.id}
                      onClick={() => handleDelete(r.id)}
                      className="ml-auto text-[11px] text-[#9CA3AF] hover:text-[#DC2626] disabled:opacity-50"
                    >
                      {deletingId === r.id ? "Deleting…" : "Delete"}
                    </button>
                  )}
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
