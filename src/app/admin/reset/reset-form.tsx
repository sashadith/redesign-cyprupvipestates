"use client";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { resetPasswordWithToken } from "../actions";
import PasswordInput from "../login/password-input";

const inputClass = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="w-full rounded-md bg-[#1B4B43] text-white text-sm font-medium py-2.5 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Updating…" : "Set new password"}
    </button>
  );
}

export default function ResetForm({ token }: { token: string }) {
  const [state, action] = useFormState<{ ok?: string; error?: string } | null>(resetPasswordWithToken as any, null);

  if (state?.ok) {
    return (
      <div>
        <p className="text-sm text-[#1B4B43] bg-[#1B4B43]/10 rounded px-3 py-2 mb-4">{state.ok}</p>
        <Link href="/admin/login" className="block text-center text-sm text-[#1B4B43] hover:underline">Go to sign in →</Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div>
        <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2 mb-4">Missing reset token. Use the link from your email.</p>
        <Link href="/admin/forgot" className="block text-center text-xs text-[#6B7280] hover:text-[#1B4B43]">Request a new link</Link>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      {state?.error && <p className="mb-4 text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{state.error}</p>}
      <label className="block text-sm text-[#111827] mb-1" htmlFor="password">New password</label>
      <div className="mb-6">
        <PasswordInput id="password" name="password" required autoComplete="new-password" placeholder="At least 12 characters" className={inputClass} />
      </div>
      <SubmitBtn />
      <Link href="/admin/login" className="block mt-4 text-center text-xs text-[#6B7280] hover:text-[#1B4B43]">← Back to sign in</Link>
    </form>
  );
}
