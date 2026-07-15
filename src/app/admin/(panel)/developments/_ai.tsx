"use client";

import { useEffect, useState } from "react";

/* Shared building blocks for every Claude-powered action in the Developments admin,
   so all Claude buttons look and behave identically. */

/** The Claude "burst" mark, drawn inline (CSP-safe, no external asset). */
export function ClaudeMark({ className = "", size = 16 }: { className?: string; size?: number }) {
  const spokes = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return (
      <line key={i} x1={12 + Math.cos(a) * 3.4} y1={12 + Math.sin(a) * 3.4} x2={12 + Math.cos(a) * 9} y2={12 + Math.sin(a) * 9} />
    );
  });
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" aria-hidden="true">
      {spokes}
    </svg>
  );
}

/** Uniform Claude action button — same size/style everywhere, with the logo mark. */
export function ClaudeButton({
  children, busy = false, disabled = false, type = "button", onClick, title,
}: {
  children: React.ReactNode; busy?: boolean; disabled?: boolean;
  type?: "button" | "submit"; onClick?: () => void; title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      title={title}
      className="inline-flex items-center gap-2 rounded-md bg-[#D97757] text-white text-sm font-medium px-4 py-2 hover:bg-[#C15F3C] disabled:bg-[#D1D5DB] disabled:cursor-not-allowed"
    >
      <ClaudeMark className={busy ? "animate-spin" : ""} />
      {children}
    </button>
  );
}

/** "Adjust prompt" button + popover. Positive/negative steering is SAVED per
    `presetKey` in localStorage, so it is pre-loaded and applied in every project.
    Controlled by the parent (so the action can read it); when `asFormFields` is set
    it also emits hidden inputs (name="emphasize" / "avoid") for form actions. */
export function PromptTuner({
  emphasize, avoid, onEmphasize, onAvoid, presetKey, asFormFields = false,
}: {
  emphasize: string; avoid: string;
  onEmphasize: (v: string) => void; onAvoid: (v: string) => void;
  presetKey: string; asFormFields?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const storeKey = `cve-ai-tune:${presetKey}`;

  // Hydrate the saved preset once → the tuning carries over to every project.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const o = JSON.parse(raw);
        if (typeof o.emphasize === "string") onEmphasize(o.emphasize);
        if (typeof o.avoid === "string") onAvoid(o.avoid);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);

  const persist = (e: string, a: string) => {
    try { localStorage.setItem(storeKey, JSON.stringify({ emphasize: e, avoid: a })); } catch { /* ignore */ }
  };
  const setE = (v: string) => { onEmphasize(v); persist(v, avoid); };
  const setA = (v: string) => { onAvoid(v); persist(emphasize, v); };
  const clear = () => { onEmphasize(""); onAvoid(""); try { localStorage.removeItem(storeKey); } catch { /* ignore */ } };

  const active = !!(emphasize.trim() || avoid.trim());
  const ta = "w-full rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-sm leading-relaxed focus:border-[#1B4B43] focus:outline-none";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${active ? "border-[#D97757] text-[#9A3412] bg-[#FFF7ED]" : "border-[#E5E7EB] text-[#6B7280] hover:bg-[#F8F9FA]"}`}
        title="Steer this Claude action — saved and reused across projects"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
        Adjust prompt
        {active && <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-1.5 z-20 w-[30rem] max-w-[92vw] rounded-lg border border-[#E5E7EB] bg-white shadow-xl p-3.5 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-[#166534] mb-1">✓ Emphasize / include</span>
                <textarea value={emphasize} onChange={(e) => setE(e.target.value)} rows={3} placeholder="e.g. sea views, families, investment yield" className={ta} />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-[#991B1B] mb-1">✕ Avoid / exclude</span>
                <textarea value={avoid} onChange={(e) => setA(e.target.value)} rows={3} placeholder="e.g. don't mention price, avoid clichés" className={ta} />
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">Saved automatically — reused in every project.</span>
              <div className="flex gap-3">
                <button type="button" onClick={clear} className="text-xs text-[#6B7280] hover:text-[#DC2626]">Clear</button>
                <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-[#1B4B43] hover:underline">Done</button>
              </div>
            </div>
          </div>
        </>
      )}
      {asFormFields && (
        <>
          <input type="hidden" name="emphasize" value={emphasize} />
          <input type="hidden" name="avoid" value={avoid} />
        </>
      )}
    </div>
  );
}
