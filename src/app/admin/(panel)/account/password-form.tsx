"use client";
import { useFormState, useFormStatus } from "react-dom";
import { changePassword } from "../../actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Saving…" : "Update password"}
    </button>
  );
}

export default function PasswordForm() {
  const [state, action] = useFormState<{ error?: string; ok?: string } | null>(changePassword as any, null);
  return (
    <form action={action} className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4">
      <h2 className="text-sm font-semibold">Change password</h2>
      {state?.error && <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{state.error}</p>}
      {state?.ok && <p className="text-sm text-[#2D6E62] bg-[#2D6E62]/10 rounded px-3 py-2">{state.ok}</p>}
      <div>
        <label className="block text-sm mb-1">Current password</label>
        <input name="current" type="password" required autoComplete="current-password"
          className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]" />
      </div>
      <div>
        <label className="block text-sm mb-1">New password (min 12 chars)</label>
        <input name="next" type="password" required minLength={12} autoComplete="new-password"
          className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]" />
      </div>
      <SubmitBtn />
    </form>
  );
}
