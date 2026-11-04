"use client";

import { useRef, useState, useTransition } from "react";
import { saveContractAction, deleteContractAction } from "./contractActions";
import {
  contractStatus, currentTermEnd, firstTermEnd, fmtDay, isIsoDate, whenText, STATUS_LABEL, MAX_TERM_MONTHS, type ContractStatusKind,
} from "@/lib/developerContract";

// Contracts with this developer (2026-10-29): the signed PDF, signing date,
// term and whether it renews itself. Several per developer — a renewal or an
// addendum is added, the older ones stay below as history; the one signed last
// counts. Without automatic renewal the daily run reminds 14 days and 1 day
// before the end (src/lib/developerContractReminders.ts). Only admins and the
// owner see the files and may change anything (contractActions.ts).

export type ContractRow = {
  id: string; signedAt: string; termMonths: number; autoRenew: boolean; commissionPercent: number | null;
  note: string | null; fileName: string; fileSize: number; createdAt: string;
  reminder14SentAt: string | null; reminder1SentAt: string | null;
};

const input = "w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#1B4B43]";
const btn = "rounded-md border border-[#E5E7EB] px-2.5 py-1 text-xs font-medium text-[#374151] hover:bg-[#F8F9FA] disabled:opacity-50";
export const STATUS_STYLE: Record<ContractStatusKind, string> = {
  none: "bg-[#F3F4F6] text-[#6B7280]",
  active: "bg-[#DCFCE7] text-[#166534]",
  autoRenew: "bg-[#DBEAFE] text-[#1E40AF]",
  expiring: "bg-[#FEF3C7] text-[#92400E]",
  expired: "bg-[#FEE2E2] text-[#991B1B]",
};
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const pdfHref = (id: string) => `/api/admin/developer-contracts/${id}`;

