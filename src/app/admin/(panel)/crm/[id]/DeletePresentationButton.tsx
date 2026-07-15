"use client";

import { useTransition } from "react";
import { deletePresentationAction } from "./presentationActions";

export default function DeletePresentationButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this presentation permanently? The client link will stop working immediately, and all view/favorite engagement data for it is removed. This cannot be undone."))
          return;
        startTransition(() => { deletePresentationAction(id); });
      }}
      className="rounded-md border border-[#FECACA] text-[#DC2626] text-xs px-2 py-1 hover:bg-[#FEF2F2] disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
