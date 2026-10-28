"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  previewRegistrationAction, registerLeadAction, type RegistrationOptions,
} from "../leads/registrationActions";
import { useToast } from "./Toast";

// "Register" dialog on the lead cockpit (spec 2026-10-27 §7.1). The preview is
// built server-side by the same function that sends; the operator may reword
// each message before sending, and the server re-checks an edited text.

type PreviewResult = Awaited<ReturnType<typeof previewRegistrationAction>>;
type Plans = Extract<PreviewResult, { ok: true }>["plans"];
type SendResult = Awaited<ReturnType<typeof registerLeadAction>>;
type Outcomes = Extract<SendResult, { ok: true }>["outcomes"];

const matches = (q: string, s: string) => !q || s.toLowerCase().includes(q.toLowerCase());

export function RegisterDialog({ leadId, options, onClose, onSent }: {
  leadId: string; options: RegistrationOptions; onClose: () => void; onSent: () => void;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const [devPicks, setDevPicks] = useState<string[]>([]);
  const [projPicks, setProjPicks] = useState<string[]>([]);
  const [devQ, setDevQ] = useState("");
  const [projQ, setProjQ] = useState("");
  const [bMin, setBMin] = useState(options.budget.min != null ? String(options.budget.min) : "");
  const [bMax, setBMax] = useState(options.budget.max != null ? String(options.budget.max) : "");
  const [plans, setPlans] = useState<Plans>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcomes | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  // Edited texts per developer; base is the generated text the edit started from.
  const [edits, setEdits] = useState<Record<string, { text: string; base: string }>>({});
  const seq = useRef(0);

  useEffect(() => { dlg.current?.showModal(); }, []);

  const devById = useMemo(() => new Map(options.developers.map((d) => [d.id, d])), [options.developers]);
  const pickable = (devId: string) => {
    const d = devById.get(devId);
    return !!d && d.registrable && !d.alreadyRegistered;
  };

  // Developers already registered since the dialog opened drop out of the picks.
  useEffect(() => {
    setDevPicks((p) => p.filter(pickable));
    setProjPicks((p) => p.filter((id) => {
      const pr = options.projects.find((x) => x.id === id);
      return !!pr && pickable(pr.developerAccountId);
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  // A picked project implies its developer; several projects of one developer go into one message.
  const picks = useMemo(() => {
    const byDev = new Map<string, string[]>();
    for (const id of devPicks) byDev.set(id, []);
    for (const id of projPicks) {
      const pr = options.projects.find((x) => x.id === id);
      if (!pr) continue;
      byDev.set(pr.developerAccountId, [...(byDev.get(pr.developerAccountId) ?? []), id]);
    }
    return Array.from(byDev.entries()).map(([developerAccountId, developmentIds]) => ({ developerAccountId, developmentIds }));
  }, [devPicks, projPicks, options.projects]);
  const picksKey = JSON.stringify(picks);

  useEffect(() => {
    const my = ++seq.current;
    if (picks.length === 0) { setPlans([]); setPreviewError(null); setPreviewing(false); return; }
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const r = await previewRegistrationAction(leadId, picks, bMin, bMax);
        if (my !== seq.current) return;
        if (r.ok) { setPlans(r.plans); setPreviewError(null); } else { setPlans([]); setPreviewError(r.error); }
      } catch {
        if (my === seq.current) { setPlans([]); setPreviewError("Could not build the preview — check your connection."); }
      } finally {
        if (my === seq.current) setPreviewing(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picksKey, bMin, bMax, leadId]);

  const toggleDev = (id: string) => {
    if (devPicks.includes(id) || picks.some((p) => p.developerAccountId === id)) {
      setDevPicks((p) => p.filter((x) => x !== id));
      setProjPicks((p) => p.filter((pid) => options.projects.find((x) => x.id === pid)?.developerAccountId !== id));
    } else setDevPicks((p) => [...p, id]);
  };
  const toggleProj = (id: string) => setProjPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const devReason = (d: RegistrationOptions["developers"][number]) =>
    d.alreadyRegistered ? "already registered" : !d.registrable ? "no registration channel set" : null;

  const devList = [...options.developers]
    .filter((d) => matches(devQ, d.name))
    .sort((a, b) => Number(pickable(b.id)) - Number(pickable(a.id)) || a.name.localeCompare(b.name));

  const projGroups = useMemo(() => {
    const groups = new Map<string, RegistrationOptions["projects"]>();
    for (const p of options.projects) {
      const dev = devById.get(p.developerAccountId);
      if (!dev || !(matches(projQ, p.publicName) || matches(projQ, dev.name))) continue;
      groups.set(dev.id, [...(groups.get(dev.id) ?? []), p]);
    }
    return Array.from(groups.entries())
      .map(([devId, items]) => ({ dev: devById.get(devId)!, items }))
      .sort((a, b) => Number(pickable(b.dev.id)) - Number(pickable(a.dev.id)) || a.dev.name.localeCompare(b.dev.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.projects, devById, projQ]);

  async function send() {
    if (sending || plans.length === 0) return;
    setSending(true);
    setSendError(null);
    try {
      const texts = Object.fromEntries(plans.filter((p) => edits[p.developerAccountId]).map((p) => [p.developerAccountId, edits[p.developerAccountId].text]));
      const r = await registerLeadAction(leadId, picks, bMin, bMax, texts);
      if (!r.ok) { setSendError(r.error); return; }
      setOutcomes(r.outcomes);
      setDevPicks([]);
      setProjPicks([]);
      setEdits({});
      onSent();
      if (r.outcomes.every((o) => o.result === "sent")) {
        toast.show(`${r.outcomes.length} registration${r.outcomes.length === 1 ? "" : "s"} sent.`);
        dlg.current?.close();
      }
    } catch {
      setSendError("Could not send — check your connection, then look at the block before retrying.");
    } finally {
      setSending(false);
    }
  }

  const n = plans.length;
  return (
    <dialog ref={dlg} className="crm-dialog crm-reg-dialog" aria-labelledby="crm-reg-h" onClose={onClose} onCancel={(e) => { if (sending) e.preventDefault(); }}>
      <div className="crm-reg-body">
        <h2 id="crm-reg-h">Register with developers</h2>
        <div className="crm-reg-cols">
          <div className="crm-reg-pick">
            <fieldset>
              <legend>Developers</legend>
              <input type="search" placeholder="Search developers" aria-label="Search developers" value={devQ} onChange={(e) => setDevQ(e.target.value)} />
              <ul className="crm-reg-list">
                {devList.map((d) => {
                  const why = devReason(d);
                  const on = picks.some((p) => p.developerAccountId === d.id);
                  return (
                    <li key={d.id} className={why ? "off" : undefined}>
                      <label>
                        <input type="checkbox" checked={on} disabled={!!why || sending} onChange={() => toggleDev(d.id)} />
                        <span>{d.name}</span>
                        {why ? <em>{why}</em> : <em>{d.channel === "EMAIL" ? "✉" : "WA"}</em>}
                      </label>
                    </li>
                  );
                })}
                {devList.length === 0 && <li className="off">No match.</li>}
              </ul>
            </fieldset>
            <fieldset>
              <legend>Projects</legend>
              <input type="search" placeholder="Search projects or developers" aria-label="Search projects" value={projQ} onChange={(e) => setProjQ(e.target.value)} />
              <ul className="crm-reg-list">
                {projGroups.map(({ dev, items }) => {
                  const why = devReason(dev);
                  return (
                    <li key={dev.id} className="grp">
                      <span className="crm-reg-grp">{dev.name}{why && <em> · {why}</em>}</span>
                      <ul>
                        {items.map((p) => (
                          <li key={p.id} className={why ? "off" : undefined}>
                            <label>
                              <input type="checkbox" checked={projPicks.includes(p.id)} disabled={!!why || sending} onChange={() => toggleProj(p.id)} />
                              <span>{p.publicName}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
                {projGroups.length === 0 && <li className="off">No match.</li>}
              </ul>
            </fieldset>
            <div className="crm-reg-budget">
              <label>Budget from (€)
                <input type="number" min={0} step={1000} inputMode="numeric" value={bMin} onChange={(e) => setBMin(e.target.value)} disabled={sending} />
              </label>
              <label>Budget to (€)
                <input type="number" min={0} step={1000} inputMode="numeric" value={bMax} onChange={(e) => setBMax(e.target.value)} disabled={sending} />
              </label>
            </div>
          </div>

          <div className="crm-reg-preview" aria-live="polite">
            <h3>Preview{previewing && <span className="crm-muted"> · updating…</span>}</h3>
            {picks.length === 0 && <p className="crm-muted">Pick a developer or a project to see the exact message.</p>}
            {previewError && <p className="crm-dialog-error" role="alert">{previewError}</p>}
            {plans.map((p) => (
              <article key={p.developerAccountId} className="crm-reg-plan">
                <b>{p.developerName}</b>
                <dl>
                  <div><dt>Channel</dt><dd>{p.channel === "EMAIL" ? "Email" : "WhatsApp"}</dd></div>
                  <div><dt>To</dt><dd>{p.labels.join(", ")}</dd></div>
                  {p.cc.length > 0 && <div><dt>CC</dt><dd>{p.cc.join(", ")}</dd></div>}
                  {p.channel === "EMAIL" && <div><dt>Subject</dt><dd>{p.subject}</dd></div>}
                </dl>
                {(() => {
                  const e = edits[p.developerAccountId];
                  const value = e?.text ?? p.text;
                  return (
                    <>
                      <textarea
                        className="crm-reg-text" aria-label={`Message to ${p.developerName}`} value={value} maxLength={4000}
                        rows={value.split("\n").length + 1} disabled={sending} spellCheck
                        onChange={(ev) => { const text = ev.target.value; setSendError(null); setEdits((m) => ({ ...m, [p.developerAccountId]: { text, base: m[p.developerAccountId]?.base ?? p.text } })); }}
                      />
                      {e && (
                        <p className="crm-reg-edited">
                          {e.base !== p.text ? <b>Projects or budget changed after you edited this text — check it. </b> : <span className="crm-muted">Edited. </span>}
                          <button type="button" className="crm-linkbtn" disabled={sending} onClick={() => setEdits((m) => { const { [p.developerAccountId]: _drop, ...rest } = m; return rest; })}>Reset to generated text</button>
                        </p>
                      )}
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        </div>

        {outcomes && (
          <ul className="crm-reg-results" aria-label="Send results">
            {outcomes.map((o) => (
              <li key={o.developerAccountId} className={`r-${o.result}`}>
                <b>{o.developerName}</b>: {o.result === "sent" ? "sent" : o.result === "already" ? "already registered" : `failed: ${o.error ?? "unknown error"}`}
              </li>
            ))}
          </ul>
        )}
        {sendError && <p className="crm-dialog-error" role="alert">{sendError}</p>}

        <div className="crm-dialog-actions">
          <button type="button" className="crm-btn" onClick={() => dlg.current?.close()} disabled={sending}>Close</button>
          <button type="button" className="crm-btn primary" onClick={() => void send()} disabled={sending || previewing || n === 0 || !!previewError}>
            {sending ? "Sending…" : `Send ${n} registration${n === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
      {toast.node}
    </dialog>
  );
}
