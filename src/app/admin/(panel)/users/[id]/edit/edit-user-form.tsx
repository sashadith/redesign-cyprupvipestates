"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { updateUserAction } from "../../../../actions";
import PhotoUploadField from "../../../../PhotoUploadField";
import PasswordInput from "../../../../login/password-input";

const field = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]";
const label = "block text-sm mb-1";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export default function EditUserForm({
  user, isSelf,
}: {
  user: { id: string; name: string; email: string; role: string; isActive: boolean; avatar: string | null; photoPng: string | null; phone: string | null };
  isSelf: boolean;
}) {
  const [state, action] = useFormState<{ error?: string; ok?: string } | null>(updateUserAction.bind(null, user.id) as any, null);

  return (
    <form action={action} className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4">
      {state?.error && <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{state.error}</p>}
      {state?.ok && <p className="text-sm text-[#2D6E62] bg-[#2D6E62]/10 rounded px-3 py-2">{state.ok}</p>}

      <div>
        <label className={label}>Name</label>
        <input name="name" defaultValue={user.name} required className={field} />
      </div>
      <div>
        <label className={label}>Email</label>
        <input name="email" type="email" defaultValue={user.email} required className={field} />
      </div>
      <div>
        <label className={label}>Phone (shown large on the Client Presentation closing section)</label>
        <input name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="+357 99 XXX XXX" className={field} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Role</label>
          {/* A disabled field is excluded from the submitted FormData entirely —
              without this hidden fallback, editing your own account silently sent
              role="" (defaulting server-side to EDITOR) instead of your real role. */}
          <select name={isSelf ? undefined : "role"} defaultValue={user.role} disabled={isSelf} className={`${field} disabled:bg-[#F8F9FA] disabled:text-[#9CA3AF]`}>
            <option value="ADMIN">ADMIN</option>
            <option value="EDITOR">EDITOR</option>
          </select>
          {isSelf && <input type="hidden" name="role" value={user.role} />}
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-[#374151]">
            {/* Same disabled-field issue: without the hidden fallback below, this
                was omitted from the submission entirely, isActive read as false,
                and the server correctly (but confusingly) refused to let you
                deactivate yourself — even though you never unchecked anything. */}
            <input type="checkbox" name={isSelf ? undefined : "isActive"} defaultChecked={user.isActive} disabled={isSelf} className="h-4 w-4 rounded border-[#D1D5DB] text-[#1B4B43] disabled:opacity-50" />
            Active
          </label>
          {isSelf && <input type="hidden" name="isActive" value={user.isActive ? "on" : ""} />}
        </div>
      </div>
      {isSelf && <p className="text-xs text-[#9CA3AF] -mt-2">Role and active status can&apos;t be changed on your own account.</p>}

      <div>
        <label className={label}>Reset password (optional, min 12 chars)</label>
        <PasswordInput name="password" autoComplete="new-password" placeholder="Leave blank to keep current password" className={field} />
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#E5E7EB]">
        <PhotoUploadField name="avatar" label="Avatar" mode="avatar" accept="image/png,image/jpeg,image/webp" initialUrl={user.avatar} shape="square" />
        <PhotoUploadField name="photoPng" label="Presentation photo (PNG, transparent)" mode="photoPng" accept="image/png" initialUrl={user.photoPng} shape="tall" />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <SubmitBtn />
        <Link href="/admin/users" className="text-sm text-[#6B7280] hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
