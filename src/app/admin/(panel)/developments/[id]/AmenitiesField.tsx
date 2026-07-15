"use client";

import { useState } from "react";
import { AMENITY_CATALOG, ALL_CATALOG_AMENITIES } from "@/lib/amenityCatalog";

// Checkbox catalogue + free-text custom items. Submits inside the parent override
// form via hidden inputs named "amenities" (saveOverride reads getAll).
export default function AmenitiesField({ selected }: { selected: string[] }) {
  const [chosen, setChosen] = useState<string[]>(selected);
  const [custom, setCustom] = useState("");

  const catalog = new Set(ALL_CATALOG_AMENITIES);
  const extras = chosen.filter((a) => !catalog.has(a));
  const toggle = (a: string) => setChosen((c) => (c.includes(a) ? c.filter((x) => x !== a) : [...c, a]));
  const addCustom = () => {
    const v = custom.trim();
    if (v && !chosen.includes(v)) setChosen((c) => [...c, v]);
    setCustom("");
  };

  const box = "flex items-center gap-2 text-sm text-[#374151] cursor-pointer";
  const check = "h-4 w-4 rounded border-[#D1D5DB] text-[#1B4B43] focus:ring-[#1B4B43]";

  return (
    <div className="space-y-3">
      {/* hidden inputs carry the selection into the form submit */}
      {chosen.map((a) => (
        <input key={a} type="hidden" name="amenities" value={a} />
      ))}

      <div className="text-xs text-[#6B7280]">{chosen.length} selected</div>

      {AMENITY_CATALOG.map((g) => (
        <div key={g.category}>
          <div className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-1.5">{g.category}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {g.items.map((a) => (
              <label key={a} className={box}>
                <input type="checkbox" className={check} checked={chosen.includes(a)} onChange={() => toggle(a)} />
                <span>{a}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      {extras.length > 0 && (
        <div>
          <div className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-1.5">Custom / from feed</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {extras.map((a) => (
              <label key={a} className={box}>
                <input type="checkbox" className={check} checked onChange={() => toggle(a)} />
                <span>{a}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="Add a custom amenity…"
          className="flex-1 rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm focus:border-[#1B4B43] focus:outline-none"
        />
        <button type="button" onClick={addCustom} className="rounded-md border border-[#E5E7EB] text-sm px-3 py-1.5 hover:bg-[#F8F9FA]">Add</button>
      </div>
    </div>
  );
}
