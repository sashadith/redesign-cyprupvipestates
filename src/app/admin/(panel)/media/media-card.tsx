"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setMediaFolder } from "../../actions";

export default function MediaCard({ m }: { m: any }) {
  const router = useRouter();
  const [val, setVal] = useState<string>(m.folder ?? "");
  const [saving, setSaving] = useState(false);
  const kb = m.fileSize ? `${Math.round(m.fileSize / 1024)} KB` : "—";

  async function commit() {
    if (val.trim() === (m.folder ?? "")) return;
    setSaving(true);
    try { await setMediaFolder(m.id, val); router.refresh(); } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
      <div className="aspect-square bg-[#F8F9FA] flex items-center justify-center overflow-hidden">
        {m.mimeType?.startsWith("image/")
          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.altText ?? m.originalFilename ?? ""} loading="lazy" className="w-full h-full object-cover" />
          : <span className="text-xs text-[#6B7280] p-2 break-all">{m.mimeType}</span>}
      </div>
      <div className="p-2 space-y-1">
        <div className="text-[11px] text-[#111827] truncate" title={m.originalFilename ?? m.filename}>{m.originalFilename ?? m.filename}</div>
        <div className="text-[11px] text-[#9CA3AF]">{m.width && m.height ? `${m.width}×${m.height} · ` : ""}{kb}</div>
        <div className="flex items-center gap-1">
          <input
            list="media-folders"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            placeholder="Folder…"
            className="w-full rounded border border-[#E5E7EB] px-1.5 py-0.5 text-[11px] outline-none focus:border-[#1B4B43]"
          />
          {saving && <span className="text-[10px] text-[#6B7280]">…</span>}
        </div>
      </div>
    </div>
  );
}
