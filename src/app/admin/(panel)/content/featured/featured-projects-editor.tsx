"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";

type Item = { id: string; title: string };
type Avail = { id: string; title: string; city: string };

const btn = "rounded border border-[#E5E7EB] text-sm px-2 py-1 hover:bg-[#F8F9FA] disabled:opacity-40 disabled:cursor-not-allowed";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D] disabled:opacity-60">
      {pending ? "Saving…" : "Save featured list"}
    </button>
  );
}

export default function FeaturedProjectsEditor({
  initial, available, action, noun = "project", nounPlural, fieldName = "projectIds",
}: { lang: string; initial: Item[]; available: Avail[]; action: (formData: FormData) => void; noun?: string; nounPlural?: string; fieldName?: string }) {
  const plural = nounPlural ?? `${noun}s`;
  const [list, setList] = useState<Item[]>(initial);
  const [pick, setPick] = useState("");

  const inList = new Set(list.map((i) => i.id));
  const addable = available.filter((a) => !inList.has(a.id));

  const add = () => {
    const a = available.find((x) => x.id === pick);
    if (a) setList([...list, { id: a.id, title: a.title }]);
    setPick("");
  };
  const remove = (id: string) => setList(list.filter((i) => i.id !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name={fieldName} value={list.map((i) => i.id).join(",")} />

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
        <h2 className="text-sm font-semibold mb-3">Featured {plural} ({list.length})</h2>
        {list.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No featured {plural} yet — add some below.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((it, i) => (
              <li key={it.id} className="flex items-center gap-2 border border-[#E5E7EB] rounded-md px-3 py-2">
                <span className="text-xs text-[#9CA3AF] w-5 text-right">{i + 1}</span>
                <span className="flex-1 text-sm truncate">{it.title}</span>
                <button type="button" className={btn} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                <button type="button" className={btn} onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Move down">↓</button>
                <button type="button" className="text-[#C0392B] text-xs px-2 py-1 hover:underline" onClick={() => remove(it.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-sm mb-1">Add a {noun}</label>
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43] bg-white"
          >
            <option value="">— select a {noun} —</option>
            {addable.map((a) => (
              <option key={a.id} value={a.id}>{a.title}{a.city ? ` · ${a.city}` : ""}</option>
            ))}
          </select>
        </div>
        <button type="button" className="rounded-md bg-[#C29A5E] text-white text-sm px-4 py-2 hover:opacity-90 disabled:opacity-40" onClick={add} disabled={!pick}>
          Add
        </button>
      </div>

      <SaveBtn />
    </form>
  );
}
