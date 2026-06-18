"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function MediaUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) router.refresh();
      else setErr(j.error || "Upload failed");
    } catch {
      setErr("Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onChange} disabled={busy}
        className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#1B4B43] file:text-white file:px-4 file:py-2 file:text-sm hover:file:bg-[#142E2D] file:cursor-pointer" />
      {busy && <span className="text-sm text-[#6B7280]">Uploading…</span>}
      {err && <span className="text-sm text-[#C0392B]">{err}</span>}
    </div>
  );
}
