"use client";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createMediaFolder, deleteMediaFolder } from "../../actions";

function CreateBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="rounded-md bg-[#1B4B43] text-white text-xs px-2.5 py-1.5 hover:bg-[#142E2D] disabled:opacity-60 shrink-0">
      {pending ? "…" : "Add"}
    </button>
  );
}

export function CreateFolderForm() {
  const [state, action] = useFormState<{ ok?: string; error?: string } | null>(createMediaFolder as any, null);
  return (
    <form action={action} className="mb-2">
      <div className="flex gap-1">
        <input name="name" placeholder="New folder…" maxLength={80}
          className="w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm outline-none focus:border-[#1B4B43]" />
        <CreateBtn />
      </div>
      {state?.error && <p className="text-[11px] text-[#C0392B] mt-1">{state.error}</p>}
      {state?.ok && <p className="text-[11px] text-[#2D6E62] mt-1">{state.ok}</p>}
    </form>
  );
}

export function DeleteFolderButton({ name }: { name: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      title={`Delete folder “${name}”`}
      onClick={async () => {
        if (confirm(`Delete folder “${name}”? Files in it become Unfiled (they are not deleted).`)) {
          await deleteMediaFolder(name);
          router.refresh();
        }
      }}
      className="text-[#9CA3AF] hover:text-[#C0392B] text-xs px-1 shrink-0"
    >
      ✕
    </button>
  );
}
