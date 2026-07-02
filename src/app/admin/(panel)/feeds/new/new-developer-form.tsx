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

export default function NewDeveloperForm() {
  const [state, formAction] = useFormState<{ error?: string } | null>(createDeveloperAccount as any, null);
  return (
    <form action={formAction} className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4 max-w-lg">
      {state?.error && <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{state.error}</p>}
      <div>
        <label className="block text-sm mb-1">Developer name *</label>
        <input name="name" required className={input} placeholder="e.g. Aristo Developers" />
      </div>
      <div>
        <label className="block text-sm mb-1">Slug (leave blank to derive from name)</label>
        <input name="slug" className={input} placeholder="aristo-developers" />
      </div>
      <div>
        <label className="block text-sm mb-1">Website</label>
        <input name="website" className={input} placeholder="https://…" />
      </div>
      <div>
        <label className="block text-sm mb-1">Contact info</label>
        <input name="contactInfo" className={input} placeholder="email / phone / contact person" />
      </div>
      <div>
        <label className="block text-sm mb-1">Notes</label>
        <textarea name="notes" rows={3} className={input} />
      </div>
      <Submit />
    </form>
  );
}
