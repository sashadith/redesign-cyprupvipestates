"use client";

import { useState } from "react";

/* Uploads immediately on file select (via /api/admin/upload, mode=avatar|photoPng
   — see that route for the two processing recipes) and stores the resulting URL
   in a hidden input, so the surrounding <form> just submits a plain string like
   any other field. Used by both the ADMIN user-edit form and the self-service
   /admin/account page. */
export default function PhotoUploadField({
  name, label, mode, accept, initialUrl, shape,
}: {
  name: string;
  label: string;
  mode: "avatar" | "photoPng";
  accept: string;
  initialUrl: string | null;
  shape: "square" | "tall";
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUrl(data.url);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-[#6B7280] mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <div className={`shrink-0 bg-[#F3F4F6] overflow-hidden flex items-center justify-center border border-[#E5E7EB] ${shape === "square" ? "w-16 h-16 rounded-full" : "w-16 h-24 rounded-md"}`}>
          {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] text-[#9CA3AF] text-center px-1">No photo</span>}
        </div>
        <div className="min-w-0">
          <input type="file" accept={accept} onChange={handleFile} disabled={uploading} className="text-xs w-full" />
          {uploading && <p className="text-xs text-[#9CA3AF] mt-1">Uploading…</p>}
          {error && <p className="text-xs text-[#DC2626] mt-1">{error}</p>}
          {url && !uploading && (
            <button type="button" onClick={() => setUrl("")} className="text-xs text-[#DC2626] hover:underline mt-1">
              Remove photo
            </button>
          )}
        </div>
      </div>
      <input type="hidden" name={name} value={url} />
    </div>
  );
}
