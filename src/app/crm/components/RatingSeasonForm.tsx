"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSeasonAction } from "../partners/ratingActions";
import { useToast } from "./Toast";

const KINDS = [
  ["claim_accepted", "Client accepted"],
  ["viewing", "Viewing"],
  ["reserved", "Reservation"],
  ["closed", "Closed deal"],
] as const;
const LOCALES = [
  ["en", "Prizes (English, required)"],
  ["de", "Prizes (German, optional — falls back to English)"],
  ["pl", "Prizes (Polish, optional — falls back to English)"],
  ["ru", "Prizes (Russian, optional — falls back to English)"],
] as const;

export type SeasonFormValues = {
  name: string; startsOn: string; endsOn: string; points: Record<string, string>; prizes: Record<string, string>;
};

/** Create (id null) or edit one season. Days are Cyprus calendar days; the end day is inclusive. */
export function RatingSeasonForm({ id, initial, active }: { id: string | null; initial: SeasonFormValues; active: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<SeasonFormValues>(initial);
  const [warning, setWarning] = useState<string | null>(null);
  const prefix = id ? `rs-${id.slice(0, 8)}` : "rs-new";
  const save = () => start(async () => {
    const r = await saveSeasonAction(id, v);
    if ("error" in r) {
      toast.show(r.error, "error");
      return;
    }
    setWarning(r.warning ?? null);
    toast.show(r.notice);
    if (!id) router.push(`/crm/partners/rating?season=${encodeURIComponent(r.id)}`);
    else router.refresh();
  });
  return (
    <form className="crm-panel crm-rs-form" aria-labelledby={`${prefix}-title`} aria-busy={pending} onSubmit={(e) => { e.preventDefault(); save(); }}>
      <h2 id={`${prefix}-title`}>{id ? "Edit season" : "New season"}</h2>
      <fieldset disabled={pending} className="crm-pt-terms crm-rs-fields">
        <label className="crm-rs-name">Name
          <input value={v.name} maxLength={80} required onChange={(e) => setV({ ...v, name: e.target.value })} />
        </label>
        <label>Start (Cyprus)
          <input type="date" value={v.startsOn} required onChange={(e) => setV({ ...v, startsOn: e.target.value })} />
        </label>
        <label>End, inclusive (Cyprus)
          <input type="date" value={v.endsOn} required onChange={(e) => setV({ ...v, endsOn: e.target.value })} />
        </label>
      </fieldset>
      <fieldset disabled={pending} className="crm-pt-terms crm-rs-fields">
        <legend>Points per event</legend>
        {KINDS.map(([k, label]) => (
          <label key={k}>{label}
            <input inputMode="numeric" value={v.points[k] ?? ""} onChange={(e) => setV({ ...v, points: { ...v.points, [k]: e.target.value } })} />
          </label>
        ))}
      </fieldset>
      {active && id && <p className="crm-muted crm-rs-note">This season is running: changed point values apply to events recorded from now on; points already earned keep their value.</p>}
      <fieldset disabled={pending} className="crm-pt-terms crm-rs-prizes">
        <legend>Prizes shown to partners</legend>
        {LOCALES.map(([l, label]) => (
          <label key={l}>{label}
            <textarea rows={3} maxLength={2000} required={l === "en"} value={v.prizes[l] ?? ""} onChange={(e) => setV({ ...v, prizes: { ...v.prizes, [l]: e.target.value } })} />
          </label>
        ))}
      </fieldset>
      {warning && <p className="crm-warn" role="status">{warning}</p>}
      <div className="crm-pt-actions">
        <button type="submit" className="crm-btn primary" disabled={pending}>{id ? "Save season" : "Create season"}</button>
        <button type="button" className="crm-btn quiet" disabled={pending} onClick={() => { setV(initial); setWarning(null); }}>Reset</button>
      </div>
    </form>
  );
}
