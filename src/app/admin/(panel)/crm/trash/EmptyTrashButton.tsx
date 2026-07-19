"use client";

import { useState, useTransition } from "react";
import { emptyTrashAction } from "../../../actions";

export default function EmptyTrashButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (count === 0) return null;

  function close() {
    setOpen(false);
    setConfirmText("");
    setError(null);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await emptyTrashAction();
      if (result?.error) {
        setError(result.error);
        return;
      }
      close();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[#FECACA] text-[#DC2626] text-sm font-medium px-3 py-1.5 hover:bg-[#FEF2F2]"
      >
        Empty trash
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 w-full max-w-md space-y-4">
            <h3 className="text-base font-semibold">Empty trash?</h3>
            <p className="text-sm text-[#6B7280]">
              This will permanently delete {count} lead{count === 1 ? "" : "s"} including their presentations, activity
              history and tracking data — this cannot be undone.
            </p>
            <div>
              <label className="block text-sm mb-1">
                Type <span className="font-semibold">DELETE</span> to confirm
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={close} className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={pending || confirmText !== "DELETE"}
                className="rounded-md bg-[#DC2626] text-white text-sm font-medium px-4 py-2 hover:bg-[#B91C1C] disabled:opacity-40"
              >
                {pending ? "Deleting…" : "Empty trash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
