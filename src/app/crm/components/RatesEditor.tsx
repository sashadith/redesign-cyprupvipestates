"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRateAction, saveRateAction } from "../commissions/actions";
import { filterRateAccounts, parseRate } from "@/lib/crm/rateForm";
import { useToast } from "./Toast";

export type RateAccount = {
  id: string;
  name: string;
  defaultRate: { id: string; ratePercent: number } | null;
  overrides: { id: string; developmentId: string; projectName: string; ratePercent: number }[];
  projects: { id: string; name: string; published: boolean; status: string }[];
};

type Save = (developerAccountId: string, developmentId: string | null, rate: string) => Promise<boolean>;
type Remove = (rateId: string) => Promise<boolean>;

// Saves on Enter or blur. An emptied field just snaps back; removing is its own button.
function RateInput({ current, label, placeholder, onSave }: { current: number | null; label: string; placeholder?: string; onSave: (rate: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(current == null ? "" : String(current));
  const [pending, start] = useTransition();
  const [invalid, setInvalid] = useState<string | null>(null);
  const commit = () => {
    if (pending) return;
    if (draft.trim() === "") { setDraft(current == null ? "" : String(current)); setInvalid(null); return; }
    const p = parseRate(draft);
    if (!p.ok) { setInvalid(p.error); return; }
    setInvalid(null);
    if (p.value === current) { setDraft(String(current)); return; }
    start(async () => { if (!(await onSave(draft))) setDraft(current == null ? "" : String(current)); });
  };
  return (
    <span className="crm-rate-input">
      <input
        value={draft} inputMode="decimal" aria-label={label} placeholder={placeholder} disabled={pending} aria-invalid={invalid ? true : undefined}
        title={invalid ?? undefined}
        onChange={(e) => { setDraft(e.target.value); setInvalid(null); }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === "Escape") { setDraft(current == null ? "" : String(current)); setInvalid(null); }
        }}
      />
      <span aria-hidden="true">%</span>
      {invalid && <em className="crm-rate-err" role="alert">{invalid}</em>}
    </span>
  );
}

function RemoveButton({ question, label, onRemove }: { question: string; label: string; onRemove: () => Promise<boolean> }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false); // stays disabled until the refreshed list drops the row
  if (!asking) return <button type="button" className="crm-linkbtn" aria-label={label} onClick={() => setAsking(true)}>Remove</button>;
  return (
    <span className="crm-confirm" role="group" aria-label={question}>
      <span>{question}</span>
      <button type="button" className="crm-btn danger" disabled={pending || done} onClick={() => start(async () => { if (await onRemove()) setDone(true); else setAsking(false); })}>Yes</button>
      <button type="button" className="crm-btn" disabled={pending || done} onClick={() => setAsking(false)}>No</button>
    </span>
  );
}

function AddOverride({ account, save }: { account: RateAccount; save: Save }) {
  const [projectId, setProjectId] = useState("");
  const [rate, setRate] = useState("");
  const [pending, start] = useTransition();
  if (account.projects.length === 0) return null;
  const add = () => {
    if (!projectId) return;
    start(async () => { if (await save(account.id, projectId, rate)) { setProjectId(""); setRate(""); } });
  };
  return (
    <form className="crm-rate-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <span className="crm-rate-add-label">+ Project override</span>
      <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label={`Project of ${account.name}`} disabled={pending}>
        <option value="">Choose project…</option>
        {account.projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.published ? "" : ` (${p.status})`}</option>)}
      </select>
      <span className="crm-rate-input">
        <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder="Rate" aria-label="Override rate" disabled={pending} />
        <span aria-hidden="true">%</span>
      </span>
      <button type="submit" className="crm-btn primary" disabled={pending || !projectId || rate.trim() === ""}>Add</button>
    </form>
  );
}

function AccountRates({ account, save, remove }: { account: RateAccount; save: Save; remove: Remove }) {
  const d = account.defaultRate;
  return (
    <li className="crm-panel crm-rate-acc">
      <div className="crm-rate-head">
        <b>{account.name}</b>
        <span className="crm-rate-line">
          <span className="crm-rate-what">Default</span>
          <RateInput key={`d:${d?.id ?? "none"}:${d?.ratePercent ?? ""}`} current={d?.ratePercent ?? null} label={`Default rate for ${account.name}`}
            placeholder="none" onSave={(r) => save(account.id, null, r)} />
          {d && <RemoveButton question="Remove default rate?" label={`Remove default rate for ${account.name}`} onRemove={() => remove(d.id)} />}
        </span>
      </div>
      {account.overrides.length > 0 && (
        <ul className="crm-rate-overrides">
          {account.overrides.map((o) => (
            <li key={o.id} className="crm-rate-line">
              <span className="crm-rate-what">{o.projectName}</span>
              <RateInput key={`${o.id}:${o.ratePercent}`} current={o.ratePercent} label={`Rate for ${o.projectName}`} onSave={(r) => save(account.id, o.developmentId, r)} />
              <RemoveButton question="Remove override?" label={`Remove override for ${o.projectName}`} onRemove={() => remove(o.id)} />
            </li>
          ))}
        </ul>
      )}
      <AddOverride account={account} save={save} />
    </li>
  );
}

export function RatesEditor({ accounts }: { accounts: RateAccount[] }) {
  const toast = useToast();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const save: Save = async (developerAccountId, developmentId, rate) => {
    const r = await saveRateAction({ developerAccountId, developmentId, rate });
    if ("error" in r) { toast.show(r.error, "error"); return false; }
    toast.show("Rate saved");
    router.refresh();
    return true;
  };
  const remove: Remove = async (rateId) => {
    const r = await deleteRateAction(rateId);
    if ("error" in r) { toast.show(r.error, "error"); return false; }
    toast.show("Rate removed");
    router.refresh();
    return true;
  };
  const shown = filterRateAccounts(accounts, query);
  return (
    <section className="crm-comm-section" aria-labelledby="crm-rates-h">
      <div className="crm-comm-sechead">
        <div>
          <h2 id="crm-rates-h">Rates</h2>
          <p>A project override wins over the developer default. Changing a rate applies to new deals only — existing deals keep the rate stored on them.</p>
        </div>
        <input className="crm-comm-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter developers or projects" aria-label="Filter developers or projects" />
      </div>
      {shown.length === 0 ? (
        <p className="crm-notice">{accounts.length === 0 ? "No developer accounts yet." : "No developer matches this filter."}</p>
      ) : (
        <ul className="crm-rates">{shown.map((a) => <AccountRates key={a.id} account={a} save={save} remove={remove} />)}</ul>
      )}
      {toast.node}
    </section>
  );
}
