"use client";

import { useState, useTransition } from "react";
import { deleteDeveloperAccount } from "@/app/admin/actions";

// This used to be a bare <form action={del}>. Two reasons it is a client
// component now:
//
// 1. deleteDeveloperAccount can refuse — it does so when the developer is
//    currently delivered to the Xellex portal, because the delete cascades its
//    Development rows and neither of the bridge's two removal sources can then
//    report them (see the comment on the action). A plain form action drops the
//    returned value, so the refusal would have been a click that silently did
//    nothing: the worst of both outcomes, since the operator would assume the
//    delete worked.
// 2. It cascades. Asking first is the same guard ArchiveButton uses for a far
//    smaller consequence.
export default function DeleteDeveloperButton({
  id,
  name,
  developmentCount,
}: {
  id: string;
  name: string;
  developmentCount: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    if (
      !confirm(
        `Delete ${name}?\n\nThis also deletes its ${developmentCount} development(s), their units and all feed analyses. It cannot be undone.`,
      )
    )
      return;
    setError(null);
    start(async () => {
      // try/catch, not just the returned error: `deleteDeveloperAccount` starts
      // with requireSession(), which THROWS "Unauthorized", and the delete
      // itself can throw too. Without this, a rejected promise inside the
      // transition means setError never runs and `pending` just clears — a
      // click that silently did nothing, which is the exact outcome this file
      // exists to prevent, reached through a different door. An admin
      // deactivated in another tab hits precisely that path.
      try {
        // On success the action redirects, so nothing after this runs.
        const res = await deleteDeveloperAccount(id);
        if (res?.error) setError(res.error);
      } catch (e) {
        setError(e instanceof Error && e.message === "Unauthorized"
          ? "Your session is no longer active — reload and sign in again."
          : "The delete failed. Nothing was changed; check the server log and try again.");
      }
    });
  };

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="text-sm text-[#C0392B] hover:underline disabled:opacity-60"
      >
        {pending ? "…" : "Delete developer and all analyses"}
      </button>
      {error && (
        <p className="mt-2 max-w-xl rounded-md border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-sm text-[#991B1B]">
          {error}
        </p>
      )}
    </div>
  );
}
