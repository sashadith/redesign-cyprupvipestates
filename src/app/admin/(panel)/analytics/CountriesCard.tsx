"use client";
import { useState } from "react";

const VISIBLE_CAP = 6;

export type CountryRow = { code: string; label: string; count: number };

export default function CountriesCard({
  rows, total, note,
}: {
  rows: CountryRow[];
  total: number;
  note?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, VISIBLE_CAP);
  const hidden = rows.length - visible.length;

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <h2 className="text-sm font-semibold mb-3">Top countries</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No data yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {visible.map(({ code, label, count: n }) => {
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            return (
              <li key={code}>
                <div className="flex justify-between gap-3 text-sm mb-1">
                  <span className="text-[#374151]">{label}</span>
                  <span className="text-[#6B7280] tabular-nums shrink-0">{n.toLocaleString("en-GB")} · {pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                  <div className="h-full bg-[#1B4B43] rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center gap-3 mt-3">
        {hidden > 0 && (
          <button type="button" onClick={() => setExpanded(true)} className="text-xs font-medium text-[#1B4B43] hover:underline">
            Show {hidden} more
          </button>
        )}
        {expanded && rows.length > VISIBLE_CAP && (
          <button type="button" onClick={() => setExpanded(false)} className="text-xs font-medium text-[#6B7280] hover:underline">
            Show less
          </button>
        )}
      </div>
      {note && <p className="text-xs text-[#9CA3AF] mt-3">{note}</p>}
    </div>
  );
}
