"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { analyzeDeveloperFeed } from "@/app/admin/actions";

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#1B4B43]";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Analyzing…" : "Analyze feed"}
    </button>
  );
}

export default function AnalyzeForm({ developerAccountId }: { developerAccountId: string }) {
  const action = analyzeDeveloperFeed.bind(null, developerAccountId);
  const [state, formAction] = useFormState<{ error?: string } | null>(action as any, null);
  const [mode, setMode] = useState<"file" | "url">("file");

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <p className="text-sm text-[#C0392B] bg-[#C0392B]/10 rounded px-3 py-2">{state.error}</p>}
      <input type="hidden" name="mode" value={mode} />
      <div className="flex gap-2">
        {(["file", "url"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm border ${
              mode === m ? "bg-[#1B4B43] text-white border-[#1B4B43]" : "border-[#E5E7EB] text-[#111827] hover:bg-[#F8F9FA]"
            }`}
          >
            {m === "file" ? "Upload XML file" : "Feed URL"}
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <div>
          <label className="block text-sm mb-1">XML file (max 5 MB)</label>
          <input type="file" name="file" accept=".xml,text/xml,application/xml" className={input} />
        </div>
      ) : (
        <div>
          <label className="block text-sm mb-1">XML feed URL</label>
          <input name="url" type="url" placeholder="https://developer.example/feed.xml" className={input} />
        </div>
      )}

      <Submit />
    </form>
  );
}
