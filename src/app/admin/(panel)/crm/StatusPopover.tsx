"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "@/app/admin/status-badge";
import { logStatusChangeContact, updateLeadStatus } from "../../actions";

// 2026-08-11, revised — replaces StatusChangeForm entirely (detail page AND
// lead-list table both use this one component now, so there's exactly one
// status-change experience, not two). Click the badge, click a status,
// done — one click for the common case. Only for the three statuses that
// structurally imply contact already happened (COMMUNICATING/
// VIEWING_SCHEDULED/OFFER — see ELEVATED_NO_CONTACT_STATUSES in crm.ts) does
// the popover advance to a small optional contact-capture step, calling
// logStatusChangeContact as a SEPARATE step after the status is already
// set — skippable, never blocks the status change itself.
//
// Rendered via a portal to document.body, positioned `fixed` from the
// trigger's own bounding rect. Not a CSS-absolute panel inside the row —
// the lead-list table's block containers use overflow-hidden for their
// rounded corners, which would clip an absolutely-positioned popover at the
// table's edge. The portal sidesteps that (and any table z-index/stacking
// quirks) without touching the table's own layout.

const STATUSES = ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "KEEP_CONTACT", "CLOSED", "LOST"];

// Same local-datetime-input default-to-now helper UnifiedTimeline.tsx uses.
function nowForDatetimeLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function StatusPopover({
  leadId,
  currentStatus,
  viewingScheduledAt,
  hasEmail,
  hasPhone,
  contactImplyingStatuses,
}: {
  leadId: string;
  currentStatus: string;
  viewingScheduledAt: string | null; // ISO string, server/client boundary
  hasEmail: boolean;
  hasPhone: boolean;
  contactImplyingStatuses: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "contact">("list");
  const [appliedStatus, setAppliedStatus] = useState<string | null>(null);
  const [logContact, setLogContact] = useState(false);
  const [pending, startTransition] = useTransition();
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<HTMLSelectElement>(null);
  const occurredAtRef = useRef<HTMLInputElement>(null);
  const viewingDateRef = useRef<HTMLInputElement>(null);

  function openPopover() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setCoords({ top: r.bottom + 4, left: r.left });
    setMode("list");
    setLogContact(false);
    setOpen(true);
  }

  function pickStatus(status: string) {
    startTransition(async () => {
      await updateLeadStatus(leadId, status);
      if (contactImplyingStatuses.includes(status)) {
        setAppliedStatus(status);
        setMode("contact");
      } else {
        setOpen(false);
      }
    });
  }

  function submitContact() {
    const status = appliedStatus;
    if (!status) return;
    startTransition(async () => {
      const contact = logContact
        ? {
            channel: (channelRef.current?.value ?? "CALL") as "CALL" | "WHATSAPP" | "EMAIL",
            occurredAt: occurredAtRef.current?.value ? new Date(occurredAtRef.current.value) : new Date(),
          }
        : undefined;
      const vsAt = status === "VIEWING_SCHEDULED" ? (viewingDateRef.current?.value ? new Date(viewingDateRef.current.value) : null) : undefined;
      await logStatusChangeContact(leadId, status, contact, vsAt);
      setOpen(false);
    });
  }

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => (open ? setOpen(false) : openPopover())} className="cursor-pointer">
        <StatusBadge status={currentStatus} />
      </button>
      {open && coords &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: "fixed", top: coords.top, left: coords.left }}
            className="z-50 w-64 rounded-md border border-[#E5E7EB] bg-white shadow-lg text-sm"
          >
            {mode === "list" ? (
              <div className="py-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={pending}
                    onClick={() => pickStatus(s)}
                    className={`block w-full text-left px-3 py-1.5 hover:bg-[#F8F9FA] disabled:opacity-50 ${s === currentStatus ? "font-semibold text-[#1B4B43]" : "text-[#111827]"}`}
                  >
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3">
                <p className="text-xs text-[#6B7280] mb-2">
                  Status set to <span className="font-medium text-[#111827]">{appliedStatus?.replace(/_/g, " ")}</span>.
                </p>
                {appliedStatus === "VIEWING_SCHEDULED" && (
                  <label className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-2">
                    Viewing date
                    <input
                      ref={viewingDateRef}
                      type="date"
                      defaultValue={viewingScheduledAt ? viewingScheduledAt.slice(0, 10) : ""}
                      className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs"
                    />
                  </label>
                )}
                <label className="flex items-center gap-1.5 text-xs text-[#374151] mb-2">
                  <input type="checkbox" checked={logContact} onChange={(e) => setLogContact(e.target.checked)} />
                  Log contact at this status change
                </label>
                {logContact && (
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <select ref={channelRef} defaultValue={hasPhone ? "WHATSAPP" : "CALL"} className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs">
                      {hasPhone && <option value="WHATSAPP">WhatsApp</option>}
                      <option value="CALL">Call</option>
                      {hasEmail && <option value="EMAIL">Email</option>}
                    </select>
                    <input ref={occurredAtRef} type="datetime-local" defaultValue={nowForDatetimeLocal()} className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" disabled={pending} onClick={submitContact} className="rounded-md bg-[#1B4B43] text-white text-xs px-3 py-1.5 hover:bg-[#142E2D] disabled:opacity-50">
                    {logContact ? "Save" : "Done"}
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className="text-xs text-[#6B7280] hover:underline">
                    Skip
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