function ContractForm({ developerAccountId, row, onDone }: { developerAccountId: string; row?: ContractRow; onDone: () => void }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [signedAt, setSignedAt] = useState(row?.signedAt ?? "");
  const [term, setTerm] = useState(row ? String(row.termMonths) : "12");
  const [autoRenew, setAutoRenew] = useState(row?.autoRenew ?? false);
  const form = useRef<HTMLFormElement>(null);
  const months = Number(term);
  const end = isIsoDate(signedAt) && Number.isInteger(months) && months >= 1 && months <= MAX_TERM_MONTHS ? firstTermEnd(signedAt, months) : null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (file instanceof File && file.size > 0) fd.set("fileName", file.name);
    start(async () => {
      setError("");
      try {
        const r = await saveContractAction(fd);
        if ("error" in r) setError(r.error);
        else { form.current?.reset(); onDone(); }
      } catch {
        // A thrown action (file not writable, DB down, body over the proxy limit) has no message of its own.
        setError("Saving failed on the server — nothing was stored. Try again, or tell the developer of this site.");
      }
    });
  };

  return (
    <form ref={form} onSubmit={submit} className="space-y-3 rounded-md border border-[#E5E7EB] bg-[#F8F9FA] p-4">
      <input type="hidden" name="developerAccountId" value={developerAccountId} />
      {row && <input type="hidden" name="id" value={row.id} />}
      <div>
        <label className="block text-xs text-[#6B7280] mb-1">Contract PDF {row ? "(optional — replaces the current file)" : ""}</label>
        <input type="file" name="file" accept="application/pdf,.pdf" required={!row} className="text-sm" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-[#6B7280] mb-1">Signed on</label>
          <input type="date" name="signedAt" required value={signedAt} onChange={(e) => setSignedAt(e.target.value)} className={input} />
        </div>
        <div>
          <label className="block text-xs text-[#6B7280] mb-1">Term (months)</label>
          <input type="number" name="termMonths" required min={1} max={MAX_TERM_MONTHS} step={1} value={term} onChange={(e) => setTerm(e.target.value)} className={input} />
        </div>
        <div>
          <label className="block text-xs text-[#6B7280] mb-1">Commission in the contract (optional)</label>
          <input name="commissionPercent" inputMode="decimal" placeholder="e.g. 5" defaultValue={row?.commissionPercent ?? ""} className={input} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-[#374151]">
        <input type="checkbox" name="autoRenew" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
        Automatic prolongation
      </label>
      <div>
        <label className="block text-xs text-[#6B7280] mb-1">Note (optional)</label>
        <input name="note" maxLength={500} defaultValue={row?.note ?? ""} placeholder="e.g. addendum: new commission from 2027" className={input} />
      </div>
      {end && (
        <p className="text-xs text-[#6B7280]">
          {autoRenew
            ? <>First term ends {fmtDay(end)}, then it renews by {months} month{months === 1 ? "" : "s"} each time — no reminders.</>
            : <>Ends {fmtDay(end)}. Reminders by Telegram and email 14 days and 1 day before.</>}
        </p>
      )}
      {error && <p className="text-sm text-[#B91C1C]" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="rounded-md bg-[#1B4B43] px-4 py-2 text-sm font-medium text-white hover:bg-[#163d37] disabled:opacity-50">
          {busy ? "Saving…" : row ? "Save changes" : "Upload contract"}
        </button>
        <button type="button" onClick={onDone} className="rounded-md border border-[#E5E7EB] px-4 py-2 text-sm text-[#374151] hover:bg-white">Cancel</button>
      </div>
    </form>
  );
}

export default function DeveloperContracts({ developerAccountId, contracts, currentId, today, canEdit, developerRate }: {
  developerAccountId: string;
  contracts: ContractRow[]; // newest first, current one included
  currentId: string | null;
  today: string; // Nicosia date from the server, so server and client render the same day
  canEdit: boolean;
  developerRate: number | null;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const current = contracts.find((c) => c.id === currentId) ?? null;
  const status = contractStatus(current, today);
  const history = contracts.filter((c) => c.id !== currentId);

  const remove = (c: ContractRow) => {
    if (!window.confirm(`Remove the contract signed ${fmtDay(c.signedAt)} (${c.fileName})?`)) return;
    start(async () => {
      setError("");
      try {
        const r = await deleteContractAction(c.id);
        if ("error" in r) setError(r.error);
      } catch {
        setError("Removing failed on the server — reload and try again.");
      }
    });
  };

  const actions = (c: ContractRow) => canEdit && (
    <span className="inline-flex gap-1.5">
      <a href={pdfHref(c.id)} target="_blank" rel="noopener noreferrer" className={btn}>Open PDF</a>
      <button type="button" className={btn} disabled={busy} onClick={() => { setEditing(c.id); setAdding(false); }}>Edit</button>
      <button type="button" className={btn} disabled={busy} onClick={() => remove(c)}>Remove</button>
    </span>
  );

  const mismatch = current?.commissionPercent != null && developerRate != null && current.commissionPercent !== developerRate;

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[#111827]">Contract</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status.kind]}`}>{STATUS_LABEL[status.kind]}</span>
        </div>
        {canEdit && !adding && (
          <button type="button" onClick={() => { setAdding(true); setEditing(null); }} className="rounded-md border border-[#1B4B43] px-3 py-1.5 text-sm font-medium text-[#1B4B43] hover:bg-[#1B4B43]/8">
            {current ? "+ Add renewal / addendum" : "+ Upload contract"}
          </button>
        )}
      </div>

      {current && status.kind !== "none" ? (
        editing === current.id ? (
          <ContractForm developerAccountId={developerAccountId} row={current} onDone={() => setEditing(null)} />
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 text-sm text-[#374151]">
              <p>
                Signed {fmtDay(current.signedAt)} · {current.termMonths} month{current.termMonths === 1 ? "" : "s"} ·{" "}
                {current.autoRenew
                  ? <>renews automatically, current term ends {fmtDay(currentTermEnd(current, today))}</>
                  : <>{whenText(status.daysLeft)} — {fmtDay(status.endDate)}</>}
              </p>
              <p className="text-xs text-[#6B7280]">
                {current.fileName} · {kb(current.fileSize)}
                {current.commissionPercent != null && <> · commission in the contract {current.commissionPercent} %</>}
                {current.note && <> · {current.note}</>}
              </p>
              {!current.autoRenew && (current.reminder14SentAt || current.reminder1SentAt) && (
                <p className="text-xs text-[#9CA3AF]">
                  Reminder sent{current.reminder14SentAt ? ` 14 days before (${fmtDay(current.reminder14SentAt.slice(0, 10))})` : ""}
                  {current.reminder1SentAt ? `${current.reminder14SentAt ? "," : ""} 1 day before (${fmtDay(current.reminder1SentAt.slice(0, 10))})` : ""}
                </p>
              )}
              {mismatch && (
                <p className="text-xs text-[#B45309]">
                  ⚠ The contract says {current.commissionPercent} %, the developer rate under Commission is {developerRate} %.
                </p>
              )}
              {current.commissionPercent != null && developerRate == null && (
                <p className="text-xs text-[#B45309]">⚠ No developer rate under Commission yet — the contract says {current.commissionPercent} %.</p>
              )}
            </div>
            {actions(current)}
          </div>
        )
      ) : (
        <p className="text-sm text-[#6B7280]">No contract uploaded yet.</p>
      )}

      {adding && <ContractForm developerAccountId={developerAccountId} onDone={() => setAdding(false)} />}
      {error && <p className="text-sm text-[#B91C1C]" role="alert">{error}</p>}
      {!canEdit && current && <p className="text-xs text-[#9CA3AF]">Only admins can open or change contracts.</p>}

      {history.length > 0 && (
        <details>
          <summary className="cursor-pointer select-none text-sm font-semibold text-[#6B7280]">
            Earlier contracts <span className="font-normal text-[#9CA3AF]">· {history.length}</span>
          </summary>
          <ul className="mt-3 divide-y divide-[#F3F4F6] rounded-md border border-[#E5E7EB]">
            {history.map((c) => (
              <li key={c.id} className="px-3 py-2">
                {editing === c.id ? (
                  <ContractForm developerAccountId={developerAccountId} row={c} onDone={() => setEditing(null)} />
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-[#374151]">
                      Signed {fmtDay(c.signedAt)} · {c.termMonths} months{c.autoRenew ? " · auto-renewing" : (() => { const e = firstTermEnd(c.signedAt, c.termMonths); return ` · ${e < today ? "ended" : "ends"} ${fmtDay(e)}`; })()}
                      <span className="ml-2 text-xs text-[#9CA3AF]">{c.fileName}{c.note ? ` · ${c.note}` : ""}</span>
                    </span>
                    {actions(c)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
