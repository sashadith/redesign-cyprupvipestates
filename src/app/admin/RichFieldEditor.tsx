"use client";
import { useState } from "react";
import RichTextField from "./RichTextField";
import { portableTextToHtml } from "@/lib/portableText/ptToHtml.mjs";

// Self-contained rich editor for a single Portable Text field on any entity.
// Reuses the shared RichTextField + converter; emits its current HTML as a
// hidden input (name={name}) — part of whatever form it's rendered in, not a
// save action of its own. Generic alternative to the project-only PtEditor.
export default function RichFieldEditor({
  name,
  initial,
  label = "Rich text",
}: {
  name: string;
  initial: unknown;
  label?: string;
}) {
  const [html, setHtml] = useState(() => portableTextToHtml(Array.isArray(initial) ? initial : []));

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <input type="hidden" name={name} value={html} />
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">{label}</h2>
      </div>
      <RichTextField initialHtml={html} onChange={setHtml} />
    </div>
  );
}
