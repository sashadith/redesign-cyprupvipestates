"use client";
import { useState } from "react";

type Sub = { _key?: string; label: string; link: string; [k: string]: any };
type Nav = { _key?: string; label: string; link: string; subLinks?: Sub[]; [k: string]: any };

let kc = 0;
const k = () => `k-${Date.now().toString(36)}-${kc++}`;
const input = "w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm outline-none focus:border-[#1B4B43]";

// Full nav-tree editor: parent items (label + link) and their dropdown child
// links (label + link), with add/remove/reorder. Serializes the whole tree to a
// hidden input; updateHeaderDoc stores it (preserving any extra per-item keys).
export default function HeaderNavEditor({ name, initial }: { name: string; initial: any }) {
  const [items, setItems] = useState<Nav[]>(() =>
    (Array.isArray(initial) ? initial : []).map((n) => ({
      ...n,
      _key: n._key || k(),
      subLinks: (Array.isArray(n.subLinks) ? n.subLinks : []).map((s: any) => ({ ...s, _key: s._key || k() })),
    })),
  );

  const update = (next: Nav[]) => setItems(next);
  const setItem = (i: number, patch: Partial<Nav>) => update(items.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  const moveItem = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= items.length) return; const a = [...items]; [a[i], a[j]] = [a[j], a[i]]; update(a); };
  const addItem = () => update([...items, { _key: k(), label: "", link: "/", subLinks: [] }]);
  const removeItem = (i: number) => update(items.filter((_, j) => j !== i));

  const setSub = (i: number, si: number, patch: Partial<Sub>) =>
    setItem(i, { subLinks: (items[i].subLinks || []).map((s, j) => (j === si ? { ...s, ...patch } : s)) });
  const addSub = (i: number) => setItem(i, { subLinks: [...(items[i].subLinks || []), { _key: k(), label: "", link: "/" }] });
  const removeSub = (i: number, si: number) => setItem(i, { subLinks: (items[i].subLinks || []).filter((_, j) => j !== si) });

  return (
    <div className="space-y-3">
      {items.map((n, i) => (
        <div key={n._key} className="border border-[#E5E7EB] rounded-md p-3 space-y-2">
          <div className="flex gap-2 items-center">
            <input className={`${input} w-44 shrink-0`} value={n.label ?? ""} placeholder="Menu label" onChange={(e) => setItem(i, { label: e.target.value })} />
            <input className={input} value={n.link ?? ""} placeholder="/path, section-id, or https://…" onChange={(e) => setItem(i, { link: e.target.value })} />
            <select
              className={`${input} w-36 shrink-0`}
              title="Menu item style"
              value={n.variant ?? ""}
              onChange={(e) => setItem(i, { variant: e.target.value || undefined })}
            >
              <option value="">Default style</option>
              <option value="accent">Accent (gold)</option>
            </select>
            <div className="flex gap-1 shrink-0">
              <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} className="text-xs px-1.5 py-1 rounded border border-[#E5E7EB] disabled:opacity-40">↑</button>
              <button type="button" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="text-xs px-1.5 py-1 rounded border border-[#E5E7EB] disabled:opacity-40">↓</button>
              <button type="button" onClick={() => removeItem(i)} className="text-xs px-1.5 py-1 rounded border border-[#E5E7EB] text-[#C0392B]">✕</button>
            </div>
          </div>
          <div className="pl-4 border-l-2 border-[#E5E7EB] space-y-1.5">
            <div className="text-[11px] text-[#9CA3AF]">Dropdown links</div>
            {(n.subLinks || []).map((s, si) => (
              <div key={s._key} className="flex gap-2">
                <input className={`${input} w-40 shrink-0`} value={s.label ?? ""} placeholder="Label" onChange={(e) => setSub(i, si, { label: e.target.value })} />
                <input className={input} value={s.link ?? ""} placeholder="/path" onChange={(e) => setSub(i, si, { link: e.target.value })} />
                <button type="button" onClick={() => removeSub(i, si)} className="text-xs text-[#C0392B] px-1 shrink-0">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => addSub(i)} className="text-xs text-[#1B4B43] hover:underline">+ Add dropdown link</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addItem} className="rounded-md border border-[#1B4B43] text-[#1B4B43] text-sm px-4 py-1.5 hover:bg-[#1B4B43]/5">+ Add menu item</button>
      <input type="hidden" name={name} value={JSON.stringify(items)} />
    </div>
  );
}
