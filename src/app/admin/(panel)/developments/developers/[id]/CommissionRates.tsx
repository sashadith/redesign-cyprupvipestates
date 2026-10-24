"use client";

import { useState, useTransition } from "react";
import { saveRateAction, deleteRateAction } from "@/app/crm/commissions/actions";
import { fmtRate } from "@/lib/crm/rateFormat";

// Commission rates of one developer account (2026-10-24): the developer-wide
// default, and per project an optional rate that wins over it. Same rows and
// the same two server actions as the new CRM's Commissions screen
// (/crm/commissions) — admins and managers may change them, every change is
// audited, and the Xellex bridge re-sends the account's projects.

type Project = { id: string; name: string; status: string; rateId: string | null; ownRate: number | null };

const input = "w-20 rounded-md border border-[#E5E7EB] px-2 py-1 text-sm text-right focus:border-[#1B4B43] focus:outline-none";
const btn = "rounded-md border border-[#E5E7EB] px-2.5 py-1 text-xs font-medium text-[#374151] hover:bg-[#F8F9FA] disabled:opacity-50";

export function RateField({ current, placeholder, onSave, onClear, busy }: {
  current: number | null; placeholder: string; busy: boolean;
  onSave: (v: string) => void; onClear?: () => void;
}) {
  const [v, setV] = useState(current == null ? "" : String(current));
  const dirty = v.trim() !== (current == null ? "" : String(current));
  return (
    <span className="inline-flex items-center gap-1.5">
      <input className={input} value={v} placeholder={placeholder} inputMode="decimal" onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && dirty && v.trim()) { e.preventDefault(); onSave(v); } }} aria-label="Rate in percent" />
      <span className="text-sm text-[#6B7280]">%</span>
      {dirty && v.trim() && <button type="button" className={btn} disabled={busy} onClick={() => onSave(v)}>Save</button>}
      {current != null && onClear && !dirty && <button type="button" className={btn} disabled={busy} onClick={onClear}>Remove</button>}
    </span>
  );
}

export default function CommissionRates({ developerAccountId, defaultRate, projects }: {
  developerAccountId: string;
  defaultRate: { id: string; ratePercent: number } | null;
  projects: Project[];
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const run = (p: Promise<{ ok: true } | { error: string }>) => start(async () => {
    setError("");
    const r = await p;
    if ("error" in r) setError(r.error);
  });
  const save = (developmentId: string | null, rate: string) => run(saveRateAction({ developerAccountId, developmentId, rate }));
  const remove = (rateId: string) => run(deleteRateAction(rateId));

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#111827]">Commission</h2>
        <p className="text-xs text-[#9CA3AF]">A project rate overrides the developer rate. Shown in both CRMs, the partner portal and sent to Xellex.</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#374151] w-40">Developer rate (all projects)</span>
        <RateField key={`d:${defaultRate?.ratePercent ?? ""}`} current={defaultRate?.ratePercent ?? null} placeholder="e.g. 10" busy={busy}
          onSave={(v) => save(null, v)} onClear={defaultRate ? () => remove(defaultRate.id) : undefined} />
        {!defaultRate && <span className="text-xs text-[#B45309]">Not set — projects without their own rate have none.</span>}
      </div>
      {error && <p className="text-sm text-[#B91C1C]" role="alert">{error}</p>}
      {projects.length > 0 && (
        <div className="border border-[#E5E7EB] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA] text-[#6B7280] text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Applies</th>
                <th className="px-3 py-2 font-medium">Project rate (optional)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {projects.map((p) => {
                const applies = p.ownRate ?? defaultRate?.ratePercent ?? null;
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2 text-[#111827]">{p.name}{p.status !== "published" && <span className="ml-1.5 text-xs text-[#9CA3AF]">{p.status}</span>}</td>
                    <td className="px-3 py-2 text-[#374151]">
                      {fmtRate(applies)}
                      {applies != null && <span className="ml-1.5 text-xs text-[#9CA3AF]">{p.ownRate != null ? "project" : "developer"}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <RateField key={`${p.id}:${p.ownRate ?? ""}`} current={p.ownRate} placeholder={defaultRate ? String(defaultRate.ratePercent) : ""} busy={busy}
                        onSave={(v) => save(p.id, v)} onClear={p.rateId ? () => remove(p.rateId!) : undefined} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
