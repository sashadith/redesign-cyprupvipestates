"use client";
import { useState, useTransition } from "react";
import { approvePartnerAction, reactivatePartnerAction, suspendPartnerAction, updatePartnerTermsAction } from "../partners/actions";
import { useToast } from "./Toast";

export type PartnerRow = {
  id: string; status: "PENDING" | "ACTIVE" | "SUSPENDED"; type: string; name: string; company: string | null; country: string; language: string;
  email: string; verified: boolean; registered: string; agreement: string | null;
  handoverShare: string; fixShare: string; trustMode: boolean; refCode: string | null; managerUserId: string | null; managerName: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  REAL_ESTATE: "Real estate", PRIVATE_BROKER: "Private broker", BANK: "Bank", INVESTMENT: "Investment", FAMILY_OFFICE: "Family office",
};

function TermsEditor({ row, managers }: { row: PartnerRow; managers: { id: string; name: string }[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [handover, setHandover] = useState(row.handoverShare);
  const [fix, setFix] = useState(row.fixShare);
  const [trust, setTrust] = useState(row.trustMode);
  const [manager, setManager] = useState(row.managerUserId ?? "");
  const save = () => start(async () => {
    const r = await updatePartnerTermsAction(row.id, { handoverShare: handover, fixShare: fix, trustMode: trust, managerUserId: manager || null });
    if ("error" in r) toast.show(r.error, "error"); else toast.show(r.notice ?? "Saved");
  });
  return (
    <fieldset disabled={pending} className="crm-pt-terms">
      <label><span>Handover share, %</span><input inputMode="decimal" value={handover} onChange={(e) => setHandover(e.target.value)} /></label>
      <label><span>Fix share, %</span><input inputMode="decimal" value={fix} onChange={(e) => setFix(e.target.value)} /></label>
      <label><span>Manager</span>
        <select value={manager} onChange={(e) => setManager(e.target.value)}>
          <option value="">None</option>
          {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <label className="crm-pt-check"><input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} /><span>Trust mode</span></label>
      <button type="button" className="crm-btn primary" onClick={save}>Save</button>
    </fieldset>
  );
}

function Row({ row, managers }: { row: PartnerRow; managers: { id: string; name: string }[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const run = (fn: (id: string) => Promise<{ ok: true; notice?: string } | { error: string }>) => {
    if (pending) return;
    start(async () => {
      const r = await fn(row.id);
      if ("error" in r) toast.show(r.error, "error"); else toast.show(r.notice ?? "Done");
    });
  };
  return (
    <li className="crm-panel crm-pt-row" aria-busy={pending}>
      <div className="crm-pt-main">
        <div className="crm-pt-who">
          <b>{row.name}</b>
          {row.company && <span>{row.company}</span>}
          <span>{TYPE_LABEL[row.type] ?? row.type} · {row.country} · {row.language.toUpperCase()}</span>
        </div>
        <div className="crm-pt-mail">
          <span>{row.email}</span>
          <span className={`crm-pill${row.verified ? " crm-pt-ok" : ""}`}>{row.verified ? "Verified" : "Not verified"}</span>
        </div>
        <div className="crm-pt-meta">
          <span>Registered {row.registered}</span>
          <span>Agreement {row.agreement ?? "none"}</span>
        </div>
        {row.status !== "PENDING" && (
          <div className="crm-pt-meta">
            <span>Handover {row.handoverShare}% · Fix {row.fixShare}%</span>
            <span>Trust: {row.trustMode ? "on" : "off"} · Manager: {row.managerName ?? "none"}</span>
            <span>Ref: {row.refCode ?? "none"}</span>
          </div>
        )}
        <div className="crm-pt-actions">
          {row.status === "PENDING" && <button type="button" className="crm-btn primary" disabled={pending || !row.verified} title={row.verified ? undefined : "Email not verified yet"} onClick={() => run(approvePartnerAction)}>Approve</button>}
          {row.status === "ACTIVE" && <button type="button" className="crm-btn danger" disabled={pending} onClick={() => run(suspendPartnerAction)}>Suspend</button>}
          {row.status === "SUSPENDED" && <button type="button" className="crm-btn primary" disabled={pending} onClick={() => run(reactivatePartnerAction)}>Reactivate</button>}
          <button type="button" className="crm-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Hide terms" : "Terms"}</button>
        </div>
      </div>
      {open && <TermsEditor row={row} managers={managers} />}
    </li>
  );
}

export function PartnersTable({ rows, managers }: { rows: PartnerRow[]; managers: { id: string; name: string }[] }) {
  const toast = useToast();
  if (rows.length === 0) return <p className="crm-pt-empty">No partners here.</p>;
  return (
    <>
      <ul className="crm-pt">{rows.map((r) => <Row key={r.id} row={r} managers={managers} />)}</ul>
      {toast.node}
    </>
  );
}
