"use client";
import { useFormState, useFormStatus } from "react-dom";
import { createDeveloperAccount } from "@/app/admin/actions";

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#1B4B43]";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Creating…" : "Create developer"}
    </button>
  );
}

const field = (label: string, name: string, type = "text", placeholder = "") => (
  <div>
    <label className="block text-xs text-[#6B7280] mb-1">{label}</label>
    <input name={name} type={type} placeholder={placeholder} className={input} />
  </div>
);

export default function NewDeveloperForm() {
  const [state, formAction] = useFormState<{ error?: string } | null>(createDeveloperAccount as any, null);
  return (
    <form action={formAction} className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4 max-w-lg">
      {state?.error && <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{state.error}</p>}
      <div>
        <label className="block text-xs text-[#6B7280] mb-1">Developer name *</label>
        <input name="name" required className={input} placeholder="e.g. Aristo Developers" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {field("Contact person", "contactPerson")}
        {field("Phone", "phone", "tel")}
        {field("Email", "email", "email")}
        {field("Website", "website", "url", "https://…")}
        {field("Developer Cloud link", "developerCloudUrl", "url", "https://…")}
        {field("Drive folder link", "driveFolderUrl", "url", "https://drive.google.com/…")}
        {field("Slug (optional)", "slug", "text", "auto from name")}
      </div>
      <div>
        <label className="block text-xs text-[#6B7280] mb-1">Notes</label>
        <textarea name="notes" rows={2} className={input} />
      </div>
      <Submit />
    </form>
  );
}
