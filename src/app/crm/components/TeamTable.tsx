"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { updateTeamMemberAction, type TeamStored } from "../team/actions";
import { cleanSpecialties, normalizeRights, TEAM_LANGUAGES, type TeamPatch } from "@/lib/crm/teamRights";
import { useToast } from "./Toast";

export type TeamRow = {
  id: string; name: string; email: string; seesEverything: boolean;
  canSeeColleagues: boolean; canEditColleagues: boolean;
  languages: string[]; specialties: string[]; acceptsLeads: boolean; activeLeads: number;
};

function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} className={`crm-switch${on ? " on" : ""}`} onClick={() => onChange(!on)}>
      <span className="crm-switch-track" aria-hidden="true"><i /></span>
      <span>{label}</span>
    </button>
  );
}

function Row({ initial, save }: { initial: TeamRow; save: (id: string, patch: TeamPatch) => Promise<TeamStored | null> }) {
  const [row, setRow] = useState(initial);
  const [draft, setDraft] = useState(initial.specialties.join(", "));
  const [pending, start] = useTransition();
  // The fieldset is disabled while saving, which drops focus to <body>. The
  // control that triggered the save gets it back once the save is done, unless
  // the user has already moved focus somewhere else.
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (pending) return;
    const el = returnFocus.current;
    returnFocus.current = null;
    if (el?.isConnected && (document.activeElement === null || document.activeElement === document.body)) el.focus();
  }, [pending]);

  // Optimistic (functional updates); the server's stored values win, failure rolls back.
  const apply = (patch: TeamPatch) => {
    if (pending) return;
    const active = document.activeElement;
    returnFocus.current = active instanceof HTMLElement && active !== document.body ? active : null;
    const prev = row;
    const touchesRights = patch.canSeeColleagues !== undefined || patch.canEditColleagues !== undefined;
    setRow((r) => ({ ...r, ...patch, ...(touchesRights ? normalizeRights(r, patch) : {}) }));
    start(async () => {
      const stored = await save(row.id, patch);
      if (stored) { setRow((r) => ({ ...r, ...stored })); setDraft(stored.specialties.join(", ")); }
      else { setRow(prev); setDraft(prev.specialties.join(", ")); }
    });
  };

  const commitSpecialties = () => {
    const list = cleanSpecialties(draft.split(","));
    if (list.join("\n").toLowerCase() === row.specialties.join("\n").toLowerCase()) { setDraft(row.specialties.join(", ")); return; }
    apply({ specialties: list });
  };

  return (
    <li className="crm-panel crm-team-row" aria-busy={pending}>
      <fieldset disabled={pending} className="crm-team-fs">
      <div className="crm-team-who">
        <b>{row.name}</b>
        <span>{row.email}</span>
        <span className="crm-team-load">{row.activeLeads} active lead{row.activeLeads === 1 ? "" : "s"}</span>
      </div>
      <div className="crm-team-rights">
        {row.seesEverything ? (
          <span className="crm-pill">Sees everything (admin)</span>
        ) : (
          <>
            <Switch on={row.canSeeColleagues} label="See colleagues' leads" onChange={(v) => apply({ canSeeColleagues: v })} />
            <Switch on={row.canEditColleagues} label="Edit colleagues' leads" onChange={(v) => apply({ canEditColleagues: v })} />
          </>
        )}
        <Switch on={row.acceptsLeads} label="Takes new leads" onChange={(v) => apply({ acceptsLeads: v })} />
      </div>
      <div className="crm-team-langs" role="group" aria-label={`Languages of ${row.name}`}>
        {TEAM_LANGUAGES.map((l) => {
          const has = row.languages.includes(l);
          return (
            <button key={l} type="button" aria-pressed={has} className={`crm-chip${has ? " on" : ""}`}
              onClick={() => apply({ languages: has ? row.languages.filter((x) => x !== l) : TEAM_LANGUAGES.filter((x) => x === l || row.languages.includes(x)) })}>
              {l.toUpperCase()}
            </button>
          );
        })}
      </div>
      <div className="crm-team-spec">
        <label>
          <span>Specialties (comma-separated)</span>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commitSpecialties}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitSpecialties(); } }} placeholder="Paphos, Limassol" />
        </label>
        {row.specialties.length > 0 && (
          <div className="crm-team-chips">{row.specialties.map((s) => <span key={s} className="crm-pill">{s}</span>)}</div>
        )}
      </div>
      </fieldset>
    </li>
  );
}

export function TeamTable({ rows }: { rows: TeamRow[] }) {
  const toast = useToast();
  const save = async (id: string, patch: TeamPatch) => {
    const r = await updateTeamMemberAction(id, patch);
    if ("error" in r) { toast.show(r.error, "error"); return null; }
    toast.show("Saved");
    return r.stored;
  };
  return (
    <>
      <ul className="crm-team">{rows.map((r) => <Row key={r.id} initial={r} save={save} />)}</ul>
      {toast.node}
    </>
  );
}
