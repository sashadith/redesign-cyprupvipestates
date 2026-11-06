"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UNIT_AMENITY_CATALOG } from "@/lib/unitAmenityCatalog";
import UnitImages, { thumb, large } from "./UnitImages";
import { pinUnitPriceListValues, releaseUnitPin } from "./actions";
import type { UnitRow } from "./UnitsEditor";

const inp = "w-full rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-sm focus:border-[#1B4B43] focus:outline-none";
const lbl = "block text-xs font-medium text-[#6B7280] mb-1";

function Field({ label, value, onChange, placeholder, disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className={inp} />
    </div>
  );
}

function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <div className={inp + " bg-[#F3F4F6] text-[#6B7280] cursor-not-allowed"}>{value || "—"}</div>
      {hint && <p className="text-[10px] text-[#9CA3AF] mt-1">{hint}</p>}
    </div>
  );
}

function YesNo({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inp}>
        <option value="">—</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}


/* The developer's price list against their own feed, one unit at a time.

   This panel exists because the unit editor above is read-only for a
   feed-managed development, and deliberately so — but the price list a
   developer emails is regularly ahead of the feed they publish, and for
   Island Blue it contradicts it outright: a unit their feed still offers is
   Reserved on the list, at a price €15,000 lower. Correcting such a unit
   anywhere else lasts until 04:00 (src/lib/unitPins.ts has the full story),
   so the correction and the pin that protects it are made here, together. */
