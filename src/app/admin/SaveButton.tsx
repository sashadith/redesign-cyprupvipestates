"use client";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export type SaveResult = { ok?: string; error?: string } | null;

// Single Save button for a whole-page form (see unified-save actions in
// actions.ts). Must render INSIDE the <form> it belongs to — useFormStatus
// reads the nearest enclosing form's pending state. `result` is the value
// useFormState returned for this same form, passed down so a completed
// save (success or error) shows a clear, briefly-persistent message instead
// of the button just silently going back to idle.
export default function SaveButton({ result }: { result: SaveResult }) {
  const { pending } = useFormStatus();
  const [flash, setFlash] = useState<"saved" | "error" | null>(null);

  useEffect(() => {
    if (!result) return;
    if (result.error) { setFlash("error"); return; }
    setFlash("saved");
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [result]);

  return (
    <div className="flex items-center gap-3">
      {flash === "saved" && <span className="text-sm text-[#2D6E62]">✓ {result?.ok || "Updated successfully"}</span>}
      {flash === "error" && <span className="text-sm text-[#C0392B]">Error while saving{result?.error ? ` — ${result.error}` : ""}</span>}
      <button
        disabled={pending}
        className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
