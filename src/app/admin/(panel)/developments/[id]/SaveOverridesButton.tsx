"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/* Save button for the overrides form — same dark-green style as every other save
   button in the admin. A small "Unsaved changes" indicator (not the button itself)
   lights up the moment anything in the form changes, so AI-generated or hand-edited
   content that isn't persisted yet is impossible to miss. Listens for native
   input/change on the parent form, plus a "cve:dirty" custom event that
   DescriptionField fires after a Claude rewrite (React state changes don't emit
   native input events). Cleared once the save's pending state finishes — a plain
   `<form action={...}>` server-action submit doesn't remount this component, so
   without this the indicator would stay lit forever after the very first edit. */
export default function SaveOverridesButton() {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  const [dirty, setDirty] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const mark = () => setDirty(true);
    form.addEventListener("input", mark);
    form.addEventListener("change", mark);
    form.addEventListener("cve:dirty", mark);
    return () => {
      form.removeEventListener("input", mark);
      form.removeEventListener("change", mark);
      form.removeEventListener("cve:dirty", mark);
    };
  }, []);

  useEffect(() => {
    if (wasPending.current && !pending) setDirty(false); // save just completed
    wasPending.current = pending;
  }, [pending]);

  return (
    <div className="flex items-center gap-3">
      <button
        ref={ref}
        disabled={pending}
        className="rounded-md bg-[#1B4B43] hover:bg-[#142E2D] text-white text-sm font-medium px-5 py-2.5 transition-colors disabled:opacity-60"
      >
        {pending ? "Saving…" : dirty ? "Save overrides — unsaved changes" : "Save overrides"}
      </button>
      {dirty && !pending && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#B45309]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#B45309]" />
          Unsaved changes
        </span>
      )}
    </div>
  );
}
