"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateArea, saveArea } from "./actions";
import type { FourLang } from "@/lib/ai/areaContent";
import { ClaudeButton, PromptTuner } from "../_ai";

const LANGS: [keyof FourLang, string][] = [
  ["en", "English"],
  ["de", "Deutsch"],
  ["pl", "Polski"],
  ["ru", "Русский"],
];

export default function AreaEditor({
  slug, name, district, initial, initialStatus, aiReady,
}: {
  slug: string; name: string; district: string;
  initial: FourLang; initialStatus: string; aiReady: boolean;
}) {
  const [texts, setTexts] = useState<FourLang>(initial);
  const [tab, setTab] = useState<keyof FourLang>("en");
  const [busy, setBusy] = useState<null | "gen" | "save" | "approve">(null);
  const [status, setStatus] = useState(initialStatus);
  const [words, setWords] = useState(90);
  const [err, setErr] = useState("");
  const [emphasize, setEmphasize] = useState("");
  const [avoid, setAvoid] = useState("");
  const router = useRouter();

  const wordCount = (texts[tab] || "").trim().split(/\s+/).filter(Boolean).length;
  const filled = LANGS.filter(([k]) => (texts[k] || "").trim()).length;

  async function onGenerate() {
    setBusy("gen"); setErr("");
    const r = await generateArea(name, district, words, { emphasize, avoid });
    if (r.ok && r.texts) setTexts(r.texts);
    else setErr(r.error || "Generation failed");
    setBusy(null);
  }
  async function onSave(approve: boolean) {
    setBusy(approve ? "approve" : "save"); setErr("");
    await saveArea({ slug, name, district, texts, approve });
    setStatus(approve ? "approved" : "draft");
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#6B7280]">Languages filled:</span>
          <span className="font-medium">{filled}/4</span>
          <span className={`rounded px-2 py-0.5 text-xs capitalize ${status === "approved" ? "bg-[#DCFCE7] text-[#166534]" : status === "draft" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{status === "none" ? "not created" : status}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-[#6B7280]">
            <span>Length</span>
            <input
              type="number" min={30} max={400} step={10} value={words}
              onChange={(e) => setWords(Number(e.target.value) || 90)}
              className="w-16 rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm text-[#111827] focus:border-[#D97757] focus:outline-none"
            />
            <span>words</span>
          </label>
          <ClaudeButton onClick={onGenerate} busy={busy === "gen"} disabled={!aiReady || busy !== null} title={aiReady ? "" : "Add ANTHROPIC_API_KEY to enable"}>
            {busy === "gen" ? "Generating…" : "Generate all 4 languages with Claude"}
          </ClaudeButton>
          <PromptTuner emphasize={emphasize} avoid={avoid} onEmphasize={setEmphasize} onAvoid={setAvoid} presetKey="area" />
        </div>
      </div>

      {/* language tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB]">
        {LANGS.map(([k, lbl]) => {
          const has = !!(texts[k] || "").trim();
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === k ? "border-[#1B4B43] text-[#111827] font-medium" : "border-transparent text-[#6B7280] hover:text-[#111827]"}`}
            >
              {lbl} {has && <span className="text-[#16A34A]">•</span>}
            </button>
          );
        })}
      </div>

      <div>
        <textarea
          value={texts[tab] || ""}
          onChange={(e) => setTexts({ ...texts, [tab]: e.target.value })}
          rows={8}
          placeholder={aiReady ? "Write, or click “Generate all 4 languages”." : "Add ANTHROPIC_API_KEY to generate, or write manually."}
          className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm leading-relaxed focus:border-[#1B4B43] focus:outline-none"
        />
        <div className="text-xs text-[#9CA3AF] mt-1">{wordCount} words · target 80–110</div>
      </div>

      {err && <p className="text-sm text-[#DC2626]">{err}</p>}

      <div className="flex gap-2">
        <button onClick={() => onSave(false)} disabled={busy !== null} className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA] disabled:opacity-50">
          {busy === "save" ? "Saving…" : "Save draft"}
        </button>
        <button onClick={() => onSave(true)} disabled={busy !== null || filled === 0} className="rounded-md bg-[#166534] text-white text-sm font-medium px-4 py-2 hover:bg-[#14532D] disabled:bg-[#D1D5DB] disabled:cursor-not-allowed">
          {busy === "approve" ? "Approving…" : "Approve & save"}
        </button>
      </div>
      <p className="text-xs text-[#9CA3AF]">Approving unlocks the “neighbourhood description” requirement in the publication gate for every project in this area. Set a word count and click generate again to regenerate.</p>
    </div>
  );
}
