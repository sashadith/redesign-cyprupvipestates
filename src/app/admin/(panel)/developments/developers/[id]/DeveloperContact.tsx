"use client";

import React, { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveDeveloperContact } from "@/app/admin/actions";

type Dev = {
  id: string; name: string;
  website: string | null; contactPerson: string | null; phone: string | null;
  email: string | null; developerCloudUrl: string | null; driveFolderUrl: string | null;
  contactInfo: string | null; notes: string | null;
};

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#1B4B43]";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

const field = (label: string, name: string, value: string | null, type = "text") => (
  <div>
    <label className="block text-xs text-[#6B7280] mb-1">{label}</label>
    <input name={name} type={type} defaultValue={value ?? ""} className={input} />
  </div>
);

export default function DeveloperContact({ dev, badge }: { dev: Dev; badge: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useFormState(saveDeveloperContact.bind(null, dev.id), null as { ok?: boolean; error?: string } | null);
  // Collapse the editor once the save succeeds.
  useEffect(() => { if (state?.ok) setEditing(false); }, [state]);

  const rows: [string, React.ReactNode][] = [
    ["Website", dev.website ? <a href={dev.website} target="_blank" rel="noopener noreferrer" className="text-[#1B4B43] hover:underline">{dev.website.replace(/^https?:\/\//, "")}</a> : null],
    ["Contact person", dev.contactPerson],
    ["Phone", dev.phone ? <a href={`tel:${dev.phone}`} className="hover:underline">{dev.phone}</a> : null],
    ["Email", dev.email ? <a href={`mailto:${dev.email}`} className="hover:underline">{dev.email}</a> : null],
    ["Developer Cloud", dev.developerCloudUrl ? <a href={dev.developerCloudUrl} target="_blank" rel="noopener noreferrer" className="text-[#1B4B43] hover:underline">Open portal ↗</a> : null],
    ["Drive folder", dev.driveFolderUrl ? <a href={dev.driveFolderUrl} target="_blank" rel="noopener noreferrer" className="text-[#1B4B43] hover:underline">Open folder ↗</a> : null],
    ["More", dev.contactInfo],
    ["Notes", dev.notes],
  ];
  const filled = rows.filter(([, v]) => v);

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-[#111827]">{dev.name}</h1>
          {badge}
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] text-sm text-[#374151] px-3 py-1.5 hover:bg-[#F8F9FA]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        filled.length ? (
          <dl className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {filled.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-[#9CA3AF] min-w-[112px] shrink-0">{k}</dt>
                <dd className="text-[#111827] break-words">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-[#9CA3AF]">No contact details yet — click Edit to add them.</p>
        )
      ) : (
        <form action={action} className="mt-4 space-y-4">
          {state?.error && <p className="text-sm text-[#C0392B]">{state.error}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            {field("Name *", "name", dev.name)}
            {field("Contact person", "contactPerson", dev.contactPerson)}
            {field("Phone", "phone", dev.phone, "tel")}
            {field("Email", "email", dev.email, "email")}
            {field("Website", "website", dev.website, "url")}
            {field("Developer Cloud link", "developerCloudUrl", dev.developerCloudUrl, "url")}
          </div>
          {field("Drive folder link (Google Drive / OneDrive)", "driveFolderUrl", dev.driveFolderUrl, "url")}
          {field("Additional contact info", "contactInfo", dev.contactInfo)}
          <div>
            <label className="block text-xs text-[#6B7280] mb-1">Notes</label>
            <textarea name="notes" rows={2} defaultValue={dev.notes ?? ""} className={input} />
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
