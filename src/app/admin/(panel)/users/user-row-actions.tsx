"use client";
import { useState } from "react";
import { useFormState } from "react-dom";
import { toggleUserActive, deleteUser, adminSetPassword } from "../../actions";
import PasswordInput from "../../login/password-input";

export default function UserRowActions({
  userId,
  email,
  isActive,
  isSelf,
}: {
  userId: string;
  email: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pwState, pwAction] = useFormState<{ ok?: string; error?: string } | null>(adminSetPassword.bind(null, userId) as any, null);

  if (isSelf) return <span className="text-xs text-[#9CA3AF]">(you)</span>;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-3">
        <form action={toggleUserActive.bind(null, userId)}>
          <button className="text-xs text-[#1B4B43] hover:underline">{isActive ? "Deactivate" : "Activate"}</button>
        </form>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-[#1B4B43] hover:underline">
          Set password
        </button>
        <form
          action={deleteUser.bind(null, userId)}
          onSubmit={(e) => {
            if (!confirm(`Remove ${email}? This permanently deletes the account.`)) e.preventDefault();
          }}
        >
          <button className="text-xs text-[#C0392B] hover:underline">Remove</button>
        </form>
      </div>
      {open && (
        <form action={pwAction} className="flex items-center gap-2 mt-1">
          <PasswordInput
            name="password"
            required
            autoComplete="new-password"
            placeholder="New password (min 12)"
            className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs w-52"
          />
          <button className="text-xs bg-[#1B4B43] text-white rounded px-2 py-1 hover:bg-[#142E2D]">Save</button>
        </form>
      )}
      {pwState?.ok && <span className="text-[11px] text-[#1B4B43]">{pwState.ok}</span>}
      {pwState?.error && <span className="text-[11px] text-[#C0392B]">{pwState.error}</span>}
    </div>
  );
}
