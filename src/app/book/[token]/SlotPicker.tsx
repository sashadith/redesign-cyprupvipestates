"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatInZone } from "@/lib/booking/timezone";
import { proposeSlotAction } from "@/app/admin/(panel)/crm/[id]/bookingActions";
import { COPY, type BLocale } from "./copy";

export type SlotGroup = { dayLabel: string; slots: { utc: string; cyprusLabel: string }[] };

const MAX_SLOTS = 3;

// Client-side picker for the lead's 2-3 candidate times. Cyprus time is
// computed server-side (deterministic); the lead's own time is only known
// once this mounts in their browser, via Intl.DateTimeFormat().resolvedOptions()
// — resolved in an effect (not during render) so the server/client first
// render match and there's no hydration mismatch.
export default function SlotPicker({ token, groups, locale }: { token: string; groups: SlotGroup[]; locale: BLocale }) {
  const c = COPY[locale];
  const [leadTz, setLeadTz] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"idle" | "submitted">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLeadTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setLeadTz("Europe/Nicosia");
    }
  }, []);

  const toggle = (utc: string) => {
    setSelected((prev) => {
      if (prev.includes(utc)) return prev.filter((u) => u !== utc);
      if (prev.length >= MAX_SLOTS) return prev;
      return [...prev, utc];
    });
  };

  const yourTimeLabel = useMemo(
    () => (utc: string) => (leadTz ? formatInZone(new Date(utc), leadTz, localeToIntl(locale)) : null),
    [leadTz, locale]
  );

  const submit = () => {
    if (!leadTz || selected.length < 1 || selected.length > MAX_SLOTS) {
      setError(c.pickCountError);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await proposeSlotAction(token, selected, leadTz);
      if (res.ok) setPhase("submitted");
      else setError(c.genericError);
    });
  };

  if (phase === "submitted") {
    return (
      <div className="bk-gone" style={{ minHeight: "auto", padding: "2rem 0" }}>
        <h1>{c.submittedTitle}</h1>
        <p>{c.submittedBody}</p>
      </div>
    );
  }

  return (
    <div className="bk-card">
      <div className="bk-days">
        {groups.map((g) => (
          <div key={g.dayLabel}>
            <p className="bk-day__label">{g.dayLabel}</p>
            <div className="bk-day__slots">
              {g.slots.map((s) => {
                const isSelected = selected.includes(s.utc);
                const disabled = !isSelected && selected.length >= MAX_SLOTS;
                return (
                  <button
                    key={s.utc}
                    type="button"
                    className="bk-slot"
                    aria-pressed={isSelected}
                    disabled={disabled}
                    onClick={() => toggle(s.utc)}
                  >
                    {s.cyprusLabel}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="bk-selected">
          <p className="bk-selected__title">{c.selectedTitle}</p>
          {selected.map((utc) => (
            <div key={utc} className="bk-selected__row">
              <span className="bk-selected__your">{yourTimeLabel(utc) ?? c.detectingTimezone}</span>
              <span className="bk-selected__cyprus">{formatInZone(new Date(utc), "Asia/Nicosia")} ({c.cyprusTime})</span>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="bk-submit" disabled={pending || !leadTz || selected.length < 1} onClick={submit}>
        {pending ? c.submitting : c.submit}
      </button>
      {!error && <p className="bk-hint">{c.hint}</p>}
      {error && <p className="bk-error">{error}</p>}
    </div>
  );
}

function localeToIntl(locale: BLocale): string {
  return { en: "en-GB", de: "de-DE", pl: "pl-PL", ru: "ru-RU" }[locale];
}
