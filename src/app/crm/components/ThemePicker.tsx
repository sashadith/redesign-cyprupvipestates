"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ThemeOption } from "@/lib/design/options";
import { setMyCrmThemeAction } from "../themeActions";

export function Swatch({ s }: { s: ThemeOption["swatch"] }) {
  return (
    <span className="ds-swatch" aria-hidden="true">
      <i style={{ background: s.page }} /><i style={{ background: s.card }} /><i style={{ background: s.accent }} /><i style={{ background: s.text }} />
    </span>
  );
}

/** Personal colour-set choice for the signed-in staff user. choiceId null = "Default (<name>)". */
export function ThemePicker({ options, choiceId }: { options: ThemeOption[]; choiceId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const def = options.find((o) => o.isDefault) ?? options[0];
  if (!def) return null;
  const rows: { id: string | null; label: string; o: ThemeOption }[] = [
    { id: null, label: `Default (${def.name})`, o: def },
    ...options.filter((o) => o.id !== def.id).map((o) => ({ id: o.id as string | null, label: o.name, o })),
  ];
  const pick = (id: string | null) => {
    if (id === choiceId) return;
    setFailed(false);
    start(async () => {
      const r = await setMyCrmThemeAction(id);
      if (!r.ok) setFailed(true);
      router.refresh();
    });
  };
  return (
    <div className="ds-picker" role="radiogroup" aria-label="Colour set" aria-busy={pending}>
      {rows.map((r) => (
        <button key={r.id ?? "default"} type="button" role="radio" aria-checked={r.id === choiceId} disabled={pending} onClick={() => pick(r.id)}>
          <Swatch s={r.o.swatch} /><span>{r.label}</span>
        </button>
      ))}
      {failed && <p className="ds-picker-err" role="alert">Could not save. Please try again.</p>}
    </div>
  );
}
