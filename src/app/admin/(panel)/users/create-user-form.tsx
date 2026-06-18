"use client";
import { useFormState, useFormStatus } from "react-dom";
import { createUser } from "../../actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Creating…" : "Create user"}
    </button>
  );
}

export default function CreateUserForm() {
  const [state, action] = useFormState<{ error?: string; ok?: string } | null>(createUser as any, null);
  return (
    <form action={action} className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4 max-w-md">
      <h2 className="text-sm font-semibold">Invite user</h2>
      {state?.error && <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{state.error}</p>}
      {state?.ok && <p className="text-sm text-[#2D6E62] bg-[#2D6E62]/10 rounded px-3 py-2">{state.ok}</p>}
      <div className="grid grid-cols-2 gap-3">
        <input name="name" placeholder="Name" required className="rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" />
        <select name="role" className="rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" defaultValue="EDITOR">
          <option value="EDITOR">Editor</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <input name="email" type="email" placeholder="Email" required className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" />
      <input name="password" type="password" placeholder="Temp password (min 12 chars)" required minLength={12} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm" />
      <SubmitBtn />
    </form>
  );
}
