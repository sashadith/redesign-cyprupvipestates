"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ThemeOption } from "@/lib/design/options";
import { fmt, type PartnerDict } from "@/lib/partner/i18n";
import { setMyPortalThemeAction } from "../themeAction";

const DEFAULT_VALUE = "";

/** Compact select next to the language switcher (header) or the full swatch picker (profile). */
export function ThemeSwitcher({ options, choiceId, t, variant }: { options: ThemeOption[]; choiceId: string | null; t: PartnerDict["theme"]; variant: "compact" | "full" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const def = options.find((o) => o.isDefault) ?? options[0];
  if (!def || options.length < 2) return null;
  const defLabel = fmt(t.default, { name: def.name });
  const pick = (id: string | null) => {
    if (id === choiceId) return;
    setSaved(false);
    start(async () => {
      const r = await setMyPortalThemeAction(id);
      setSaved(r.ok);
      router.refresh();
    });
  };
  if (variant === "compact") {
    return (
      <label className="pp-lang pp-theme">
        <span className="pp-sr">{t.label}</span>
        <select value={choiceId ?? DEFAULT_VALUE} disabled={pending} onChange={(e) => pick(e.target.value === DEFAULT_VALUE ? null : e.target.value)}>
          <option value={DEFAULT_VALUE}>{defLabel}</option>
          {options.filter((o) => o.id !== def.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>
    );
  }
  const rows: { id: string | null; label: string; o: ThemeOption }[] = [
    { id: null, label: defLabel, o: def },
    ...options.filter((o) => o.id !== def.id).map((o) => ({ id: o.id as string | null, label: o.name, o })),
  ];
  return (
    <div>
      <div className="pp-picker" role="radiogroup" aria-label={t.title} aria-busy={pending}>
        {rows.map((r) => (
          <button key={r.id ?? "default"} type="button" role="radio" aria-checked={r.id === choiceId} disabled={pending} onClick={() => pick(r.id)}>
            <span className="pp-swatch" aria-hidden="true">
              <i style={{ background: r.o.swatch.page }} /><i style={{ background: r.o.swatch.card }} /><i style={{ background: r.o.swatch.accent }} /><i style={{ background: r.o.swatch.text }} />
            </span>
            <span>{r.label}</span>
          </button>
        ))}
      </div>
      <p className="pp-muted pp-small" role="status">{saved ? t.saved : ""}</p>
    </div>
  );
}
