"use client";

import { useState } from "react";
import Link from "next/link";

export type DevRow = {
  id: string; name: string; feedName: string | null; dev: string; developer: string;
  location: string; priceFrom: string; units: string; status: string; noFolder?: boolean; synced: string;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[#F3F4F6] text-[#6B7280]", ready: "bg-[#FEF3C7] text-[#92400E]",
  published: "bg-[#DCFCE7] text-[#166534]", archived: "bg-[#FEE2E2] text-[#991B1B]",
};

export default function DevelopmentsTable({ rows }: { rows: DevRow[] }) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? rows.filter((r) => `${r.name} ${r.feedName ?? ""} ${r.location} ${r.developer}`.toLowerCase().includes(ql))
    : rows;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search developments…"
          className="w-full max-w-sm rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B4B43]"
        />
        <span className="text-xs text-[#9CA3AF] whitespace-nowrap">{filtered.length} of {rows.length}</span>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280] text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Public name</th>
              <th className="px-4 py-3 font-medium">Developer</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium text-right">From</th>
              <th className="px-4 py-3 font-medium text-right">Units</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Synced</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-3">
                  <Link href={`/admin/developments/${r.id}`} className="font-medium text-[#111827] hover:text-[#1B4B43] hover:underline">
                    {r.name}
                  </Link>
                  {r.feedName && <div className="text-xs text-[#9CA3AF]">feed: {r.feedName}</div>}
                </td>
                <td className="px-4 py-3 text-[#6B7280]">{r.developer}</td>
                <td className="px-4 py-3 text-[#6B7280]">{r.location}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.priceFrom}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.units}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[r.status] ?? "bg-[#F3F4F6] text-[#6B7280]"}`}>{r.status}</span>
                  {r.noFolder && (
                    <span
                      title="Kein passender Google-Drive-Ordner — keine Bilder/Grundrisse"
                      className="ml-1.5 inline-block rounded px-2 py-0.5 text-xs border border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]"
                    >
                      No folder
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#9CA3AF] text-xs whitespace-nowrap">{r.synced}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[#9CA3AF]">{ql ? "No match." : "No developments for this filter."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
