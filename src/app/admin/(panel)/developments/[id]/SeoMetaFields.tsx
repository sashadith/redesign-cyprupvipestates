"use client";

import { useRef, useState } from "react";
import { generateSeoMetaAction, saveSeoPromptAction } from "./actions";
import { ClaudeButton } from "../_ai";

type Lang = "en" | "de" | "pl" | "ru";
const LANGS: [Lang, string][] = [["en", "English"], ["de", "Deutsch"], ["pl", "Polski"], ["ru", "Русский"]];

type Fields = Record<`title${"EN" | "DE" | "PL" | "RU"}` | `desc${"EN" | "DE" | "PL" | "RU"}`, string>;

const field = "w-full rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-sm focus:border-[#1B4B43] focus:outline-none";
const label = "block text-xs font-medium text-[#6B7280] mb-1";

export default function SeoMetaFields({
  developmentId, initial, titleMax, descMax, aiReady, initialPrompt,
}: {
  developmentId: string;
  initial: Fields;
  titleMax: number;
  descMax: number;
  aiReady: boolean;
  initialPrompt: string;
}) {
  const [values, setValues] = useState<Fields>(initial);
  const [tab, setTab] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [justGen, setJustGen] = useState(false);
  const [emphasize, setEmphasize] = useState("");
  const [avoid, setAvoid] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const set = (k: keyof Fields, v: string) => setValues((s) => ({ ...s, [k]: v }));

  async function onGenerate() {
    setBusy(true); setErr(""); setJustGen(false);
    const r = await generateSeoMetaAction(developmentId, { emphasize, avoid });
    if (r.ok && r.result) {
      setValues(r.result);
      setJustGen(true);
      rootRef.current?.dispatchEvent(new Event("cve:dirty", { bubbles: true }));
    } else setErr(r.error || "Generation failed");
    setBusy(false);
  }

  const titleKey = `title${tab.toUpperCase()}` as keyof Fields;
  const descKey = `desc${tab.toUpperCase()}` as keyof Fields;
  const titleLen = values[titleKey].length;
  const descLen = values[descKey].length;

  return (
    <div className="space-y-2" ref={rootRef}>
      {(Object.keys(values) as (keyof Fields)[]).map((k) => (
        <input key={k} type="hidden" name={`seo${k.charAt(0).toUpperCase()}${k.slice(1)}`} value={values[k]} />
      ))}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 border-b border-[#E5E7EB]">
          {LANGS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-1.5 text-sm -mb-px border-b-2 ${tab === k ? "border-[#1B4B43] text-[#111827] font-medium" : "border-transparent text-[#6B7280] hover:text-[#111827]"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ClaudeButton onClick={onGenerate} busy={busy} disabled={!aiReady} title={aiReady ? "" : "Add ANTHROPIC_API_KEY"}>
            {busy ? "Writing…" : "Generate with Claude"}
          </ClaudeButton>
          <SeoPromptEditor initialPrompt={initialPrompt} emphasize={emphasize} avoid={avoid} onEmphasize={setEmphasize} onAvoid={setAvoid} />
        </div>
      </div>

      <div>
        <label className={label}>Meta title <span className={titleLen > titleMax ? "text-[#DC2626]" : "text-[#9CA3AF]"}>({titleLen}/{titleMax})</span></label>
        <input value={values[titleKey]} onChange={(e) => set(titleKey, e.target.value)} maxLength={120} className={field} />
      </div>
      <div>
        <label className={label}>Meta description <span className={descLen > descMax ? "text-[#DC2626]" : "text-[#9CA3AF]"}>({descLen}/{descMax})</span></label>
        <textarea value={values[descKey]} onChange={(e) => set(descKey, e.target.value)} rows={2} maxLength={300} className={field} />
      </div>

      {err && <p className="text-sm text-[#DC2626]">{err}</p>}
      {justGen && !err && (
        <p className="flex items-center gap-2 rounded-md bg-[#FFF7ED] border border-[#FED7AA] px-3 py-2 text-xs font-medium text-[#9A3412]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          Generated in all 4 languages — click “Save overrides” below to publish it.
        </p>
      )}
      <p className="text-[11px] text-[#9CA3AF]">Pre-filled with the free auto-generated text; “Generate with Claude” writes a punchier alternative you can still edit before saving.</p>
    </div>
  );
}

// Distinct from the emphasize/avoid PromptTuner used elsewhere (_ai.tsx, localStorage,
// per-device) — this shows and edits the FULL prompt text, persisted in the DB
// (AiPromptTemplate, key "seoMeta") so it's shared across every admin and every
// project, editable right here without a separate settings page.
function SeoPromptEditor({
  initialPrompt, emphasize, avoid, onEmphasize, onAvoid,
}: {
  initialPrompt: string;
  emphasize: string; avoid: string;
  onEmphasize: (v: string) => void; onAvoid: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const ta = "w-full rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-sm leading-relaxed focus:border-[#1B4B43] focus:outline-none font-mono";

  async function save() {
    setSaving(true);
    await saveSeoPromptAction(prompt);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F8F9FA] px-3 py-2 text-sm font-medium"
        title="View/edit the full prompt behind “Generate with Claude” — shared by every project"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
        Adjust prompt
      </button>
      {/* Centered modal, not an anchored popover — the base prompt + tuning fields
          are tall enough that anchoring to the button (which can sit anywhere in a
          narrow column) risks overflowing under the sidebar or off-screen. Same
          fixed-overlay pattern as the image zoom in UnitImages.tsx/FloorPlansManager.tsx. */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className="w-[36rem] max-w-[92vw] max-h-[85vh] overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white shadow-xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[#111827]">Base prompt</span>
                <span className="text-[11px] text-[#9CA3AF]">Shared by every project — editing here changes it everywhere</span>
              </div>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={12} className={ta} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-[#166534] mb-1">✓ Emphasize / include (this project only)</span>
                <textarea value={emphasize} onChange={(e) => onEmphasize(e.target.value)} rows={2} className={ta.replace(" font-mono", "")} />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-[#991B1B] mb-1">✕ Avoid / exclude (this project only)</span>
                <textarea value={avoid} onChange={(e) => onAvoid(e.target.value)} rows={2} className={ta.replace(" font-mono", "")} />
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">{saved ? "Saved — used by every project from now on." : "Emphasize/avoid apply once to this generation only."}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-[#6B7280] hover:text-[#111827] px-2 py-1.5">Close</button>
                <button type="button" onClick={save} disabled={saving} className="rounded-md bg-[#1B4B43] text-white text-xs font-medium px-3 py-1.5 hover:bg-[#142E2D] disabled:bg-[#D1D5DB]">
                  {saving ? "Saving…" : "Save prompt"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
