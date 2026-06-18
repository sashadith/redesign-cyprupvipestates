"use client";
import { useState } from "react";
import RichTextField from "./RichTextField";
import { portableTextToHtml } from "@/lib/portableText/ptToHtml.mjs";

// Self-contained rich editor for a single Portable Text field on any entity.
// Reuses the shared RichTextField + converter; the bound `save` action converts
// HTML → Portable Text server-side. Generic alternative to the project-only PtEditor.
export default function RichFieldEditor({
  initial,
  save,
  label = "Rich text",
}: {
  initial: unknown;
  save: (html: string) => Promise<any>;
  label?: string;
}) {
  const [html, setHtml] = useState(() => portableTextToHtml(Array.isArray(initial) ? initial : []));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "err">("idle");

  async function onSave() {
    setStatus("saving");
    try { await save(html); setStatus("saved"); } catch { setStatus("err"); }
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">{label}</h2>
        <div className="flex items-center gap-2">
          {status === "saved" && <span className="text-xs text-[#2D6E62]">Saved ✓</span>}
          {status === "err" && <span className="text-xs text-[#C0392B]">Save failed</span>}
          <button type="button" onClick={onSave} disabled={status === "saving"}
            className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-1.5 hover:bg-[#142E2D] disabled:opacity-60">
            {status === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <RichTextField initialHtml={html} onChange={setHtml} />
    </div>
  );
}
