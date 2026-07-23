"use client";
import { useFormState, useFormStatus } from "react-dom";
import { updateOwnProfileAction } from "../../actions";
import PhotoUploadField from "../../PhotoUploadField";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-2 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Saving…" : "Save profile"}
    </button>
  );
}

export default function ProfileForm({
  name, avatar, photoPng, phone,
}: {
  name: string;
  avatar: string | null;
  photoPng: string | null;
  phone: string | null;
}) {
  const [state, action] = useFormState<{ error?: string; ok?: string } | null>(updateOwnProfileAction as any, null);

  return (
    <form action={action} className="max-w-md bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4">
      <h2 className="text-sm font-semibold">Profile</h2>
      {state?.error && <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{state.error}</p>}
      {state?.ok && <p className="text-sm text-[#2D6E62] bg-[#2D6E62]/10 rounded px-3 py-2">{state.ok}</p>}
      <div>
        <label className="block text-sm mb-1">Name</label>
        <input name="name" defaultValue={name} required
          className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]" />
      </div>
      <div>
        <label className="block text-sm mb-1">Phone (shown large on the Client Presentation closing section)</label>
        <input name="phone" type="tel" defaultValue={phone ?? ""} placeholder="+357 99 XXX XXX"
          className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <PhotoUploadField name="avatar" label="Avatar" mode="avatar" accept="image/png,image/jpeg,image/webp" initialUrl={avatar} shape="square" />
        <PhotoUploadField name="photoPng" label="Presentation photo (PNG, transparent)" mode="photoPng" accept="image/png" initialUrl={photoPng} shape="tall" />
      </div>
      <SubmitBtn />
    </form>
  );
}
