"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveUnits } from "./actions";
import { PROPERTY_TYPES } from "@/lib/propertyTypes";
import UnitDetail from "./UnitDetail";
import SyncWithDriveButton from "./SyncWithDriveButton";

export type UnitRow = {
  id?: string;
  label: string;
  type: string;
  beds: string;
  baths: string;
  areaBuilt: string;
  areaInternal: string;
  areaPlot: string;
  areaVeranda: string;
  areaVerandaOpen: string;
  floor: string;
  unitNumber: string;
  storage: string;
  guestWc: string;
  orientation: string;
  price: string;
  status: string;
  amenities: string[];
  photos: string[];
  attrs: { name: string; value: string }[];
};

const blank = (): UnitRow => ({
  label: "", type: "", beds: "", baths: "", areaBuilt: "", areaInternal: "", areaPlot: "", areaVeranda: "", areaVerandaOpen: "",
  floor: "", unitNumber: "", storage: "", guestWc: "", orientation: "", price: "", status: "available", amenities: [], photos: [], attrs: [],
});

const cell = "w-full rounded-md border border-[#E5E7EB] bg-white hover:border-[#D1D5DB] focus:border-[#1B4B43] focus:ring-1 focus:ring-[#1B4B43]/20 focus:outline-none px-2 py-1.5 text-sm transition-colors";

