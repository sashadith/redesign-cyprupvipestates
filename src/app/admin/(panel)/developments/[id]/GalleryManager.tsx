"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDevImages, saveGallery, scheduleUploadsRestartAction } from "./actions";
import SyncWithDriveButton from "./SyncWithDriveButton";

const thumb = (u: string) => u.replace(/_medium\.webp$/, "_small.webp");
const large = (u: string) => u.replace(/_medium\.webp$/, "_large.webp");

export default function GalleryManager({ developmentId, initial, initialHero, isDriveSynced }: { developmentId: string; initial: string[]; initialHero: string; isDriveSynced?: boolean }) {
  const [images, setImages] = useState<string[]>(initial);
  const [hero, setHero] = useState<string>(initialHero || initial[0] || "");
  const [busy, setBusy] = useState<null | "upload" | "save">(null);
  const [dirty, setDirty] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState("");
  const router = useRouter();

  // Wrap-around prev/next through `images`, and keyboard support while the
  // lightbox is open (←/→ to browse, Esc to close) — same shape as
  // FloorPlansManager/UnitImages so all three admin lightboxes behave alike.
  const zoomBy = (dir: -1 | 1) => setZoomIdx((i) => (i == null ? i : (i + dir + images.length) % images.length));
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
  }, [zoomIdx, images.length]);

  const remove = (u: string) => {
    setImages((imgs) => imgs.filter((x) => x !== u));
    if (hero === u) setHero("");
    setDirty(true);
  };
  const setAsHero = (u: string) => { setHero(u); setDirty(true); };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    setImages((imgs) => { const a = [...imgs]; [a[i], a[j]] = [a[j], a[i]]; return a; });
    setDirty(true);
  };

  function drop(i: number) {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); return; }
    setImages((imgs) => {
      const arr = [...imgs];
      const [m] = arr.splice(dragIdx, 1);
      arr.splice(i, 0, m);
      return arr;
    });
    setDragIdx(null);
    setDirty(true);
  }

  // One file per server-action call — a single request bundling many
  // high-res photos (10 files × ~13MB happened in practice) blows past the
  // server-action body-size limit and the whole batch fails as an uncaught
  // client-side exception. Uploading sequentially also keeps the single-core
  // image conversion (sharp) from being hit with N files at once.
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
        const urls = await uploadDevImages(developmentId, fd);
        if (urls.length) newUrls.push(...urls); else failed.push(list[i].name);
      } catch {
        failed.push(list[i].name);
      }
    }
    setProgress("");
    if (newUrls.length) {
      setImages((imgs) => Array.from(new Set([...imgs, ...newUrls])));
      setDirty(true);
      await scheduleUploadsRestartAction();
    }
    setBusy(null);
    if (newUrls.length) {
      setMsg(
        `Uploaded ${newUrls.length}${failed.length ? ` (${failed.length} failed: ${failed.join(", ")})` : ""} — the server is restarting to pick up the new files, this can take ~10 seconds. Reload the page after a moment if any image looks broken.`,
      );
    } else if (failed.length) {
      setMsg(`Upload failed for: ${failed.join(", ")}`);
    }
  }

  async function save() {
    setBusy("save");
    await saveGallery(developmentId, images, hero || images[0] || null);
    setBusy(null);
    setDirty(false);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB]">
      <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold text-[#111827]">
          Images <span className="font-normal text-[#9CA3AF]">({images.length}) · drag to reorder · ★ = hero</span>
        </div>
        <div className="flex items-center gap-2">
          {isDriveSynced && <SyncWithDriveButton developmentId={developmentId} />}
          <label className="rounded-md border border-[#E5E7EB] text-sm px-3 py-1.5 hover:bg-[#F8F9FA] cursor-pointer">
            {busy === "upload" ? (progress || "Uploading…") : "+ Upload"}
            <input type="file" multiple accept="image/*" className="hidden" disabled={busy !== null} onChange={(e) => onUpload(e.target.files)} />
          </label>
          <button onClick={save} disabled={busy !== null || !dirty} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-1.5 hover:bg-[#142E2D] disabled:bg-[#D1D5DB] disabled:cursor-not-allowed">
            {busy === "save" ? "Saving…" : "Save images"}
          </button>
        </div>
      </div>
      {msg && <div className="px-5 py-2 text-xs text-[#92400E] bg-[#FFFBEB] border-b border-[#FCD34D]">{msg}</div>}

      <div className="p-4">
        {images.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#9CA3AF]">No images. Upload some, or they will appear after the feed image mirror runs.</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {images.map((u, i) => (
              <div
                key={u}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(i)}
                className={`group relative aspect-[4/3] rounded overflow-hidden border-2 cursor-move ${hero === u ? "border-[#1B4B43]" : "border-transparent"} ${dragIdx === i ? "opacity-40" : ""}`}
              >
                <img src={thumb(u)} alt="" className="w-full h-full object-cover" loading="lazy" />
                {hero === u && <span className="absolute top-1 left-1 bg-[#1B4B43] text-white text-[10px] px-1.5 py-0.5 rounded">HERO</span>}
                {/* navigation bar anchored to the bottom of the image */}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-1 pb-1.5 pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" title="Move left" onClick={() => move(i, -1)} className="bg-white/90 hover:bg-white rounded w-6 h-6 text-sm leading-none">‹</button>
                  <button type="button" title="Set as hero" onClick={() => setAsHero(u)} className="bg-white/90 hover:bg-white rounded w-6 h-6 text-sm leading-none">★</button>
                  <button type="button" title="Enlarge" onClick={() => setZoomIdx(i)} className="bg-white/90 hover:bg-white rounded w-6 h-6 text-xs leading-none">⤢</button>
                  <button type="button" title="Delete" onClick={() => remove(u)} className="bg-white/90 hover:bg-white text-[#DC2626] rounded w-6 h-6 text-sm leading-none">×</button>
                  <button type="button" title="Move right" onClick={() => move(i, 1)} className="bg-white/90 hover:bg-white rounded w-6 h-6 text-sm leading-none">›</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {zoomIdx != null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setZoomIdx(null)} role="dialog" aria-modal="true">
          <img src={large(images[zoomIdx])} alt="" className="max-w-full max-h-full object-contain rounded shadow-2xl" onClick={(e) => e.stopPropagation()} />
          {images.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); zoomBy(-1); }} title="Previous (←)" className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 text-xl leading-none">‹</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); zoomBy(1); }} title="Next (→)" className="absolute right-16 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 text-xl leading-none">›</button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs bg-black/40 rounded-full px-2.5 py-1">{zoomIdx + 1} / {images.length}</span>
            </>
          )}
          <button type="button" onClick={() => setZoomIdx(null)} title="Close (Esc)" className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full w-9 h-9 text-xl leading-none">×</button>
        </div>
      )}
    </div>
  );
}
