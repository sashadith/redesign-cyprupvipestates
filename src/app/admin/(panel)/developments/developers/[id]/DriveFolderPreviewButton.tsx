"use client";

import { useState, useTransition } from "react";
import { previewDriveFoldersAction } from "../../actions";
import type { DriveFolderPreview } from "@/lib/driveAvailabilitySync";

// Dry run — shows the folder → project mapping WITHOUT writing anything, so an
// operator can see what a sync would do (and which folders it would ignore, and
// why) before running one. Deliberately its own button rather than a flag on
// "Sync Drive now": the whole value is that it is safe to press.
export default function DriveFolderPreviewButton({ developerAccountId }: { developerAccountId: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; message: string; rows: DriveFolderPreview[] } | null>(null);

  const run = () =>
    start(async () => {
      try {
        setRes(await previewDriveFoldersAction(developerAccountId));
      } catch (e: any) {
        setRes({ ok: false, message: String(e?.message ?? e).slice(0, 200), rows: [] });
      }
    });

  const badge: Record<DriveFolderPreview["status"], string> = {
    existing: "bg-[#F3F4F6] text-[#374151]",
    new: "bg-[#DCFCE7] text-[#166534]",
    skipped: "bg-[#FEE2E2] text-[#991B1B]",
  };

  return (
    <>
      <button
        onClick={run}
        disabled={pending}
        className="rounded-md border border-[#D1D5DB] text-[#374151] text-sm font-medium px-3 py-1.5 hover:bg-[#F9FAFB] disabled:opacity-60 whitespace-nowrap"
      >
        {pending ? "Checking…" : "Check folders"}
      </button>
      {res && (
        <div className="basis-full space-y-2">
          <p className={`text-xs ${res.ok ? "text-[#6B7280]" : "text-[#C0392B]"}`}>{res.message}</p>
          {res.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-[#6B7280]">
                    <th className="py-1 pr-3 font-medium">Drive folder</th>
                    <th className="py-1 pr-3 font-medium">Price list</th>
                    <th className="py-1 pr-3 font-medium">Project</th>
                    <th className="py-1 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {res.rows.map((r) => (
                    <tr key={r.folder} className="border-t border-[#F3F4F6] align-top">
                      <td className="py-1 pr-3 text-[#111827]">{r.folder}</td>
                      <td className="py-1 pr-3 text-[#6B7280]">{r.priceFile ?? "—"}</td>
                      <td className="py-1 pr-3 text-[#111827]">{r.project}</td>
                      <td className="py-1">
                        <span className={`inline-block rounded px-1.5 py-0.5 ${badge[r.status]}`}>{r.status}</span>
                        {r.reason && <span className="ml-2 text-[#6B7280]">{r.reason}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
