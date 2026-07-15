"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDevPlans, savePlans, scheduleUploadsRestartAction } from "./actions";
import SyncWithDriveButton from "./SyncWithDriveButton";

const thumb = (u: string) => u.replace(/_medium\.webp$/, "_small.webp");
const large = (u: string) => u.replace(/_medium\.webp$/, "_large.webp");
const isPdf = (u: string) => /\.pdf(\?|$)/i.test(u);
const nameOf = (u: string) => decodeURIComponent(u.split("/").pop() || "plan.pdf");

// Floor plans (development.plans). Drive sync + upload both convert PDFs to JPEG
// pages automatically, so this is mostly a grid of images; any older/unconverted
// PDF still shows as a badge+link fallback. Mirrors GalleryManager's grid pattern.
export default function FloorPlansManager({ developmentId, initial, isDriveSynced }: { developmentId: string; initial: string[]; isDriveSynced?: boolean }) {
  const [plans, setPlans] = useState<string[]>(initial);
  const [busy, setBusy] = useState<null | "upload" | "save">(null);
  const [dirty, setDirty] = useState(false);
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const router = useRouter();

  // Prev/next among the VIEWABLE (non-PDF) plans only — PDFs have no ⤢ button
  // to begin with, so skip them when browsing instead of landing on a broken
  // image. Wrap-around + keyboard support (←/→/Esc), same shape as GalleryManager/UnitImages.
  const viewable = plans.map((u, i) => ({ u, i })).filter((x) => !isPdf(x.u));
  const zoomPos = zoomIdx == null ? -1 : viewable.findIndex((v) => v.i === zoomIdx);
  const zoomBy = (dir: -1 | 1) => setZoomIdx((i) => {
    if (i == null || viewable.length === 0) return i;
    const pos = viewable.findIndex((v) => v.i === i);
    return viewable[(pos + dir + viewable.length) % viewable.length].i;
  });
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
  }, [zoomIdx, plans]);

  const remove = (u: string) => { setPlans((p) => p.filter((x) => x !== u)); setDirty(true); };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= plans.length) return;
    setPlans((p) => { const a = [...p]; [a[i], a[j]] = [a[j], a[i]]; return a; });
    setDirty(true);
  };
  const drop = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); return; }
    setPlans((p) => {
      const a = [...p];
      const [m] = a.splice(dragIdx, 1);
      a.splice(i, 0, m);
      return a;
    });
    setDragIdx(null);
    setDirty(true);
  };

  // One file per server-action call — see GalleryManager.tsx for why (bundling
  // many high-res photos/PDFs in one request exceeds the server-action
  // body-size limit and crashes the whole batch instead of failing gracefully).
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
        fd.append("plans", list[i]);
        const urls = await uploadDevPlans(developmentId, fd);
        if (urls.length) newUrls.push(...urls); else failed.push(list[i].name);
      } catch {
        failed.push(list[i].name);
      }
    }
    setProgress("");
    if (newUrls.length) {
      setPlans((p) => Array.from(new Set([...p, ...newUrls])));
      setDirty(true);
      // New files trigger a server restart so Next.js picks them up (it only
      // reads public/ at startup) — they can 404/blank out for a few seconds
      // until that finishes. Not a bug; just needs a moment.
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
    await savePlans(developmentId, plans);
    setBusy(null);
    setDirty(false);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB]">
      <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold text-[#111827]">
          Floor plans <span className="font-normal text-[#9CA3AF]">({plans.length}) · PDFs auto-converted to images</span>
        </div>
        <div className="flex items-center gap-2">
          {isDriveSynced && <SyncWithDriveButton developmentId={developmentId} />}
          <label className="rounded-md border border-[#E5E7EB] text-sm px-3 py-1.5 hover:bg-[#F8F9FA] cursor-pointer">
            {busy === "upload" ? (progress || "Uploading…") : "+ Upload"}
            <input type="file" multiple accept="application/pdf,.pdf,image/*" className="hidden" disabled={busy !== null} onChange={(e) => onUpload(e.target.files)} />
          </label>
          <button onClick={save} disabled={busy !== null || !dirty} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-1.5 hover:bg-[#142E2D] disabled:bg-[#D1D5DB] disabled:cursor-not-allowed">
            {busy === "save" ? "Saving…" : "Save floor plans"}
          </button>
        </div>
      </div>
      {msg && <div className="px-5 py-2 text-xs text-[#92400E] bg-[#FFFBEB] border-b border-[#FCD34D]">{msg}</div>}

      <div className="p-4">
        {plans.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#9CA3AF]">No floor plans. Upload images or PDFs, or they will appear after the Drive sync collects them.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {plans.map((u, i) => (
              <div
                key={u}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(i)}
                className={`group relative aspect-[4/3] rounded overflow-hidden border border-[#E5E7EB] bg-[#F8F9FA] ${dragIdx === i ? "opacity-40" : ""}`}
              >
                {isPdf(u) ? (
                  <a href={u} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-1.5 h-full text-center px-2 text-[#6B7280] hover:text-[#1B4B43]">
                    <span className="text-[#B91C1C] text-[10px] font-bold tracking-wide border border-[#FECACA] bg-[#FEF2F2] rounded px-1.5 py-0.5">PDF</span>
                    <span className="text-xs truncate w-full">{nameOf(u)}</span>
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb(u)} alt={`Plan ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-1 pb-1.5 pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" title="Move left" onClick={() => move(i, -1)} className="bg-white/90 hover:bg-white rounded w-6 h-6 text-sm leading-none">‹</button>
                  {!isPdf(u) && <button type="button" title="Enlarge" onClick={() => setZoomIdx(i)} className="bg-white/90 hover:bg-white rounded w-6 h-6 text-xs leading-none">⤢</button>}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={large(plans[zoomIdx])} alt="" className="max-w-full max-h-full object-contain rounded shadow-2xl" onClick={(e) => e.stopPropagation()} />
          {viewable.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); zoomBy(-1); }} title="Previous (←)" className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 text-xl leading-none">‹</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); zoomBy(1); }} title="Next (→)" className="absolute right-16 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 text-xl leading-none">›</button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs bg-black/40 rounded-full px-2.5 py-1">{zoomPos + 1} / {viewable.length}</span>
            </>
          )}
          <button type="button" onClick={() => setZoomIdx(null)} title="Close (Esc)" className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full w-9 h-9 text-xl leading-none">×</button>
        </div>
      )}
    </div>
  );
}
