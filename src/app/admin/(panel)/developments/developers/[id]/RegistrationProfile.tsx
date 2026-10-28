"use client";

import React, { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveDeveloperRegistrationProfile } from "@/app/admin/actions";
import type { RegChannel } from "@/lib/crm/registration/core";

// Developer client registration profile (spec 2026-10-27 §6.1). Where the CRM's
// "Register" sends a client registration for this developer.

type Profile = {
  id: string;
  registrationChannel: RegChannel;
  registrationEmailTo: string[];
  registrationEmailCc: string[];
  registrationWhatsApp: string[];
};

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#1B4B43]";
const CHANNEL_LABEL: Record<RegChannel, string> = { NONE: "None", EMAIL: "Email", WHATSAPP: "WhatsApp" };

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export default function RegistrationProfile({ dev }: { dev: Profile }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useFormState(saveDeveloperRegistrationProfile.bind(null, dev.id), null as { ok?: boolean; error?: string } | null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (state?.ok) { setEditing(false); setSaved(true); }
  }, [state]);

  const ch = dev.registrationChannel;
  const targets = ch === "EMAIL" ? dev.registrationEmailTo : ch === "WHATSAPP" ? dev.registrationWhatsApp : [];

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#111827]">Client registration</h2>
          <p className="mt-1 text-xs text-[#6B7280]">Dedicated registration targets — not the company&apos;s main contact. Messages are sent from office@.</p>
        </div>
        {!editing && (
          <button onClick={() => { setEditing(true); setSaved(false); }} className="shrink-0 rounded-md border border-[#E5E7EB] text-sm text-[#374151] px-3 py-1.5 hover:bg-[#F8F9FA]">
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div className="mt-4 text-sm space-y-1.5">
          {saved && <p className="text-xs text-[#166534]">Saved.</p>}
          <div className="flex gap-2">
            <span className="text-[#9CA3AF] min-w-[112px] shrink-0">Channel</span>
            <span className="text-[#111827]">{CHANNEL_LABEL[ch]}</span>
          </div>
          {ch !== "NONE" && (
            <div className="flex gap-2">
              <span className="text-[#9CA3AF] min-w-[112px] shrink-0">{ch === "EMAIL" ? "To" : "Numbers"}</span>
              <span className="text-[#111827] break-words">{targets.join(", ") || "—"}</span>
            </div>
          )}
          {ch === "EMAIL" && dev.registrationEmailCc.length > 0 && (
            <div className="flex gap-2">
              <span className="text-[#9CA3AF] min-w-[112px] shrink-0">CC</span>
              <span className="text-[#111827] break-words">{dev.registrationEmailCc.join(", ")}</span>
            </div>
          )}
          {ch === "NONE" && <p className="text-xs text-[#9CA3AF]">No registration channel set — this developer cannot be picked in the CRM&apos;s Register dialog.</p>}
        </div>
      ) : (
        <form action={action} className="mt-4 space-y-4">
          {state?.error && <p className="text-sm text-[#C0392B]">{state.error}</p>}
          <div className="max-w-xs">
            <label className="block text-xs text-[#6B7280] mb-1">Channel</label>
            <select name="channel" defaultValue={ch} className={input}>
              <option value="NONE">None</option>
              <option value="EMAIL">Email</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">To (one per line)</label>
              <textarea name="emailTo" rows={3} defaultValue={dev.registrationEmailTo.join("\n")} className={input} />
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">CC (one per line)</label>
              <textarea name="emailCc" rows={3} defaultValue={dev.registrationEmailCc.join("\n")} className={input} />
            </div>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">WhatsApp numbers (+country code, one per line)</label>
              <textarea name="whatsApp" rows={3} defaultValue={dev.registrationWhatsApp.join("\n")} className={input} />
            </div>
          </div>
          <div className="flex gap-2">
            <SaveBtn />
            <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
