"use client";

import { useTransition } from "react";
import { restoreLeadAction, permanentlyDeleteLeadAction } from "../../../actions";

export default function TrashRowActions({ id, canPermanentlyDelete }: { id: string; canPermanentlyDelete: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 justify-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => { restoreLeadAction(id); })}
        className="rounded-md border border-[#E5E7EB] text-xs px-2 py-1 hover:bg-[#F8F9FA] disabled:opacity-50"
      >
        {pending ? "…" : "Restore"}
      </button>
      {canPermanentlyDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("Permanently delete this lead? This cannot be undone — all activity history and client presentations for this lead are deleted too.")) return;
            startTransition(() => { permanentlyDeleteLeadAction(id); });
          }}
          className="rounded-md border border-[#FECACA] text-[#DC2626] text-xs px-2 py-1 hover:bg-[#FEF2F2] disabled:opacity-50"
        >
          Delete permanently
        </button>
      )}
    </div>
  );
}