export default function UnitsEditor({ developmentId, initial, isDriveSynced }: { developmentId: string; initial: UnitRow[]; isDriveSynced?: boolean }) {
  const [units, setUnits] = useState<UnitRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  // `initial` is a fresh array every server render, but useState() only reads it once
  // on mount — a "Sync with Drive" call refreshes the SERVER data (router.refresh())
  // yet this component's own state never picked it up, so the table looked unchanged
  // (or still empty) until a full page reload. Re-sync whenever there's no unsaved
  // local edit in progress, so a background sync's result actually shows up.
  useEffect(() => {
    if (!dirty) setUnits(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  const [openDetail, setOpenDetail] = useState<string | number | null>(null);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [bulkType, setBulkType] = useState("");
  const router = useRouter();

  const patch = (i: number, field: keyof UnitRow, val: any) => {
    setUnits((u) => u.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
    setDirty(true);
  };
  const remove = (i: number) => { setUnits((u) => u.filter((_, idx) => idx !== i)); setDirty(true); };
  const add = () => { setUnits((u) => [...u, blank()]); setDirty(true); };
  const applyTypeToAll = () => {
    if (!bulkType) return;
    setUnits((u) => u.map((r) => ({ ...r, type: bulkType })));
    setDirty(true);
  };
  const applyFeaturesToAll = (amenities: string[]) => {
    setUnits((u) => u.map((r) => ({ ...r, amenities: [...amenities] })));
    setDirty(true);
  };

  async function save() {
    setBusy(true);
    await saveUnits(developmentId, units);
    setBusy(false); setDirty(false);
    router.refresh();
  }

  const available = units.filter((u) => u.status === "available").length;
  // indices (not the rows themselves) so patch/remove/openDetail keep working on
  // the full `units` array while the table only shows a filtered subset
  const visibleIndices = units
    .map((_, i) => i)
    .filter((i) => !hideUnavailable || units[i].status === "available");
  const hiddenCount = units.length - visibleIndices.length;

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB]">
      <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold text-[#111827]">
          Units <span className="font-normal text-[#9CA3AF]">({units.length} · {available} available)</span>
        </div>
        <div className="flex items-center gap-2">
          {isDriveSynced && <SyncWithDriveButton developmentId={developmentId} mode="units" />}
          <button onClick={add} className="rounded-md border border-[#E5E7EB] text-sm px-3 py-1.5 hover:bg-[#F8F9FA]">+ Add unit</button>
          <button onClick={save} disabled={busy || !dirty} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-1.5 hover:bg-[#142E2D] disabled:bg-[#D1D5DB] disabled:cursor-not-allowed">
            {busy ? "Saving…" : "Save units"}
          </button>
        </div>
      </div>
      <div className="px-5 py-2.5 border-b border-[#E5E7EB] bg-[#F8F9FA] flex items-center flex-wrap gap-3 text-sm">
        <span className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide">Bulk</span>
        <select value={bulkType} onChange={(e) => setBulkType(e.target.value)} className={cell + " w-auto"}>
          <option value="">Set type…</option>
          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="button" onClick={applyTypeToAll} disabled={!bulkType} className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed">
          Apply to all units
        </button>
        <label className="flex items-center gap-1.5 ml-auto text-[#374151] cursor-pointer">
          <input type="checkbox" checked={hideUnavailable} onChange={(e) => setHideUnavailable(e.target.checked)} className="h-4 w-4 rounded border-[#D1D5DB] text-[#1B4B43] focus:ring-[#1B4B43]" />
          Hide sold/reserved{hiddenCount > 0 ? ` (${hiddenCount})` : ""}
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280] text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Unit</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium w-14">Beds</th>
              <th className="px-4 py-2 font-medium w-14">Baths</th>
              <th className="px-4 py-2 font-medium w-24">Area</th>
              <th className="px-4 py-2 font-medium w-24">Veranda</th>
              <th className="px-4 py-2 font-medium w-28 text-right">Price €</th>
              <th className="px-4 py-2 font-medium w-28">Status</th>
              <th className="px-4 py-2 font-medium w-24">Details</th>
              <th className="px-4 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {visibleIndices.map((i) => {
              const u = units[i];
              return (
              <Fragment key={i}>
              <tr className="hover:bg-[#F8F9FA]">
                <td className="px-3 py-1.5"><input value={u.label} onChange={(e) => patch(i, "label", e.target.value)} placeholder="A101" className={cell} /></td>
                <td className="px-3 py-1.5">
                  <select value={u.type} onChange={(e) => patch(i, "type", e.target.value)} className={cell}>
                    <option value="">—</option>
                    {(u.type && !PROPERTY_TYPES.includes(u.type) ? [u.type, ...PROPERTY_TYPES] : PROPERTY_TYPES).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5"><input value={u.beds} onChange={(e) => patch(i, "beds", e.target.value)} className={cell + " text-right"} /></td>
                <td className="px-3 py-1.5"><input value={u.baths} onChange={(e) => patch(i, "baths", e.target.value)} className={cell + " text-right"} /></td>
                <td className="px-3 py-1.5"><input value={u.areaBuilt} onChange={(e) => patch(i, "areaBuilt", e.target.value)} placeholder="95 m²" className={cell} /></td>
                <td className="px-3 py-1.5"><input value={u.areaVeranda} onChange={(e) => patch(i, "areaVeranda", e.target.value)} placeholder="18 m²" className={cell} /></td>
                <td className="px-3 py-1.5"><input value={u.price} onChange={(e) => patch(i, "price", e.target.value)} className={cell + " text-right tabular-nums"} /></td>
                <td className="px-3 py-1.5">
                  <select value={u.status} onChange={(e) => patch(i, "status", e.target.value)} className={cell}>
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="sold">Sold</option>
                  </select>
                </td>
                <td className="px-4 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => setOpenDetail(openDetail === i ? null : i)}
                    className={`inline-flex items-center gap-1 rounded-full border text-xs font-medium px-3 py-1 whitespace-nowrap transition-colors ${
                      openDetail === i ? "bg-[#1B4B43] border-[#1B4B43] text-white" : "border-[#1B4B43] text-[#1B4B43] hover:bg-[#1B4B43]/10"
                    }`}
                  >
                    {openDetail === i ? "▾ Close" : "▸ Open"}{u.photos.length ? ` · 📷${u.photos.length}` : ""}
                  </button>
                </td>
                <td className="px-4 py-1 text-center">
                  <button onClick={() => remove(i)} title="Delete unit" className="text-[#DC2626] hover:text-[#991B1B] text-base leading-none">×</button>
                </td>
              </tr>
              {openDetail === i && (
                <tr>
                  <td colSpan={10} className="p-0">
                    <UnitDetail
                      unit={u}
                      onPatch={(f, v) => patch(i, f, v)}
                      onSave={save}
                      saving={busy}
                      onClose={() => setOpenDetail(null)}
                      onApplyFeaturesToAll={() => applyFeaturesToAll(u.amenities)}
                    />
                  </td>
                </tr>
              )}
              </Fragment>
              );
            })}
            {units.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-[#9CA3AF]">No units. Add one, or import a price list PDF above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2.5 border-t border-[#E5E7EB] text-xs text-[#9CA3AF]">Saving marks all units as manually managed — the feed sync will no longer overwrite them.</div>
    </div>
  );
}