function PriceListPin({ unit }: { unit: UnitRow }) {
  const router = useRouter();
  const pinned = unit.pinnedFields || [];
  const [status, setStatus] = useState(unit.status || "available");
  const [price, setPrice] = useState(unit.price || "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (what: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(what);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) setError(r.error || "Could not save");
    else router.refresh();
  };

  const Row = ({ field, label, control, dirty }: { field: "status" | "price"; label: string; control: React.ReactNode; dirty: boolean }) => {
    const isPinned = pinned.includes(field);
    return (
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className={lbl}>{label}</label>
          {control}
        </div>
        <button type="button" disabled={!!busy || (isPinned && !dirty)}
          onClick={() => run(field, () => pinUnitPriceListValues(unit.id!, field === "status" ? { status } : { price }))}
          className="rounded-md bg-[#1B4B43] text-white text-xs font-medium px-3 py-1.5 hover:bg-[#142E2D] disabled:bg-[#D1D5DB] disabled:cursor-not-allowed whitespace-nowrap">
          {busy === field ? "Saving…" : isPinned ? "Update pin" : "Pin from price list"}
        </button>
        {isPinned && (
          <button type="button" disabled={!!busy} onClick={() => run(field + ":release", () => releaseUnitPin(unit.id!, field))}
            className="text-xs text-[#6B7280] hover:text-[#111827] hover:underline disabled:text-[#D1D5DB] disabled:no-underline whitespace-nowrap">
            {busy === field + ":release" ? "…" : "Release"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white p-3 space-y-3">
      <div>
        <div className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Price list</div>
        <p className="text-[11px] text-[#6B7280] mt-0.5">
          {pinned.length > 0
            ? `Pinned to the price list: ${pinned.map((f) => (f === "status" ? "status" : "price")).join(" and ")}. The sync leaves ${pinned.length === 1 ? "it" : "them"} alone until released.`
            : "Set a value here when the developer's price list contradicts their feed. A pinned value survives every sync; everything else on this unit keeps following the feed."}
        </p>
      </div>
      <Row field="status" label="Status" dirty={status !== (unit.status || "available")}
        control={
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
          </select>
        } />
      <Row field="price" label="Price (EUR)" dirty={price !== (unit.price || "")}
        control={<input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 285000" className={inp} />} />
      {error && <p className="text-[11px] text-[#B91C1C]">{error}</p>}
      <p className="text-[11px] text-[#9CA3AF]">
        Releasing a pin hands the column back to the feed — the next sync writes the feed&rsquo;s own value over it.
      </p>
    </div>
  );
}

export default function UnitDetail({ unit, onPatch, onSave, saving, onClose, onApplyFeaturesToAll, readOnly }: {
  unit: UnitRow;
  onPatch: (field: keyof UnitRow, val: any) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
  onClose: () => void;
  onApplyFeaturesToAll: () => void;
  readOnly?: boolean;
}) {
  const amenities = unit.amenities || [];
  // Prepend, don't append — a manually-checked feature should show ahead of the
  // ones auto-seeded from the project's own amenities during sync, on the public
  // unit card (which renders this array in order, no re-sorting).
  const toggle = (a: string) => onPatch("amenities", amenities.includes(a) ? amenities.filter((x) => x !== a) : [a, ...amenities]);
  const saveAndClose = async () => { await onSave(); onClose(); };

  return (
    <div className="bg-[#F8F9FA] border-t border-[#E5E7EB] p-4 space-y-5">
      <div className="text-sm font-semibold text-[#111827]">{unit.label || "New unit"}</div>

      {/* extended spec */}
      <div>
        <div className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Details</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Floor / Level" value={unit.floor} onChange={(v) => onPatch("floor", v)} placeholder="e.g. 1" disabled={readOnly} />
          <Field label="Unit number" value={unit.unitNumber} onChange={(v) => onPatch("unitNumber", v)} placeholder="e.g. 102" disabled={readOnly} />
          <Field label="Orientation" value={unit.orientation} onChange={(v) => onPatch("orientation", v)} placeholder="e.g. South-west" disabled={readOnly} />
          <Field label="Display reference" value={unit.ref} onChange={(v) => onPatch("ref", v)} placeholder="e.g. A103" disabled={readOnly} />
          <ReadOnlyField
            label="Feed reference"
            value={unit.feedRef}
            hint="Set automatically by the feed sync — read-only. Matches this unit to the feed for automatic sold/reserved status; editing the Display reference above never changes it."
          />
          <Field label="Total built area" value={unit.areaBuilt} onChange={(v) => onPatch("areaBuilt", v)} placeholder="e.g. 66 m²" disabled={readOnly} />
          <Field label="Covered internal" value={unit.areaInternal} onChange={(v) => onPatch("areaInternal", v)} placeholder="e.g. 52 m²" disabled={readOnly} />
          <Field label="Plot" value={unit.areaPlot} onChange={(v) => onPatch("areaPlot", v)} placeholder="e.g. 450 m²" disabled={readOnly} />
          <Field label="Covered veranda" value={unit.areaVeranda} onChange={(v) => onPatch("areaVeranda", v)} placeholder="e.g. 14 m²" disabled={readOnly} />
          <Field label="Uncovered veranda" value={unit.areaVerandaOpen} onChange={(v) => onPatch("areaVerandaOpen", v)} placeholder="—" disabled={readOnly} />
          <YesNo label="Storage" value={unit.storage} onChange={(v) => onPatch("storage", v)} disabled={readOnly} />
          <YesNo label="Guest W/C" value={unit.guestWc} onChange={(v) => onPatch("guestWc", v)} disabled={readOnly} />
        </div>
      </div>

      {/* Only for a unit that already exists — a pin is written straight to the
          row by its own action, so there has to be a row. */}
      {unit.id && <PriceListPin unit={unit} />}

      {unit.attrs.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Extra specs <span className="font-normal normal-case">(from price-list sync, shown on the public page)</span></div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-sm">
            {unit.attrs.map((a) => (
              <div key={a.name} className="flex justify-between gap-2 border-b border-[#E5E7EB] pb-1">
                <dt className="text-[#6B7280]">{a.name}</dt><dd className="text-[#111827]">{a.value || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* unit features */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Unit features ({amenities.length})</div>
          {!readOnly && (
            <button type="button" onClick={onApplyFeaturesToAll} disabled={!amenities.length}
              className="text-xs text-[#1B4B43] hover:underline disabled:text-[#9CA3AF] disabled:no-underline disabled:cursor-not-allowed">
              Apply to all units
            </button>
          )}
        </div>
        <div className="space-y-2">
          {UNIT_AMENITY_CATALOG.map((g) => (
            <div key={g.category}>
              <div className="text-[11px] text-[#9CA3AF] mb-1">{g.category}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                {g.items.map((a) => (
                  <label key={a} className={`flex items-center gap-2 text-sm text-[#374151] ${readOnly ? "" : "cursor-pointer"}`}>
                    <input type="checkbox" disabled={readOnly} className="h-4 w-4 rounded border-[#D1D5DB] text-[#1B4B43] focus:ring-[#1B4B43]" checked={amenities.includes(a)} onChange={() => toggle(a)} />
                    <span>{a}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {!readOnly && <p className="text-[11px] text-[#9CA3AF] mt-1.5">Fields & features save with “Save units” / “Save unit” below.</p>}
      </div>

      {/* Photos. The read-only (feed-managed) case used to print a bare count
          while the floor plans right below it rendered as thumbnails — so the
          normal case for almost every unit was "photos exist, you may not look
          at them". Feed-managed still means not editable; it never meant
          invisible. Same 80px tile as the plans panel, deliberately. */}
      {readOnly ? (
        unit.photos.length > 0 ? (
          <div>
            <p className="text-xs text-[#9CA3AF] mb-1.5">
              {unit.photos.length} photo{unit.photos.length === 1 ? "" : "s"} — feed-managed, switch to manual to edit.
            </p>
            <div className="flex flex-wrap gap-2">
              {unit.photos.map((src) => (
                <a key={src} href={large(src)} target="_blank" rel="noreferrer" title="Open full size"
                   className="block w-20 h-20 rounded-md border border-[#E5E7EB] overflow-hidden bg-white hover:border-[#1B4B43] transition-colors">
                  <img src={thumb(src)} alt="" loading="lazy" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#9CA3AF]">No photos in the feed for this unit.</p>
        )
      ) : unit.id ? (
        <div className="-mx-4"><UnitImages unitId={unit.id} photos={unit.photos} onChange={(photos) => onPatch("photos", photos)} /></div>
      ) : (
        <p className="text-xs text-[#9CA3AF]">Save units first to add photos.</p>
      )}

      {/* Floor plans — feed-supplied and read-only here. They are imported by the
          sync into DevelopmentUnit.plans and are shown on the public unit card,
          but the admin never loaded them, so a unit's own plan was invisible to
          whoever had to check it. Deliberately display-only: nothing in the admin
          writes unit plans today, and a half-wired editor would be worse than an
          honest read-only panel. */}
      {unit.plans.length > 0 && (
        <div>
          <p className="text-xs text-[#9CA3AF] mb-1.5">
            {unit.plans.length} floor plan{unit.plans.length === 1 ? "" : "s"} — from the feed, not editable here.
          </p>
          <div className="flex flex-wrap gap-2">
            {unit.plans.map((src) => (
              <a key={src} href={large(src)} target="_blank" rel="noreferrer" title="Open full size"
                 className="block w-20 h-20 rounded-md border border-[#E5E7EB] overflow-hidden bg-white hover:border-[#1B4B43] transition-colors">
                <img src={thumb(src)} alt="" loading="lazy" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="flex justify-end">
          <button type="button" onClick={saveAndClose} disabled={saving} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-4 py-1.5 hover:bg-[#142E2D] disabled:bg-[#D1D5DB] disabled:cursor-not-allowed">
            {saving ? "Saving…" : "Save unit"}
          </button>
        </div>
      )}
    </div>
  );
}
