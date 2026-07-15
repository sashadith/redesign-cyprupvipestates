"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadUnitImages, setUnitPhotos, applyPhotosToIdentical, scheduleUploadsRestartAction } from "./actions";

const thumb = (u: string) => u.replace(/_medium\.webp$/, "_small.webp");
const large = (u: string) => u.replace(/_medium\.webp$/, "_large.webp");

// Controlled: photos live in the parent unit's own state (UnitsEditor), so
// "Save unit" persists them together with every other field — no separate
// "Save photos" button. Upload still writes files immediately (has to), but the
// resulting URLs flow straight into the parent's state via onChange, same as
// any other edited field.
export default function UnitImages({ unitId, photos, onChange }: { unitId: string; photos: string[]; onChange: (photos: string[]) => void }) {
  const [busy, setBusy] = useState<null | "upload" | "apply">(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState("");
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  const router = useRouter();

  // Wrap-around prev/next through `photos`, plus keyboard support (←/→/Esc) —
  // same shape as GalleryManager/FloorPlansManager.
  const zoomBy = (dir: -1 | 1) => setZoomIdx((i) => (i == null ? i : (i + dir + photos.length) % photos.length));
  useEffect(() => {
    if (zoomIdx == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") zoomBy(-1);
      else if (e.key === "ArrowRight") zoomBy(1);
      else if (e.key === "Escape") setZoomIdx(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomIdx, photos.length]);

  const remove = (u: string) => { onChange(photos.filter((x) => x !== u)); setMsg(""); };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const a = [...photos];
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
    setMsg("");
  };
  const drop = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); return; }
    const a = [...photos];
    const [m] = a.splice(dragIdx, 1);
    a.splice(i, 0, m);
    setDragIdx(null);
    onChange(a);
    setMsg("");
  };

  // One file per server-action call — see GalleryManager.tsx for why (bundling
  // many high-res photos in one request exceeds the server-action body-size
  // limit and crashes the whole batch instead of failing gracefully).
  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload");
    setMsg("");
    const list = Array.from(files);
    const newUrls: string[] = [];
    const failed: string[] = [];
    for (let i = 0; i < list.length; i++) {
      setProgress(`Uploading ${i + 1} of ${list.length}…`);
      try {
        const fd = new FormData();
        fd.append("images", list[i]);
        const urls = await uploadUnitImages(unitId, fd);
        if (urls.length) newUrls.push(...urls); else failed.push(list[i].name);
      } catch {
        failed.push(list[i].name);
      }
    }
    setProgress("");
    if (newUrls.length) {
      onChange(Array.from(new Set([...photos, ...newUrls])));
      await scheduleUploadsRestartAction();
    }
    setBusy(null);
    if (newUrls.length) {
      setMsg(
        `Uploaded ${newUrls.length}${failed.length ? ` (${failed.length} failed: ${failed.join(", ")})` : ""} — server restarting to pick up new files (~10s). Reload if an image looks broken. Click "Save unit" below to keep them.`,
      );
    } else if (failed.length) {
      setMsg(`Upload failed for: ${failed.join(", ")}`);
    }
  }
  // Applying to identical units reads from the DB, so this specific action still
  // needs to persist first — unlike everything else here, which just waits for
  // "Save unit".
  async function applyIdentical() {
    setBusy("apply");
    await setUnitPhotos(unitId, photos);
    const n = await applyPhotosToIdentical(unitId);
    setBusy(null);
    setMsg(n > 0 ? `Copied to ${n} identical unit${n === 1 ? "" : "s"}` : "No identical units found");
    router.refresh();
  }

  return (
    <div className="bg-[#F8F9FA] border-t border-[#E5E7EB] p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-[#6B7280]">{photos.length} photo{photos.length === 1 ? "" : "s"} · first = cover · drag or use arrows</div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-[#166534]">{msg}</span>}
          <label className="rounded-md border border-[#E5E7EB] bg-white text-sm px-3 py-1.5 hover:bg-[#F8F9FA] cursor-pointer">
            {busy === "upload" ? (progress || "Uploading…") : "+ Upload"}
            <input type="file" multiple accept="image/*" className="hidden" disabled={busy !== null} onChange={(e) => onUpload(e.target.files)} />
          </label>
          <button onClick={applyIdentical} disabled={busy !== null || photos.length === 0} className="rounded-md border border-[#E5E7EB] bg-white text-sm px-3 py-1.5 hover:bg-[#F8F9FA] disabled:opacity-50">
            {busy === "apply" ? "Applying…" : "Apply to identical units"}
          </button>
        </div>
      </div>

      {photos.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#9CA3AF]">No photos for this unit yet. Upload some or copy from an identical unit.</p>
      ) : (
        <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
          {photos.map((u, i) => (
            <div
              key={u}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(i)}
              className={`group relative aspect-[4/3] rounded overflow-hidden border-2 bg-[#EEF0F1] ${i === 0 ? "border-[#1B4B43]" : "border-transparent"} ${dragIdx === i ? "opacity-40" : ""}`}
              style={{ backgroundImage: `url(${thumb(u)})`, backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}
            >
              {i === 0 && <span className="absolute top-0.5 left-0.5 bg-[#1B4B43] text-white text-[9px] px-1 rounded">COVER</span>}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent pt-4 pb-1 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                <button type="button" title="Move left" onClick={() => move(i, -1)} className="bg-white/90 hover:bg-white rounded w-5 h-5 text-xs leading-none">‹</button>
                <button type="button" title="Enlarge" onClick={() => setZoomIdx(i)} className="bg-white/90 hover:bg-white rounded w-5 h-5 text-xs leading-none">⤢</button>
                <button type="button" title="Delete" onClick={() => remove(u)} className="bg-white/90 text-[#DC2626] rounded w-5 h-5 text-xs leading-none">×</button>
                <button type="button" title="Move right" onClick={() => move(i, 1)} className="bg-white/90 rounded w-5 h-5 text-xs leading-none">›</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {zoomIdx != null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setZoomIdx(null)} role="dialog" aria-modal="true">
          <img src={large(photos[zoomIdx])} alt="" className="max-w-full max-h-full object-contain rounded shadow-2xl" onClick={(e) => e.stopPropagation()} />
          {photos.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); zoomBy(-1); }} title="Previous (←)" className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 text-xl leading-none">‹</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); zoomBy(1); }} title="Next (→)" className="absolute right-16 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 text-xl leading-none">›</button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs bg-black/40 rounded-full px-2.5 py-1">{zoomIdx + 1} / {photos.length}</span>
            </>
          )}
          <button type="button" onClick={() => setZoomIdx(null)} title="Close (Esc)" className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full w-9 h-9 text-xl leading-none">×</button>
        </div>
      )}
    </div>
  );
}
