"use client";

import { useState, useTransition } from "react";

// Shared compose-and-send modal — used by UnifiedTimeline's "+ Email" quick-add
// (empty, showLeadReacted=true) and PropertyMatching's "Send by email" on a
// freshly generated Client Presentation (prefilled subject/body from
// PRESENTATION_EMAIL_TEMPLATE, showLeadReacted=false — the cadence for that
// send was already counted at presentation-creation time, see
// src/lib/crm/followUpCadence.ts, so "lead reacted" doesn't apply here).
export default function ComposeEmailModal({
  leadEmail,
  initialSubject = "",
  initialBody = "",
  presentationToken,
  showLeadReacted = true,
  sendAction,
  onClose,
}: {
  leadEmail: string;
  initialSubject?: string;
  initialBody?: string;
  presentationToken?: string;
  showLeadReacted?: boolean;
  sendAction: (opts: { subject: string; body: string; leadReacted?: boolean; presentationToken?: string }) => Promise<{ ok?: string; error?: string }>;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [leadReacted, setLeadReacted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);

  const send = () => {
    startTransition(async () => {
      const res = await sendAction({ subject: subject.trim(), body: body.trim(), leadReacted, presentationToken });
      setResult(res);
      if (res.ok) setTimeout(onClose, 1200);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-[#111827]">Compose email</h3>
        <div>
          <label className="block text-xs text-[#6B7280] mb-1">To</label>
          <div className="text-sm text-[#111827]">{leadEmail}</div>
        </div>
        <div>
          <label className="block text-xs text-[#6B7280] mb-1">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[#6B7280] mb-1">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm"
          />
          <p className="text-[11px] text-[#9CA3AF] mt-1">Your email signature is appended automatically when this is sent.</p>
        </div>
        {showLeadReacted && (
          <label className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <input type="checkbox" checked={leadReacted} onChange={(e) => setLeadReacted(e.target.checked)} />
            Lead reacted (resets the auto-follow-up chain)
          </label>
        )}
        {result?.error && <p className="text-sm text-[#DC2626]">{result.error}</p>}
        {result?.ok && <p className="text-sm text-[#2D6E62]">{result.ok}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={pending || !subject.trim() || !body.trim()}
            onClick={send}
            className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-1.5 hover:bg-[#142E2D] disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send"}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-[#6B7280] hover:text-[#111827]">Cancel</button>
        </div>
      </div>
    </div>
  );
}
