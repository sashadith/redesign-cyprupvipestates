"use client";
import { useState } from "react";
import { refToLocalUrl } from "@/lib/sanityRefs";

type ImageObj = { _type: "image"; alt?: string; asset: { _ref: string; _type: "reference" } } | null;

function normalize(initial: any): ImageObj {
  const ref = initial?.asset?._ref ?? initial?.asset?._id;
  return ref ? { _type: "image", alt: initial.alt ?? "", asset: { _ref: ref, _type: "reference" } } : null;
}

export default function ImagePicker({ name, initial, label }: { name: string; initial: any; label: string }) {
  const [img, setImg] = useState<ImageObj>(() => normalize(initial));
  const [busy, setBusy] = useState(false);
  const url = img?.asset?._ref ? refToLocalUrl(img.asset._ref) : null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ref) setImg({ _type: "image", alt: img?.alt ?? f.name, asset: { _ref: j.ref, _type: "reference" } });
    } finally { setBusy(false); e.target.value = ""; }
  }

  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <div className="w-28 h-20 rounded border border-[#E5E7EB] bg-[#F8F9FA] flex items-center justify-center overflow-hidden shrink-0">
          {url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt="" className="w-full h-full object-cover" /> : <span className="text-[11px] text-[#9CA3AF]">none</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} disabled={busy}
            className="text-xs file:mr-2 file:rounded file:border-0 file:bg-[#1B4B43] file:text-white file:px-3 file:py-1.5 file:text-xs hover:file:bg-[#142E2D] file:cursor-pointer" />
          {busy && <span className="text-xs text-[#6B7280]">Uploading…</span>}
          {img && (
            <input value={img.alt ?? ""} onChange={(e) => setImg({ ...img, alt: e.target.value })}
              placeholder="Alt text"
              className="w-64 max-w-full rounded border border-[#E5E7EB] px-2 py-1 text-xs outline-none focus:border-[#1B4B43]" />
          )}
          {img && <button type="button" onClick={() => setImg(null)} className="text-xs text-[#C0392B] text-left">Remove image</button>}
        </div>
      </div>
      <input type="hidden" name={name} value={img ? JSON.stringify(img) : ""} />
    </div>
  );
}
