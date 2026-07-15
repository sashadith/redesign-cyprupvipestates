"use client";

import { useRef, useState } from "react";
import { generateDescription, checkDescriptionUniqueness } from "./actions";
import { ClaudeButton, PromptTuner } from "../_ai";

type Lang = "en" | "de" | "pl" | "ru";
const LANGS: [Lang, string, string][] = [
  ["en", "English", "descriptionEN"],
  ["de", "Deutsch", "descriptionDE"],
  ["pl", "Polski", "descriptionPL"],
  ["ru", "Русский", "descriptionRU"],
];

export default function DescriptionField({ developmentId, initial, aiReady }: { developmentId: string; initial: Record<Lang, string>; aiReady: boolean }) {
  const [texts, setTexts] = useState<Record<Lang, string>>(initial);
  const [tab, setTab] = useState<Lang>("en");
  const [words, setWords] = useState(130);
  const [busy, setBusy] = useState<null | "gen" | "check">(null);
  const [err, setErr] = useState("");
  const [qa, setQa] = useState<null | { uniqueness: number; sim: number; mostSimilar: string }>(null);
  const [emphasize, setEmphasize] = useState("");
  const [avoid, setAvoid] = useState("");
  const [justGen, setJustGen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  async function onGenerate() {
    setBusy("gen"); setErr("");
    const r = await generateDescription(developmentId, words, { emphasize, avoid });
    if (r.ok && r.texts) {
      setTexts(r.texts as Record<Lang, string>); setQa(null); setJustGen(true);
      // React state changes don't emit a native input event — tell the Save button.
      rootRef.current?.dispatchEvent(new Event("cve:dirty", { bubbles: true }));
    } else setErr(r.error || "Generation failed");
    setBusy(null);
  }
  async function onCheck() {
    setBusy("check");
    setQa(await checkDescriptionUniqueness(developmentId, texts.en));
    setBusy(null);
  }

  const wc = (texts[tab] || "").trim().split(/\s+/).filter(Boolean).length;
  const badge = qa ? (qa.uniqueness >= 85 ? ["🟢", "#166534"] : qa.uniqueness >= 70 ? ["🟡", "#92400E"] : ["🔴", "#991B1B"]) : null;

  return (
    <div className="space-y-2" ref={rootRef}>
      {LANGS.map(([k, , name]) => <input key={name} type="hidden" name={name} value={texts[k]} />)}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 border-b border-[#E5E7EB]">
          {LANGS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-1.5 text-sm -mb-px border-b-2 ${tab === k ? "border-[#1B4B43] text-[#111827] font-medium" : "border-transparent text-[#6B7280] hover:text-[#111827]"}`}>
              {label} {texts[k].trim() && <span className="text-[#16A34A]">•</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-[#6B7280]">
            <input type="number" min={50} max={400} step={10} value={words} onChange={(e) => setWords(Number(e.target.value) || 130)} className="w-14 rounded border border-[#E5E7EB] px-1.5 py-1 text-sm" />
            words
          </label>
          <ClaudeButton onClick={onGenerate} busy={busy === "gen"} disabled={!aiReady || busy !== null} title={aiReady ? "" : "Add ANTHROPIC_API_KEY"}>
            {busy === "gen" ? "Writing…" : "Rewrite with Claude"}
          </ClaudeButton>
          <PromptTuner emphasize={emphasize} avoid={avoid} onEmphasize={setEmphasize} onAvoid={setAvoid} presetKey="description" />
        </div>
      </div>

      <textarea value={texts[tab]} onChange={(e) => setTexts({ ...texts, [tab]: e.target.value })} rows={6} className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm leading-relaxed focus:border-[#1B4B43] focus:outline-none" />
      {err && <p className="text-sm text-[#DC2626]">{err}</p>}
      {justGen && !err && (
        <p className="flex items-center gap-2 rounded-md bg-[#FFF7ED] border border-[#FED7AA] px-3 py-2 text-xs font-medium text-[#9A3412]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          Generated in all 4 languages — click “Save overrides” below to publish it.
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-[#9CA3AF] flex-wrap">
        <span>{wc} words</span>
        <button type="button" onClick={onCheck} disabled={busy !== null || !texts.en.trim()} className="rounded border border-[#E5E7EB] px-2 py-1 hover:bg-[#F8F9FA] disabled:opacity-50">
          {busy === "check" ? "Checking…" : "Check uniqueness"}
        </button>
        {qa && <span style={{ color: badge![1] }} className="font-medium">{badge![0]} {qa.uniqueness}% unique{qa.sim > 15 && qa.mostSimilar ? ` · ${qa.sim}% overlap with ${qa.mostSimilar}` : ""}</span>}
      </div>
      <p className="text-[11px] text-[#9CA3AF]">Rewrite is name-free and synthesises location, amenities and unit data across all 4 languages. External AI-content detection (Originality.ai) plugs in once its key is set.</p>
    </div>
  );
}
