"use client";

import { UNIT_AMENITY_CATALOG } from "@/lib/unitAmenityCatalog";
import UnitImages from "./UnitImages";
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

      {/* photos */}
      {readOnly ? (
        <p className="text-xs text-[#9CA3AF]">{unit.photos.length} photo{unit.photos.length === 1 ? "" : "s"} — feed-managed, switch to manual to edit.</p>
      ) : unit.id ? (
        <div className="-mx-4"><UnitImages unitId={unit.id} photos={unit.photos} onChange={(photos) => onPatch("photos", photos)} /></div>
      ) : (
        <p className="text-xs text-[#9CA3AF]">Save units first to add photos.</p>
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
