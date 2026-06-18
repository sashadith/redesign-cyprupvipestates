"use client";
import { useState } from "react";
import { refToLocalUrl } from "@/lib/sanityRefs";
import { portableTextToHtml } from "@/lib/portableText/ptToHtml.mjs";
import RichTextField from "../RichTextField";
import { findRichFields, getAtPath, setAtPath, isHtmlMarker } from "@/lib/portableText/richText";

// Structured editors for non-rich fields (alignment, table cells, images, FAQ
// questions). ALL rich-text fields — anywhere in any block — go through the same
// RichTextField (TipTap) as page descriptions; editing replaces the field with an
// `{__html}` marker that the save action converts via the shared htmlToPortableText.

let kc = 0;
const k = () => `k-${Date.now().toString(36)}-${kc++}`;
const input = "w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm outline-none focus:border-[#1B4B43]";

const richInitialHtml = (v: any): string => (isHtmlMarker(v) ? v.__html : portableTextToHtml(Array.isArray(v) ? v : []));
const clone = (o: any) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

function ImageField({ refValue, alt, onChange }: { refValue?: string; alt?: string; onChange: (v: { ref?: string; alt?: string }) => void }) {
  const [busy, setBusy] = useState(false);
  const url = refValue ? refToLocalUrl(refValue) : null;
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ref) onChange({ ref: j.ref, alt });
    } finally { setBusy(false); e.target.value = ""; }
  }
  return (
    <div className="flex items-start gap-3">
      <div className="w-24 h-16 rounded border border-[#E5E7EB] bg-[#F8F9FA] overflow-hidden shrink-0 flex items-center justify-center">
        {url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-[#9CA3AF]">none</span>}
      </div>
      <div className="flex-1 space-y-1.5">
        <input type="file" accept="image/*" onChange={upload} disabled={busy}
          className="text-xs file:mr-2 file:rounded file:border-0 file:bg-[#1B4B43] file:text-white file:px-2 file:py-1 file:text-xs" />
        <input value={alt ?? ""} onChange={(e) => onChange({ ref: refValue, alt: e.target.value })} placeholder="Alt text" className={input} />
      </div>
    </div>
  );
}

function RichField({ label, value, onChange }: { label: string; value: any; onChange: (html: string) => void }) {
  return (
    <div>
      <div className="text-xs font-medium text-[#6B7280] mb-1">{label}</div>
      <RichTextField initialHtml={richInitialHtml(value)} onChange={onChange} />
    </div>
  );
}

export default function BlockFieldEditor({ block, onChange }: { block: any; onChange: (b: any) => void }) {
  const type = block?._type;
  const set = (patch: any) => onChange({ ...block, ...patch });
  // Replace a rich field (by path) with an {__html} marker, immutably.
  const setRich = (path: string, html: string) => { const next = clone(block); setAtPath(next, path, { __html: html }); onChange(next); };

  if (type === "buttonBlock") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 text-xs text-[#6B7280]">Button text
          <input className={input} value={block.buttonText ?? ""} onChange={(e) => set({ buttonText: e.target.value })} />
        </label>
        <label className="text-xs text-[#6B7280]">Align
          <select className={input} value={block.alignItems ?? "center"} onChange={(e) => set({ alignItems: e.target.value })}>
            {["flex-start", "center", "flex-end"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="text-xs text-[#6B7280]">Justify
          <select className={input} value={block.justifyContent ?? "center"} onChange={(e) => set({ justifyContent: e.target.value })}>
            {["flex-start", "center", "flex-end"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
    );
  }

  if (type === "imageFullBlock") {
    const pic = block.imageMain?.picture ?? {};
    const setPicture = (v: { ref?: string; alt?: string }) =>
      set({ imageMain: { ...(block.imageMain ?? {}), picture: { ...pic, _type: "image", alt: v.alt, asset: v.ref ? { _type: "reference", _ref: v.ref } : pic.asset } } });
    return (
      <div className="space-y-2">
        <ImageField refValue={pic.asset?._ref} alt={pic.alt} onChange={setPicture} />
        <label className="text-xs text-[#6B7280] block">Aspect ratio
          <input className={input} value={block.imageMain?.aspectRatio ?? ""} placeholder="e.g. 10:5"
            onChange={(e) => set({ imageMain: { ...(block.imageMain ?? {}), aspectRatio: e.target.value } })} />
        </label>
      </div>
    );
  }

  if (type === "tableBlock") {
    const columns: string[] = block.columns ?? [];
    const rows: any[] = block.rows ?? [];
    const setCols = (c: string[]) => set({ columns: c });
    const setRows = (r: any[]) => set({ rows: r });
    return (
      <div className="space-y-2 overflow-x-auto">
        <div className="flex gap-1">
          {columns.map((c, ci) => (
            <input key={ci} className={`${input} min-w-28`} value={c} placeholder={`Col ${ci + 1}`}
              onChange={(e) => setCols(columns.map((x, j) => (j === ci ? e.target.value : x)))} />
          ))}
          <button type="button" onClick={() => { setCols([...columns, ""]); setRows(rows.map((r) => ({ ...r, cells: [...(r.cells || []), ""] }))); }}
            className="text-xs text-[#1B4B43] px-2 shrink-0">+col</button>
        </div>
        {rows.map((r, ri) => (
          <div key={r._key ?? ri} className="flex gap-1">
            {(r.cells || []).map((cell: string, ci: number) => (
              <input key={ci} className={`${input} min-w-28`} value={cell}
                onChange={(e) => setRows(rows.map((x, j) => (j === ri ? { ...x, cells: x.cells.map((cc: string, k2: number) => (k2 === ci ? e.target.value : cc)) } : x)))} />
            ))}
            <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== ri))} className="text-xs text-[#C0392B] px-2 shrink-0">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setRows([...rows, { _key: k(), _type: "tableRow", cells: columns.map(() => "") }])}
          className="text-xs text-[#1B4B43] hover:underline">+ Add row</button>
      </div>
    );
  }

  // FAQ / accordion: question (text) + answer (unified RichTextField).
  if (type === "faqBlock" || type === "landingFaqBlock" || type === "accordionBlock") {
    const itemsPath = block.faq ? "faq.items" : "items";
    const items: any[] = getAtPath(block, itemsPath) ?? [];
    const writeItems = (next: any[]) => { const b = clone(block); setAtPath(b, itemsPath, next); onChange(b); };
    return (
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={it._key ?? i} className="border border-[#E5E7EB] rounded p-2 space-y-2">
            <div className="flex gap-2">
              <input className={input} value={it.question ?? ""} placeholder="Question"
                onChange={(e) => writeItems(items.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
              <button type="button" onClick={() => writeItems(items.filter((_, j) => j !== i))} className="text-xs text-[#C0392B] px-2">✕</button>
            </div>
            <RichField label="Answer" value={it.answer} onChange={(html) => setRich(`${itemsPath}.${i}.answer`, html)} />
          </div>
        ))}
        <button type="button" onClick={() => writeItems([...items, { _key: k(), question: "", answer: [] }])}
          className="text-xs text-[#1B4B43] hover:underline">+ Add question</button>
      </div>
    );
  }

  // Generic: a unified RichTextField for every Portable Text field found in the
  // block, plus a JSON fallback for the remaining (non-rich) structure.
  const rich = findRichFields(block);
  return (
    <div className="space-y-3">
      {rich.map((f) => (
        <RichField key={f.path} label={f.label} value={getAtPath(block, f.path)} onChange={(html) => setRich(f.path, html)} />
      ))}
      <JsonFallback block={block} onChange={onChange} hasRich={rich.length > 0} />
    </div>
  );
}

function JsonFallback({ block, onChange, hasRich }: { block: any; onChange: (b: any) => void; hasRich: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(block, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-[11px] text-[#9CA3AF] hover:text-[#6B7280]">
        {open ? "▾" : "▸"} {hasRich ? "Other fields" : "Block fields"} (advanced JSON)
      </button>
      {open && (
        <>
          <textarea
            className="mt-1 w-full font-mono text-[11px] rounded-md border border-[#E5E7EB] px-2 py-1.5 outline-none focus:border-[#1B4B43]"
            rows={8}
            value={text}
            onChange={(e) => { setText(e.target.value); try { onChange(JSON.parse(e.target.value)); setErr(null); } catch { setErr("Invalid JSON — not saved until fixed"); } }}
          />
          {err && <p className="text-[11px] text-[#C0392B]">{err}</p>}
        </>
      )}
    </div>
  );
}
