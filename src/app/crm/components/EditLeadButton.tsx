"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { updateLeadDetailsAction, type UpdateLeadResult } from "../leads/actions";
import { FINANCINGS, NEW_LEAD_LANGUAGES, TIMELINES } from "@/lib/crm/newLeadForm";
import { SALUTATIONS } from "@/lib/crm/editLead";
import { useToast } from "./Toast";

// "Edit" on the lead cockpit header (2026-10-28): the lead's details in a
// native <dialog>, like "Register". Validation lives in editLead.ts and is
// re-run by the server action; this form only shows what comes back.

export type EditableLead = {
  firstName: string; lastName: string; email: string | null; phone: string | null; salutation: string;
  languagePreference: string | null; budgetMin: number | null; budgetMax: number | null; timeline: string | null; financing: string | null;
  nationality: string | null; countryOfResidence: string | null; message: string | null; notes: string | null;
};

const TIMELINE_LABEL: Record<(typeof TIMELINES)[number], string> = {
  IMMEDIATE: "Immediately", THREE_MONTHS: "Within 3 months", SIX_MONTHS: "Within 6 months", ONE_YEAR: "Within a year", TWO_YEARS: "Within 2 years", JUST_LOOKING: "Just looking",
};
const FINANCING_LABEL: Record<(typeof FINANCINGS)[number], string> = { CASH: "Cash", MORTGAGE: "Mortgage", UNDECIDED: "Undecided" };
const SALUTATION_LABEL: Record<(typeof SALUTATIONS)[number], string> = { UNKNOWN: "Not set", MR: "Mr", MS: "Ms" };

type Dup = Extract<UpdateLeadResult, { duplicate: unknown }>["duplicate"];

const budget = (v: string): number | null | "bad" => {
  const t = v.replace(/[\s,.]/g, "");
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : "bad";
};
const toForm = (l: EditableLead) => ({
  firstName: l.firstName, lastName: l.lastName, email: l.email ?? "", phone: l.phone ?? "", salutation: l.salutation,
  languagePreference: l.languagePreference ?? "", budgetMin: l.budgetMin != null ? String(l.budgetMin) : "", budgetMax: l.budgetMax != null ? String(l.budgetMax) : "",
  timeline: l.timeline ?? "", financing: l.financing ?? "", nationality: l.nationality ?? "", countryOfResidence: l.countryOfResidence ?? "",
  message: l.message ?? "", notes: l.notes ?? "",
});

