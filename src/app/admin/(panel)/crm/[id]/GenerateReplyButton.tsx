"use client";

import { useState, useTransition } from "react";
import ComposeEmailModal from "./ComposeEmailModal";
import { generateReplyDraftAction, sendGeneratedEmailAction, logGeneratedWhatsAppAction } from "./composeActions";
import type { ComposeChannel, ComposeResult } from "@/lib/crm/compose/generate";

// The Cockpit's "Generate reply" button (Phase 2 of Claude Compose). Channel
// is inferred from the lead's preferredChannel when possible; otherwise a
// small picker asks first. A generated draft is ALWAYS editable before send —
// there is no auto-send path anywhere in this component. WhatsApp has no
// existing compose modal (that channel is log-only, see emailActions.ts), so
// this renders a small equivalent inline rather than reusing ComposeEmailModal.
export default function GenerateReplyButton({
  leadId,
  leadEmail,
  hasPhone,
  preferredChannel,
}: {
  leadId: string;
  leadEmail: string;
  hasPhone: boolean;
  preferredChannel: string | null;
}) {
  const [phase, setPhase] = useState<"idle" | "pick-channel" | "generating" | "review" | "error">("idle");
  const [channel, setChannel] = useState<ComposeChannel | null>(null);
  const [draft, setDraft] = useState<ComposeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [genKey, setGenKey] = useState(0); // forces ComposeEmailModal to remount with fresh initial values per generation
  const [, startTransition] = useTransition();

  const inferredChannel: ComposeChannel | null =
    preferredChannel === "EMAIL" ? "EMAIL" : preferredChannel === "WHATSAPP" && hasPhone ? "WHATSAPP" : null;

  const runGenerate = (ch: ComposeChannel) => {
    setChannel(ch);
    setPhase("generating");
    setError(null);
    startTransition(async () => {
      const res = await generateReplyDraftAction(leadId, ch);
      if (res.ok) {
        setDraft(res);
        setGenKey((k) => k + 1);
        setPhase("review");
      } else {
        setError(res.error);
        setPhase("error");
      }
    });
  };

  const start = () => {
    if (inferredChannel) runGenerate(inferredChannel);
    else setPhase("pick-channel");
  };

  const reset = () => { setPhase("idle"); setDraft(null); setError(null); setChannel(null); };

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="flex-1 sm:flex-none rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-2 hover:bg-[#1B4B43]/5"
      >
        Generate reply
      </button>

      {phase === "pick-channel" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={reset}>
          <div className="bg-white rounded-lg p-6 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#111827]">Generate reply for which channel?</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => runGenerate("EMAIL")}
                className="flex-1 rounded-md bg-[#1B4B43] text-white text-sm px-4 py-2 hover:bg-[#142E2D]"
              >
                Email
              </button>
              {hasPhone && (
                <button
                  type="button"
                  onClick={() => runGenerate("WHATSAPP")}
                  className="flex-1 rounded-md bg-[#1B4B43] text-white text-sm px-4 py-2 hover:bg-[#142E2D]"
                >
                  WhatsApp
                </button>
              )}
            </div>
            <button type="button" onClick={reset} className="text-sm text-[#6B7280] hover:text-[#111827]">Cancel</button>
          </div>
        </div>
      )}

      {phase === "generating" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full text-sm text-[#6B7280]">Generating draft…</div>
        </div>
      )}

      {phase === "error" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={reset}>
          <div className="bg-white rounded-lg p-6 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#111827]">Could not generate a draft</h3>
            <p className="text-sm text-[#DC2626]">{error}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => channel && runGenerate(channel)}
                className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-1.5 hover:bg-[#142E2D]"
              >
                Try again
              </button>
              <button type="button" onClick={reset} className="text-sm text-[#6B7280] hover:text-[#111827]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {phase === "review" && draft?.ok && draft.channel === "EMAIL" && (
        <ComposeEmailModal
          key={genKey}
          leadEmail={leadEmail}
          initialSubject={draft.subject ?? ""}
          initialBody={draft.body}
          sendAction={(opts) => sendGeneratedEmailAction(leadId, { subject: opts.subject, body: opts.body })}
          onClose={reset}
        />
      )}

      {phase === "review" && draft?.ok && draft.channel === "WHATSAPP" && (
        <GeneratedWhatsAppReview key={genKey} leadId={leadId} initialBody={draft.body} onClose={reset} />
      )}
    </>
  );
}

function GeneratedWhatsAppReview({ leadId, initialBody, onClose }: { leadId: string; initialBody: string; onClose: () => void }) {
  const [body, setBody] = useState(initialBody);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);

  const log = () => {
    startTransition(async () => {
      const res = await logGeneratedWhatsAppAction(leadId, { body: body.trim() });
      setResult(res);
      if (res.ok) setTimeout(onClose, 1200);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-[#111827]">WhatsApp draft</h3>
        <div>
          <label className="block text-xs text-[#6B7280] mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm"
          />
          <p className="text-[11px] text-[#9CA3AF] mt-1">Copy this, send it from your own phone, then log it below — same as the existing +WhatsApp flow.</p>
        </div>
        {result?.error && <p className="text-sm text-[#DC2626]">{result.error}</p>}
        {result?.ok && <p className="text-sm text-[#2D6E62]">{result.ok}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={pending || !body.trim()}
            onClick={log}
            className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-1.5 hover:bg-[#142E2D] disabled:opacity-50"
          >
            {pending ? "Logging…" : "Log as sent"}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-[#6B7280] hover:text-[#111827]">Cancel</button>
        </div>
      </div>
    </div>
  );
}
