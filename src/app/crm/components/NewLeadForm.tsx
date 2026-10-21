"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createLeadAction, type CreateLeadResult } from "../leads/actions";
import { FINANCINGS, NEW_LEAD_LANGUAGES, TIMELINES } from "@/lib/crm/newLeadForm";
import { intakeToFormPatch } from "@/lib/crm/ai/intakePrefill";
import type { IntakeFields } from "@/lib/crm/ai/intake";
import { LeadIntake } from "./LeadIntake";

// New lead in the new CRM (Phase 2c). Validation lives in newLeadForm.ts and is
// re-run by the server action; this form only shows what comes back.

const TIMELINE_LABEL: Record<(typeof TIMELINES)[number], string> = {
  IMMEDIATE: "Immediately", THREE_MONTHS: "Within 3 months", SIX_MONTHS: "Within 6 months", ONE_YEAR: "Within a year", TWO_YEARS: "Within 2 years", JUST_LOOKING: "Just looking",
};
const FINANCING_LABEL: Record<(typeof FINANCINGS)[number], string> = { CASH: "Cash", MORTGAGE: "Mortgage", UNDECIDED: "Undecided" };

type Dup = Extract<CreateLeadResult, { duplicate: unknown }>["duplicate"];

const budget = (v: string): number | null | "bad" => {
  const t = v.replace(/[\s,]/g, "");
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : "bad";
};

export function NewLeadForm({ canAssign, staff }: { canAssign: boolean; staff: { id: string; name: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", languagePreference: "", budgetMin: "", budgetMax: "", timeline: "", financing: "", message: "", notes: "", ownerId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [dup, setDup] = useState<Dup | null>(null);
  // Created, but the hand-over to the chosen owner failed: stay here and say so.
  const [created, setCreated] = useState<{ id: string; warning: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const err = (k: string) => (error?.field === k ? error.text : null);

  // Claude intake: fill only what is still empty, report what was filled.
  const prefill = (fields: IntakeFields) => {
    const { patch, filled } = intakeToFormPatch(f, fields);
    if (filled.length) setF((p) => ({ ...p, ...patch }));
    return filled;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || created) return;
    setError(null); setDup(null);
    const min = budget(f.budgetMin), max = budget(f.budgetMax);
    if (min === "bad") { setError({ text: "Budget must be a whole number, 0 or more.", field: "budgetMin" }); return; }
    if (max === "bad") { setError({ text: "Budget must be a whole number, 0 or more.", field: "budgetMax" }); return; }
    setBusy(true);
    let res: CreateLeadResult;
    try {
      res = await createLeadAction({
        firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone,
        languagePreference: f.languagePreference, budgetMin: min, budgetMax: max,
        timeline: f.timeline, financing: f.financing, message: f.message, notes: f.notes,
        ...(canAssign ? { ownerId: f.ownerId } : {}),
      });
    } catch {
      res = { error: "Could not save — check your connection and try again." };
    } finally {
      setBusy(false);
    }
    if ("duplicate" in res) { setDup(res.duplicate); return; }
    if ("error" in res) { setError({ text: res.error, field: res.field }); return; }
    if (res.assignWarning) { setCreated({ id: res.id, warning: res.assignWarning }); return; }
    router.push(`/crm/leads/${res.id}?created=1`);
  }

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="crm-ck-field">
      <span>{label}</span>
      <input value={f[k]} onChange={set(k)} aria-invalid={err(k) ? true : undefined} {...props} />
      {err(k) && <em className="crm-ck-error" role="alert">{err(k)}</em>}
    </label>
  );

  return (
    <form className="crm-panel crm-nl" onSubmit={submit} noValidate>
      <LeadIntake onExtract={prefill} />
      {dup && (
        <div className="crm-nl-dup" role="alert">
          <b>This contact is already in the CRM</b>
          <p>
            {dup.id && dup.name
              ? <>A contact with the same {dup.matchedOn} is already in the CRM: <Link href={`/crm/leads/${dup.id}`}>{dup.name}</Link>.</>
              : <>A contact with the same {dup.matchedOn} is already in the CRM. Ask a manager to open it before contacting them.</>}
          </p>
        </div>
      )}
      {created && (
        <div className="crm-nl-dup" role="alert">
          <b>Lead created, but the owner was not assigned</b>
          <p>{created.warning} <Link href={`/crm/leads/${created.id}`}>Open the lead</Link> to assign it.</p>
        </div>
      )}
      <fieldset disabled={busy || !!created} className="crm-nl-grid">
        {field("firstName", "First name", { maxLength: 80, autoComplete: "off", required: true })}
        {field("lastName", "Last name", { maxLength: 80, autoComplete: "off" })}
        {field("email", "Email", { type: "email", maxLength: 200, autoComplete: "off", inputMode: "email" })}
        {field("phone", "Phone", { type: "tel", maxLength: 40, autoComplete: "off", inputMode: "tel" })}
        <label className="crm-ck-field">
          <span>Language</span>
          <select value={f.languagePreference} onChange={set("languagePreference")}>
            <option value="">Not set</option>
            {NEW_LEAD_LANGUAGES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
        </label>
        {canAssign && (
          <label className="crm-ck-field">
            <span>Owner</span>
            <select value={f.ownerId} onChange={set("ownerId")}>
              <option value="">Unassigned → inbox</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {err("ownerId") && <em className="crm-ck-error" role="alert">{err("ownerId")}</em>}
          </label>
        )}
        {field("budgetMin", "Budget from (EUR)", { inputMode: "numeric", autoComplete: "off" })}
        {field("budgetMax", "Budget to (EUR)", { inputMode: "numeric", autoComplete: "off" })}
        <label className="crm-ck-field">
          <span>Timeline</span>
          <select value={f.timeline} onChange={set("timeline")}>
            <option value="">Not set</option>
            {TIMELINES.map((t) => <option key={t} value={t}>{TIMELINE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="crm-ck-field">
          <span>Financing</span>
          <select value={f.financing} onChange={set("financing")}>
            <option value="">Not set</option>
            {FINANCINGS.map((t) => <option key={t} value={t}>{FINANCING_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="crm-ck-field crm-nl-wide">
          <span>What the lead asked for</span>
          <textarea value={f.message} maxLength={4000} rows={3} onChange={set("message")} />
        </label>
        <label className="crm-ck-field crm-nl-wide">
          <span>Internal notes</span>
          <textarea value={f.notes} maxLength={4000} rows={3} onChange={set("notes")} />
        </label>
      </fieldset>
      {error && !error.field && <p className="crm-ck-error" role="alert">{error.text}</p>}
      <div className="crm-nl-actions">
        <Link href="/crm/pipeline" className="crm-btn">Cancel</Link>
        <button type="submit" className="crm-btn primary" disabled={busy || !!created}>{busy ? "Saving…" : "Create lead"}</button>
      </div>
    </form>
  );
}
