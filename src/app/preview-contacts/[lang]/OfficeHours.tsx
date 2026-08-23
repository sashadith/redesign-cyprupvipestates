"use client";

import { useEffect, useState } from "react";


/* Live "open now / closed" badge for the stated 9:00–18:00 office hours.

   Computed in CYPRUS time, not the visitor's — the whole point is to tell
   someone in Berlin or Almaty whether anyone is actually at the desk right
   now. Intl with timeZone "Asia/Nicosia" handles EET/EEST for us, so there is
   no hand-rolled DST arithmetic anywhere.

   Renders the neutral hours line during SSR and on the first client paint,
   then upgrades to the live state in an effect — otherwise the server's
   "open" and the client's "closed" would hydrate-mismatch at exactly 9:00
   and 18:00. */

const OPEN_HOUR = 9;
const CLOSE_HOUR = 18;

function cyprusHour(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Nicosia",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value;
  return Number(h ?? NaN);
}

/* Narrow, serializable label subset — see the same note in ConsultantFinder. */
export type HoursLabels = {
  label: string;
  value: string;
  open: string;
  closed: string;
  opensAt: string;
  timezone: string;
};

export default function OfficeHours({ labels }: { labels: HoursLabels }) {
  const [state, setState] = useState<"unknown" | "open" | "closed">("unknown");

  useEffect(() => {
    const tick = () => {
      const h = cyprusHour();
      if (!Number.isFinite(h)) return setState("unknown");
      setState(h >= OPEN_HOUR && h < CLOSE_HOUR ? "open" : "closed");
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="cnt__hours">
      <span className="cnt__hours-label">{labels.label}</span>
      <span className="cnt__hours-value">{labels.value}</span>
      {state !== "unknown" && (
        <span className={`cnt__hours-badge cnt__hours-badge--${state}`}>
          <span className="cnt__hours-dot" aria-hidden />
          {state === "open" ? labels.open : `${labels.closed} · ${labels.opensAt}`}
        </span>
      )}
      <span className="cnt__hours-tz">{labels.timezone}</span>
    </div>
  );
}
