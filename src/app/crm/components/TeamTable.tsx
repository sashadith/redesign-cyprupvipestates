"use client";
import { useState, useTransition } from "react";
import { updateTeamMemberAction } from "../team/actions";
import { normalizeRights, TEAM_LANGUAGES, type TeamPatch } from "@/lib/crm/teamRights";
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

function Row({ initial, save }: { initial: TeamRow; save: (id: string, patch: TeamPatch) => Promise<boolean> }) {
  const [row, setRow] = useState(initial);
  const [draft, setDraft] = useState(initial.specialties.join(", "));
  const [pending, start] = useTransition();

  // Optimistic: apply, call the server, roll back to the previous row on failure.
  const apply = (patch: TeamPatch) => {
    const prev = row;
    const rights = normalizeRights(row, patch);
    const touchesRights = patch.canSeeColleagues !== undefined || patch.canEditColleagues !== undefined;
    setRow({ ...row, ...patch, ...(touchesRights ? rights : {}) });
    start(async () => {
      const ok = await save(row.id, patch);
      if (!ok) { setRow(prev); setDraft(prev.specialties.join(", ")); }
    });
  };

  const commitSpecialties = () => {
    const list = draft.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.join("\n").toLowerCase() === row.specialties.join("\n").toLowerCase()) { setDraft(row.specialties.join(", ")); return; }
    apply({ specialties: list });
  };

  return (
    <li className="crm-panel crm-team-row" aria-busy={pending}>
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
    </li>
  );
}

export function TeamTable({ rows }: { rows: TeamRow[] }) {
  const toast = useToast();
  const save = async (id: string, patch: TeamPatch) => {
    const r = await updateTeamMemberAction(id, patch);
    if ("error" in r) { toast.show(r.error, "error"); return false; }
    toast.show("Saved");
    return true;
  };
  return (
    <>
      <ul className="crm-team">{rows.map((r) => <Row key={r.id} initial={r} save={save} />)}</ul>
      {toast.node}
    </>
  );
}
