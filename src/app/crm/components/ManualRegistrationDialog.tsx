"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MANUAL_NOTE_MAX, nicosiaDayKey, type ManualStatus } from "@/lib/crm/registration/core";
import { recordManualRegistrationAction, type RegistrationOptions } from "../leads/registrationActions";

// "Add manually" on the lead cockpit (2026-11-01): a registration made outside
// the CRM is recorded here. Nothing is sent to the developer.

const matches = (q: string, s: string) => !q || s.toLowerCase().includes(q.toLowerCase());

export function ManualRegistrationDialog({ leadId, options, isOwner, onClose, onSaved }: {
  leadId: string; options: RegistrationOptions; isOwner: boolean; onClose: () => void; onSaved: () => void;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const today = nicosiaDayKey(new Date());
  const [devQ, setDevQ] = useState("");
  const [devId, setDevId] = useState("");
  const [projIds, setProjIds] = useState<string[]>([]);
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState<ManualStatus>("PRELIMINARY");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { dlg.current?.showModal(); }, []);

  const devs = useMemo(() => options.developers.filter((d) => matches(devQ, d.name)), [options.developers, devQ]);
  const projects = useMemo(() => options.projects.filter((p) => p.developerAccountId === devId), [options.projects, devId]);
  const dev = options.developers.find((d) => d.id === devId);

  async function save() {
    if (saving || !devId) return;
    setSaving(true);
    setError(null);
    try {
      const r = await recordManualRegistrationAction(leadId, devId, projIds, status, date, note);
      if (r.ok) { onSaved(); dlg.current?.close(); }
      else setError(r.error);
    } catch {
      setError("Could not save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dlg} className="crm-dialog crm-manreg" onClose={onClose} aria-labelledby="crm-manreg-h">
      <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <h2 id="crm-manreg-h">Add a registration</h2>
        <p className="crm-muted">For a client you registered outside the CRM. Nothing is sent to the developer.</p>

        <label htmlFor="crm-manreg-dev">Developer</label>
        <input id="crm-manreg-dev" type="search" placeholder="Search developers" value={devQ} onChange={(e) => setDevQ(e.target.value)} disabled={saving} />
        <div className="crm-options" role="listbox" aria-label="Developers">
          {devs.map((d) => (
            <button
              key={d.id} type="button" role="option" aria-selected={d.id === devId} className={d.id === devId ? "on" : undefined}
              disabled={d.alreadyRegistered || saving} onClick={() => { setDevId(d.id); setProjIds([]); }}
            >
              {d.name}{d.alreadyRegistered && <span className="crm-muted"> · already registered</span>}
            </button>
          ))}
          {devs.length === 0 && <p className="crm-muted">No match.</p>}
        </div>

        {dev && projects.length > 0 && (
          <fieldset className="crm-manreg-proj" disabled={saving}>
            <legend>Projects (optional)</legend>
            {projects.map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox" checked={projIds.includes(p.id)}
                  onChange={() => setProjIds((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]))}
                />
                <span>{p.publicName}</span>
              </label>
            ))}
          </fieldset>
        )}

        <label htmlFor="crm-manreg-date">Registered on</label>
        <input id="crm-manreg-date" type="date" required max={today} min="2015-01-01" value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />

        <label htmlFor="crm-manreg-status">Status</label>
        <select id="crm-manreg-status" value={status} onChange={(e) => setStatus(e.target.value as ManualStatus)} disabled={saving}>
          <option value="SENT">Sent, no confirmation yet</option>
          <option value="PRELIMINARY">Preliminary (developer confirmed)</option>
          {isOwner && <option value="FIXED">Fixed</option>}
        </select>

        <label htmlFor="crm-manreg-note">Note (optional)</label>
        <input id="crm-manreg-note" maxLength={MANUAL_NOTE_MAX} placeholder="e.g. by email from my Gmail, confirmed by Maria" value={note} onChange={(e) => setNote(e.target.value)} disabled={saving} />

        {error && <p className="crm-dialog-error" role="alert">{error}</p>}
        <div className="crm-dialog-actions">
          <button type="button" className="crm-btn" onClick={() => dlg.current?.close()} disabled={saving}>Cancel</button>
          <button type="submit" className="crm-btn primary" disabled={saving || !devId || !date}>{saving ? "Saving…" : "Save registration"}</button>
        </div>
      </form>
    </dialog>
  );
}
