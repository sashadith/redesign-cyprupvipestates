"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { importFromPdfs } from "./actions";
import { ClaudeMark, ClaudeButton, PromptTuner } from "../_ai";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ClaudeButton type="submit" busy={pending} disabled={disabled}>
      {pending ? "Extracting… (~20s)" : "Extract & fill with Claude"}
    </ClaudeButton>
  );
}

export default function PdfImport({ id }: { id: string }) {
  const [names, setNames] = useState<string[]>([]);
  const [emphasize, setEmphasize] = useState("");
  const [avoid, setAvoid] = useState("");
  return (
    <form action={importFromPdfs} className="bg-[#FFF7ED] rounded-lg border border-[#FED7AA] p-5 space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-center gap-2">
        <ClaudeMark className="text-[#D97757]" />
        <h2 className="text-sm font-semibold text-[#7C2D12]">Import from developer PDF</h2>
      </div>
      <p className="text-xs text-[#9A3412] leading-relaxed">
        Upload the developer brochure and/or price list. Claude extracts the name, description, completion, amenities and every unit, then fills the empty fields below and adds the units. Existing values are kept — review before publishing.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="inline-flex items-center gap-2 rounded-md border border-[#FED7AA] bg-white px-3 py-2 text-sm font-medium text-[#9A3412] cursor-pointer hover:bg-[#FFF1E3]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /></svg>
          Choose PDF files
          <input
            type="file" name="pdfs" multiple accept="application/pdf"
            className="hidden"
            onChange={(e) => setNames(Array.from(e.target.files ?? []).map((f) => f.name))}
          />
        </label>
        <span className="text-xs text-[#9A3412] max-w-[16rem] truncate" title={names.join(", ")}>
          {names.length === 0 ? "No files selected" : names.length === 1 ? names[0] : `${names.length} files selected`}
        </span>
        <SubmitButton disabled={names.length === 0} />
        <PromptTuner emphasize={emphasize} avoid={avoid} onEmphasize={setEmphasize} onAvoid={setAvoid} presetKey="pdf" asFormFields />
      </div>
    </form>
  );
}
