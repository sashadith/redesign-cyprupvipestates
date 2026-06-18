"use client";
import { useState } from "react";
import { refToLocalUrl } from "@/lib/sanityRefs";

type Img = { _key?: string; _type: "image"; alt?: string; asset: { _ref: string; _type: "reference" } };

let kc = 0;
const k = () => `img-${Date.now().toString(36)}-${kc++}`;

function normalize(initial: any): Img[] {
  if (!Array.isArray(initial)) return [];
  return initial
    .map((it) => {
      const ref = it?.asset?._ref ?? it?.asset?._id;
      return ref ? { _key: it._key ?? k(), _type: "image" as const, alt: it.alt ?? "", asset: { _ref: ref, _type: "reference" as const } } : null;
    })
    .filter(Boolean) as Img[];
}

export default function GalleryPicker({ name, initial, label }: { name: string; initial: any; label: string }) {
  const [imgs, setImgs] = useState<Img[]>(() => normalize(initial));
  const [busy, setBusy] = useState(false);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files) {
        const fd = new FormData(); fd.append("file", f);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j.ref) setImgs((prev) => [...prev, { _key: k(), _type: "image", alt: f.name, asset: { _ref: j.ref, _type: "reference" } }]);
      }
    } finally { setBusy(false); e.target.value = ""; }
  }
  const remove = (i: number) => setImgs((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i: number, d: -1 | 1) => setImgs((prev) => { const a = [...prev]; const j = i + d; if (j < 0 || j >= a.length) return prev; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const setAlt = (i: number, alt: string) => setImgs((prev) => prev.map((im, idx) => (idx === i ? { ...im, alt } : im)));

  return (
    <div>
      <label className="block text-sm mb-1">{label} <span className="text-[#9CA3AF]">({imgs.length})</span></label>
      <p className="text-xs text-[#6B7280] mb-2">Add a short alt text for each image (describes it for search engines and screen readers).</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-2">
        {imgs.map((im, i) => {
          const url = refToLocalUrl(im.asset._ref);
          return (
            <div key={im._key} className="border border-[#E5E7EB] rounded overflow-hidden bg-[#F8F9FA]">
              <div className="relative group aspect-square">
                {url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt="" className="w-full h-full object-cover" />}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 text-white text-[10px]">
                  <button type="button" onClick={() => move(i, -1)} className="px-1">←</button>
                  <button type="button" onClick={() => remove(i)} className="px-1 text-red-300">✕</button>
                  <button type="button" onClick={() => move(i, 1)} className="px-1">→</button>
                </div>
              </div>
              <input value={im.alt ?? ""} onChange={(e) => setAlt(i, e.target.value)} placeholder="Alt text"
                className="w-full border-t border-[#E5E7EB] px-1.5 py-1 text-[11px] outline-none focus:bg-[#F0FDF9]" />
            </div>
          );
        })}
      </div>
      <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFiles} disabled={busy}
        className="text-xs file:mr-2 file:rounded file:border-0 file:bg-[#1B4B43] file:text-white file:px-3 file:py-1.5 file:text-xs hover:file:bg-[#142E2D] file:cursor-pointer" />
      {busy && <span className="text-xs text-[#6B7280] ml-2">Uploading…</span>}
      <input type="hidden" name={name} value={JSON.stringify(imgs)} />
    </div>
  );
}
