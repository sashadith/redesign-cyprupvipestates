"use client";
import { useState } from "react";

type Opt = { id: string; title: string };

// Manual picker for the curated "Related Landing Pages" field. Options are ONLY same-language
// published singlepages (provided by the server). The "Copy relations from EN" button merges in
// the EN page's relations already mapped to this language's equivalents — the editor reviews and
// adjusts before saving; nothing is applied across languages automatically.
export default function RelatedPagesEditor({
  initialIds,
  options,
  enSuggestion,
}: {
  initialIds: string[];
  options: Opt[];
  enSuggestion: Opt[];
}) {
  const byId = new Map(options.map((o) => [o.id, o.title]));
  const [ids, setIds] = useState<string[]>(initialIds.filter((x) => byId.has(x)));

  const available = options.filter((o) => !ids.includes(o.id));
  const add = (id: string) => { if (id && !ids.includes(id)) setIds([...ids, id]); };
  const remove = (id: string) => setIds(ids.filter((x) => x !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    setIds(next);
  };
  const copyFromEn = () => {
    const merged = [...ids];
    for (const s of enSuggestion) if (!merged.includes(s.id)) merged.push(s.id);
    setIds(merged);
  };

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Related Landing Pages</h2>
        {enSuggestion.length > 0 && (
          <button
            type="button"
            onClick={copyFromEn}
            className="text-xs rounded-md border border-[#C29A5E] text-[#8a6d3b] px-3 py-1.5 hover:bg-[#FBF7F0]"
          >
            Copy relations from EN ({enSuggestion.length})
          </button>
        )}
      </div>
      <p className="text-xs text-[#6B7280]">
        Manually pick related landing pages in this language. Shown on the page as “You may also be
        interested in”. Only same-language published pages are selectable; the block is hidden when empty.
      </p>

      {ids.length === 0 ? (
        <p className="text-xs text-[#9CA3AF]">No related pages selected.</p>
      ) : (
        <ul className="space-y-1.5">
          {ids.map((id, i) => (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{byId.get(id) ?? id}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-[#6B7280] disabled:opacity-30 px-1">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === ids.length - 1} className="text-[#6B7280] disabled:opacity-30 px-1">↓</button>
              <button type="button" onClick={() => remove(id)} className="text-[#C0392B] px-1">✕</button>
            </li>
          ))}
        </ul>
      )}

      <select
        value=""
        onChange={(e) => { add(e.target.value); e.target.value = ""; }}
        className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]"
      >
        <option value="">+ Add related page…</option>
        {available.map((o) => (
          <option key={o.id} value={o.id}>{o.title}</option>
        ))}
      </select>

      <input type="hidden" name="relatedLandingPageIds" value={ids.join(",")} />
    </div>
  );
}
