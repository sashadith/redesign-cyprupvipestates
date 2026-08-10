"use client";
import { useState } from "react";

// Cockpit status form (2026-08-10) — split out from CockpitCard so the
// contact-capture row (channel + date, plus a viewing-date field for
// VIEWING_SCHEDULED) can be shown/hidden by client state without turning the
// whole hero card into a client component. Only appears for the three
// statuses that structurally imply contact (see
// ELEVATED_NO_CONTACT_STATUSES in actionCenter/rules/crm.ts) — status
// changes to CONTACTED/CLOSED/LOST stay a single-click dropdown, same as
// before. Both date fields default to today but are freely editable to a
// past date — status is often updated days after the actual call/viewing.
const STATUSES = ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "CLOSED", "LOST"];
const CONTACT_IMPLYING = new Set(["COMMUNICATING", "VIEWING_SCHEDULED", "OFFER"]);

function todayLocalDateStr(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export default function StatusChangeForm({
  currentStatus,
  hasEmail,
  action,
}: {
  currentStatus: string;
  hasEmail: boolean;
  action: (formData: FormData) => void;
}) {
  const [status, setStatus] = useState(currentStatus);
  const showContact = CONTACT_IMPLYING.has(status);
  const today = todayLocalDateStr();
  // WhatsApp first — it's the more common channel across this lead base; Email
  // only offered when the lead actually has one on file (saves a dead-end pick).
  const channels: { value: string; label: string }[] = [
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "CALL", label: "Call" },
    ...(hasEmail ? [{ value: "EMAIL", label: "Email" }] : []),
  ];

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 mt-2">
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
      <input name="reason" placeholder="Reason / note (optional)" className="rounded-md border border-[#E5E7EB] px-2 py-1 text-sm flex-1 min-w-[160px]" />

      {showContact && (
        <span className="flex items-center gap-1.5 rounded-md bg-[#F3F4F6] px-2 py-1.5">
          <span className="text-xs text-[#6B7280]">Contact logged?</span>
          <select name="contactChannel" defaultValue="" className="rounded border border-[#E5E7EB] px-1.5 py-1 text-xs bg-white">
            <option value="">Skip</option>
            {channels.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input type="date" name="contactDate" defaultValue={today} className="rounded border border-[#E5E7EB] px-1.5 py-1 text-xs" />
        </span>
      )}

      {status === "VIEWING_SCHEDULED" && (
        <span className="flex items-center gap-1.5 rounded-md bg-[#F3F4F6] px-2 py-1.5">
          <span className="text-xs text-[#6B7280]">Viewing on</span>
          <input type="date" name="viewingScheduledAt" className="rounded border border-[#E5E7EB] px-1.5 py-1 text-xs" />
        </span>
      )}

      <button className="rounded-md bg-[#1B4B43] text-white text-xs px-3 py-1.5 hover:bg-[#142E2D]">Save status</button>
    </form>
  );
}