export function EditLeadButton({ leadId, lead }: { leadId: string; lead: EditableLead }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const [f, setF] = useState(() => toForm(lead));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [dup, setDup] = useState<Dup | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const err = (k: string) => (error?.field === k ? error.text : null);
  // A language the form no longer offers (he) stays selectable only as the current value.
  const languages = lead.languagePreference && !(NEW_LEAD_LANGUAGES as readonly string[]).includes(lead.languagePreference)
    ? [...NEW_LEAD_LANGUAGES, lead.languagePreference] : [...NEW_LEAD_LANGUAGES];

  const open = () => { setF(toForm(lead)); setError(null); setDup(null); dlg.current?.showModal(); };
  const close = () => { if (!busy) dlg.current?.close(); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null); setDup(null);
    const min = budget(f.budgetMin), max = budget(f.budgetMax);
    if (min === "bad") { setError({ text: "Budget must be a whole number, 0 or more.", field: "budgetMin" }); return; }
    if (max === "bad") { setError({ text: "Budget must be a whole number, 0 or more.", field: "budgetMax" }); return; }
    setBusy(true);
    let res: UpdateLeadResult;
    try {
      res = await updateLeadDetailsAction(leadId, { ...f, budgetMin: min, budgetMax: max });
    } catch {
      res = { error: "Could not save — check your connection and try again." };
    } finally {
      setBusy(false);
    }
    if ("duplicate" in res) { setDup(res.duplicate); return; }
    if ("error" in res) { setError({ text: res.error, field: res.field }); return; }
    dlg.current?.close();
    toast.show(res.changed ? `Saved: ${res.changed}` : "Nothing changed.");
  }

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="crm-ck-field">
      <span>{label}</span>
      <input value={f[k]} onChange={set(k)} aria-invalid={err(k) ? true : undefined} {...props} />
      {err(k) && <em className="crm-ck-error" role="alert">{err(k)}</em>}
    </label>
  );
  const select = (k: keyof typeof f, label: string, options: readonly string[], labelOf: (v: string) => string, empty: string | null = "Not set") => (
    <label className="crm-ck-field">
      <span>{label}</span>
      <select value={f[k]} onChange={set(k)} aria-invalid={err(k) ? true : undefined}>
        {empty !== null && <option value="">{empty}</option>}
        {options.map((o) => <option key={o} value={o}>{labelOf(o)}</option>)}
      </select>
      {err(k) && <em className="crm-ck-error" role="alert">{err(k)}</em>}
    </label>
  );

  return (
    <>
      <button type="button" className="crm-btn" onClick={open}>Edit</button>
      <dialog ref={dlg} className="crm-dialog crm-edit-dialog" aria-labelledby="crm-edit-h" onCancel={(e) => { if (busy) e.preventDefault(); }}>
        <form onSubmit={(e) => void submit(e)} noValidate>
          <h2 id="crm-edit-h">Edit lead</h2>
          {dup && (
            <div className="crm-nl-dup" role="alert">
              <b>This contact is already in the CRM</b>
              <p>
                {dup.id && dup.name
                  ? <>Another lead has the same {dup.matchedOn}: <Link href={`/crm/leads/${dup.id}`}>{dup.name}</Link>. Nothing was saved.</>
                  : <>Another lead has the same {dup.matchedOn}. Nothing was saved — ask a manager to check it.</>}
              </p>
            </div>
          )}
          <fieldset disabled={busy} className="crm-nl-grid">
            {field("firstName", "First name", { maxLength: 80, autoComplete: "off", required: true })}
            {field("lastName", "Last name", { maxLength: 80, autoComplete: "off" })}
            {field("email", "Email", { type: "email", maxLength: 200, autoComplete: "off", inputMode: "email" })}
            {field("phone", "Phone", { type: "tel", maxLength: 40, autoComplete: "off", inputMode: "tel" })}
            {select("salutation", "Salutation", SALUTATIONS, (v) => SALUTATION_LABEL[v as (typeof SALUTATIONS)[number]], null)}
            {select("languagePreference", "Language", languages, (v) => v.toUpperCase())}
            {field("budgetMin", "Budget from (€)", { inputMode: "numeric", autoComplete: "off" })}
            {field("budgetMax", "Budget up to (€)", { inputMode: "numeric", autoComplete: "off" })}
            {select("timeline", "Timeline", TIMELINES, (v) => TIMELINE_LABEL[v as (typeof TIMELINES)[number]])}
            {select("financing", "Financing", FINANCINGS, (v) => FINANCING_LABEL[v as (typeof FINANCINGS)[number]])}
            {field("nationality", "Nationality", { maxLength: 80, autoComplete: "off" })}
            {field("countryOfResidence", "Lives in", { maxLength: 80, autoComplete: "off" })}
            <label className="crm-ck-field crm-nl-wide">
              <span>What the lead asked for</span>
              <textarea value={f.message} maxLength={4000} rows={3} onChange={set("message")} />
              {err("message") && <em className="crm-ck-error" role="alert">{err("message")}</em>}
            </label>
            <label className="crm-ck-field crm-nl-wide">
              <span>Internal notes</span>
              <textarea value={f.notes} maxLength={4000} rows={3} onChange={set("notes")} />
              {err("notes") && <em className="crm-ck-error" role="alert">{err("notes")}</em>}
            </label>
          </fieldset>
          {error && !error.field && <p className="crm-dialog-error" role="alert">{error.text}</p>}
          <div className="crm-dialog-actions">
            <button type="button" className="crm-btn" onClick={close} disabled={busy}>Cancel</button>
            <button type="submit" className="crm-btn primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </dialog>
      {toast.node}
    </>
  );
}
