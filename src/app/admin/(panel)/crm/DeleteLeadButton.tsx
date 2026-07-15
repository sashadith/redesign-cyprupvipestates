"use client";

import { useTransition } from "react";
import { softDeleteLeadAction } from "../../actions";

export default function DeleteLeadButton({
  id, redirectTo, className, label = "Delete",
}: {
  id: string;
  redirectTo?: string;
  className?: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("Move this lead to trash? It will disappear from all lists but can be restored within 90 days.")) return;
        startTransition(() => { softDeleteLeadAction(id, redirectTo); });
      }}
      className={className ?? "rounded-md border border-[#FECACA] text-[#DC2626] text-xs px-2 py-1 hover:bg-[#FEF2F2] disabled:opacity-50"}
    >
      {pending ? "Deleting…" : label}
    </button>
  );
}
