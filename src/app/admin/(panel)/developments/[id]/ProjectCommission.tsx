"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveRateAction, deleteRateAction } from "@/app/crm/commissions/actions";
import { fmtRate } from "@/lib/crm/rateFormat";
import { RateField } from "../developers/[id]/CommissionRates";

// The project's commission (2026-10-24): what applies, where it comes from, and
// an optional project rate that overrides the developer default. Same actions
// and rows as the developer page and the new CRM's Commissions screen.
export default function ProjectCommission({ developmentId, developerAccountId, developerName, developerRate, own }: {
  developmentId: string;
  developerAccountId: string;
  developerName: string;
  developerRate: number | null;
  own: { id: string; ratePercent: number } | null;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const run = (p: Promise<{ ok: true } | { error: string }>) => start(async () => {
    setError("");
    const r = await p;
    if ("error" in r) setError(r.error);
  });
  const applies = own?.ratePercent ?? developerRate;

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-3">
      <h2 className="text-sm font-semibold text-[#111827]">Commission</h2>
      <p className="text-sm text-[#374151]">
        <span className="text-lg font-semibold text-[#111827]">{fmtRate(applies)}</span>
        <span className="ml-2 text-xs text-[#9CA3AF]">
          {own ? "project rate" : developerRate != null ? "developer rate" : "no rate set"}
        </span>
      </p>
      <div className="space-y-1">
        <span className="block text-xs text-[#6B7280]">Project rate (overrides the developer rate)</span>
        <RateField key={`${own?.ratePercent ?? ""}`} current={own?.ratePercent ?? null} placeholder={developerRate != null ? String(developerRate) : "e.g. 5"} busy={busy}
          onSave={(v) => run(saveRateAction({ developerAccountId, developmentId, rate: v }))}
          onClear={own ? () => run(deleteRateAction(own.id)) : undefined} />
      </div>
      <p className="text-xs text-[#9CA3AF]">
        Developer rate: {fmtRate(developerRate)} ·{" "}
        <Link href={`/admin/developments/developers/${developerAccountId}`} className="hover:underline">{developerName}</Link>
      </p>
      {error && <p className="text-sm text-[#B91C1C]" role="alert">{error}</p>}
    </div>
  );
}
