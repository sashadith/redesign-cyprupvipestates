"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zoneCity } from "@/lib/crm/leadLocalTime";
import { setLeadTimeZoneAction } from "../leads/actions";

// "Zone unclear" on the cockpit (2026-11-04): the lead's country has several time zones, so the
// operator picks the one that applies. Display only; it moves nothing.
export function LeadZonePicker({ leadId, country, options, canEdit }: { leadId: string; country: string; options: string[]; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canEdit) return <span className="crm-muted">Local time: zone unclear ({country})</span>;
  return (
    <label className="crm-ck-zone">
      <span className="crm-muted">Zone unclear ({country})</span>
      <select
        defaultValue=""
        disabled={busy}
        aria-label="Pick the lead's time zone"
        onChange={async (e) => {
          const zone = e.target.value;
          if (!zone) return;
          setBusy(true);
          setError(null);
          const r = await setLeadTimeZoneAction(leadId, zone).catch(() => ({ error: "Could not save." }));
          setBusy(false);
          if ("error" in r) setError(r.error);
          else router.refresh();
        }}
      >
        <option value="" disabled>Pick zone…</option>
        {options.map((z) => <option key={z} value={z}>{zoneCity(z)} ({z})</option>)}
      </select>
      {error && <span className="crm-ck-error" role="alert">{error}</span>}
    </label>
  );
}
