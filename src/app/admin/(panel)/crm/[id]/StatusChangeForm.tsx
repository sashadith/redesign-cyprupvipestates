"use client";

import { useState } from "react";

// 2026-08-11 — extracted from CockpitCard's old plain inline <select>+button
// so a status change can also capture a viewing date (VIEWING_SCHEDULED) and
// an inline "contact happened at this change" log — both need client state
// (show/hide fields based on the selected status) that a plain <form> can't
// do. Submits through the exact same setStatusAction as before; the extra
// fields are read server-side in page.tsx's setStatus and passed on to
// updateLeadStatus's new contact/viewingScheduledAt params.

const STATUSES = ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "KEEP_CONTACT", "CLOSED", "LOST"];

// Same local-datetime-input default-to-now helper UnifiedTimeline.tsx uses.
function nowForDatetimeLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function StatusChangeForm({
  currentStatus,
  viewingScheduledAt,
  hasEmail,
  hasPhone,
  contactImplyingStatuses,
  action,
}: {
  currentStatus: string;
  viewingScheduledAt: string | null; // ISO string, server/client boundary
  hasEmail: boolean;
  hasPhone: boolean;
  contactImplyingStatuses: readonly string[];
  action: (formData: FormData) => void;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [logContact, setLogContact] = useState(false);
  const showViewingDate = status === "VIEWING_SCHEDULED";
  const showContactCapture = contactImplyingStatuses.includes(status);

  return (
    <form action={action} className="flex flex-col gap-2 mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-[#E5E7EB] px-2 py-1 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <input
          name="reason"
          placeholder="Reason / note (optional)"
          className="rounded-md border border-[#E5E7EB] px-2 py-1 text-sm flex-1 min-w-[160px]"
        />
        <button className="rounded-md bg-[#1B4B43] text-white text-xs px-3 py-1.5 hover:bg-[#142E2D]">Save status</button>
      </div>

      {showViewingDate && (
        <label className="flex items-center gap-1.5 text-xs text-[#6B7280]">
          Viewing date
          <input
            type="date"
            name="viewingScheduledAt"
            defaultValue={viewingScheduledAt ? viewingScheduledAt.slice(0, 10) : ""}
            className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs"
          />
        </label>
      )}

      {showContactCapture && (
        <div className="rounded-md bg-[#F8F9FA] p-2">
          <label className="flex items-center gap-1.5 text-xs text-[#374151]">
            <input
              type="checkbox"
              name="logContact"
              checked={logContact}
              onChange={(e) => setLogContact(e.target.checked)}
            />
            Log contact at this status change
          </label>
          {logContact && (
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <select
                name="contactChannel"
                defaultValue={hasPhone ? "WHATSAPP" : "CALL"}
                className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs"
              >
                {hasPhone && <option value="WHATSAPP">WhatsApp</option>}
                <option value="CALL">Call</option>
                {hasEmail && <option value="EMAIL">Email</option>}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                When
                <input
                  type="datetime-local"
                  name="contactOccurredAt"
                  defaultValue={nowForDatetimeLocal()}
                  className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
