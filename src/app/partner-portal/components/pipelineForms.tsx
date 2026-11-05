"use client";
/** Partner pipeline (2026-11-05): the forms on a FIX client — stage, viewing date, log, follow-up and details. */
import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { LEAD_STATUSES, LOST_REASONS, type LeadStatusValue } from "@/lib/crm/leadStatus";
import { CALL_OUTCOMES, LOGGABLE_TYPES, type LoggableInteractionType } from "@/lib/crm/logRule";
import { FINANCINGS, TIMELINES } from "@/lib/crm/newLeadForm";
import { SALUTATIONS } from "@/lib/crm/editLead";
// Type-only: the four dictionaries stay out of the client bundle (t comes from the server).
import type { PartnerDict, PartnerLocale } from "@/lib/partner/i18n";
import { EDIT_FIELDS, portalDateTime } from "@/lib/partner/pipeline/forms";
import { clientClock, weekRange } from "@/lib/partner/pipeline/view";
import {
  editPipelineClientAction, followUpPipelineAction, logPipelineAction, movePipelineAction, viewingPipelineAction,
} from "../pipelineActions";
import { isErr, type PipelineState } from "../formState";
import { Field, FormError, LANG_OPTIONS, Submit, fill } from "./forms";

const DEAL_STAGES: LeadStatusValue[] = ["RESERVED", "CLOSED"];
const ok = (s: PipelineState) => !!s && "ok" in s;

function Saved({ state, text, unchangedText }: { state: PipelineState; text: string; unchangedText?: string }) {
  if (!state || !("ok" in state)) return null;
  return <span className="pp-saved" role="status">{state.unchanged && unchangedText ? unchangedText : text}</span>;
}

// ─── Stage ───────────────────────────────────────────────────────────────────

export type ProjectOption = { id: string; name: string; town: string | null };

export function StageForm({ t, claimId, status, hasLiveDeal, projects }: {
  t: PartnerDict; claimId: string; status: LeadStatusValue; hasLiveDeal: boolean; projects: ProjectOption[];
}) {
  const P = t.pipeline;
  const [state, action] = useFormState<PipelineState, FormData>(movePipelineAction, null);
  const [to, setTo] = useState<string>("");
  // A saved move re-renders the page with the new stage; start the form over.
  useEffect(() => { if (ok(state)) setTo(""); }, [state]);
  const need = isErr(state) ? state.need : undefined;
  const showDeal = DEAL_STAGES.includes(to as LeadStatusValue) && (!hasLiveDeal || need === "deal");
  return (
    <form action={action} className="pp-form" noValidate>
      <input type="hidden" name="claimId" value={claimId} />
      <FormError t={t} state={state} fields={["to", "lostReason", "viewingAt", "dealProject", "dealPrice"]} />
      <Field t={t} state={state} name="to" label={P.moveTo}>
        {(a) => (
          <select {...a} name="to" value={to} onChange={(e) => setTo(e.target.value)} required>
            <option value="" disabled>{P.stage[status]}</option>
            {LEAD_STATUSES.filter((s) => s !== status).map((s) => <option key={s} value={s}>{P.stage[s]}</option>)}
          </select>
        )}
      </Field>
      {to === "LOST" && (
        <Field t={t} state={state} name="lostReason" label={P.lostReasonLabel}>
          {(a) => (
            <select {...a} name="lostReason" defaultValue="" required>
              <option value="" disabled>{P.lostReasonPlaceholder}</option>
              {LOST_REASONS.map((r) => <option key={r} value={r}>{P.lostReason[r]}</option>)}
            </select>
          )}
        </Field>
      )}
      {to === "VIEWING_SCHEDULED" && (
        <Field t={t} state={state} name="viewingAt" label={P.viewingAt}>
          {(a) => <input {...a} type="datetime-local" name="viewingAt" required />}
        </Field>
      )}
      {showDeal && (
        <fieldset className="pp-fieldset">
          <legend>{P.dealTitle}</legend>
          <small className="pp-hint">{P.dealHint}</small>
          <Field t={t} state={state} name="dealProject" label={P.dealProject}>
            {(a) => (
              <select {...a} name="dealProject" defaultValue="" required>
                <option value="" disabled>{P.dealProjectPlaceholder}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.town ? ` · ${p.town}` : ""}</option>)}
              </select>
            )}
          </Field>
          <div className="pp-row">
            <Field t={t} state={state} name="dealUnit" label={P.dealUnit}>
              {(a) => <input {...a} name="dealUnit" maxLength={80} />}
            </Field>
            <Field t={t} state={state} name="dealPrice" label={P.dealPrice}>
              {(a) => <input {...a} name="dealPrice" inputMode="numeric" maxLength={16} required />}
            </Field>
          </div>
        </fieldset>
      )}
      {need === "confirmCancel" && to !== "" && (
        <label className="pp-check">
          <input type="checkbox" name="confirmCancel" value="1" required />
          <span>{fill(P.confirmCancel, isErr(state) && state.vars ? state.vars : { n: "1" })}</span>
        </label>
      )}
      <div className="pp-actions">
        <Submit wide={false}>{P.move}</Submit>
        <Saved state={state} text={P.moved} />
      </div>
    </form>
  );
}

// ─── Viewing date (a viewing already scheduled) ─────────────────────────────

export function ViewingForm({ t, claimId, value }: { t: PartnerDict; claimId: string; value: string }) {
  const P = t.pipeline;
  const [state, action] = useFormState<PipelineState, FormData>(viewingPipelineAction, null);
  return (
    <form action={action} className="pp-form" noValidate>
      <input type="hidden" name="claimId" value={claimId} />
      <FormError t={t} state={state} fields={["viewingAt"]} />
      <Field t={t} state={state} name="viewingAt" label={P.viewingChange}>
        {(a) => <input {...a} type="datetime-local" name="viewingAt" defaultValue={value} required />}
      </Field>
      <div className="pp-actions">
        <Submit wide={false}>{P.viewingSave}</Submit>
        <Saved state={state} text={P.viewingSaved} />
      </div>
    </form>
  );
}

// ─── Log ─────────────────────────────────────────────────────────────────────

// A saved entry starts a fresh, empty form (new key), which then says "saved" until the next submit.
export function LogForm({ t, claimId }: { t: PartnerDict; claimId: string }) {
  const [round, setRound] = useState(0);
  return <LogFormInner key={round} t={t} claimId={claimId} justSaved={round > 0} onSaved={() => setRound((r) => r + 1)} />;
}

function LogFormInner({ t, claimId, justSaved, onSaved }: { t: PartnerDict; claimId: string; justSaved: boolean; onSaved: () => void }) {
  const P = t.pipeline;
  const [state, action] = useFormState<PipelineState, FormData>(logPipelineAction, null);
  const [type, setType] = useState<LoggableInteractionType>("CALL");
  useEffect(() => { if (ok(state)) onSaved(); }, [state, onSaved]);
  const outbound = type === "CALL" || type === "WHATSAPP_OUT" || type === "EMAIL_OUT";
  return (
    <form action={action} className="pp-form" noValidate>
      <input type="hidden" name="claimId" value={claimId} />
      <FormError t={t} state={state} fields={["type", "body", "occurredAt"]} />
      <div className="pp-row">
        <Field t={t} state={state} name="type" label={P.logTypeLabel}>
          {(a) => (
            <select {...a} name="type" value={type} onChange={(e) => setType(e.target.value as LoggableInteractionType)}>
              {LOGGABLE_TYPES.map((x) => <option key={x} value={x}>{P.logType[x]}</option>)}
            </select>
          )}
        </Field>
        {type === "CALL" && (
          <Field t={t} state={state} name="callOutcome" label={P.callOutcomeLabel}>
            {(a) => (
              <select {...a} name="callOutcome" defaultValue="">
                <option value="">{P.callOutcomeNone}</option>
                {CALL_OUTCOMES.map((o) => <option key={o} value={o}>{P.callOutcome[o]}</option>)}
              </select>
            )}
          </Field>
        )}
      </div>
      {type.startsWith("EMAIL_") && (
        <Field t={t} state={state} name="subject" label={P.logSubject}>
          {(a) => <input {...a} name="subject" maxLength={300} />}
        </Field>
      )}
      <Field t={t} state={state} name="body" label={P.logBody}>
        {(a) => <textarea {...a} name="body" rows={3} maxLength={4000} />}
      </Field>
      <div className="pp-row">
        <Field t={t} state={state} name="occurredAt" label={P.logWhen}>
          {(a) => <input {...a} type="datetime-local" name="occurredAt" />}
        </Field>
        {outbound && type !== "CALL" && (
          <label className="pp-check pp-check-inline">
            <input type="checkbox" name="leadReacted" value="1" />
            <span>{P.logReacted}</span>
          </label>
        )}
      </div>
      <p className="pp-hint">{P.logHint}</p>
      <div className="pp-actions">
        <Submit wide={false}>{P.logSave}</Submit>
        {justSaved && !state && <span className="pp-saved" role="status">{P.logSaved}</span>}
      </div>
    </form>
  );
}

// ─── Follow-up ───────────────────────────────────────────────────────────────

export function FollowUpForm({ t, locale, claimId, value, zone }: {
  t: PartnerDict; locale: PartnerLocale; claimId: string; value: string; zone: string | null;
}) {
  const P = t.pipeline;
  const [state, action] = useFormState<PipelineState, FormData>(followUpPipelineAction, null);
  const [typed, setTyped] = useState(value);
  useEffect(() => setTyped(value), [value]);
  const at = portalDateTime(typed);
  const week = at ? weekRange(at) : null;
  const d = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", timeZone: "UTC" });
  return (
    <form action={action} className="pp-form" noValidate>
      <input type="hidden" name="claimId" value={claimId} />
      <FormError t={t} state={state} fields={["at"]} />
      <Field t={t} state={state} name="at" label={P.followUpAt}>
        {(a) => <input {...a} type="datetime-local" name="at" value={typed} onChange={(e) => setTyped(e.target.value)} />}
      </Field>
      {at && (
        <p className="pp-hint" aria-live="polite">
          {week && fill(P.week, { n: String(week.week), from: d.format(week.monday), to: d.format(week.friday) })}
          {zone && <> · {fill(P.followUpClient, clientClock(zone, at, locale))}</>}
        </p>
      )}
      <div className="pp-actions">
        <Submit wide={false}>{P.followUpSave}</Submit>
        {value && (
          <button type="submit" name="clear" value="1" className="pp-btn pp-btn-ghost">{P.followUpClear}</button>
        )}
        <Saved state={state} text={P.followUpSaved} />
      </div>
    </form>
  );
}

// ─── Client details ──────────────────────────────────────────────────────────

export type ClientValues = {
  salutation: string | null; firstName: string; lastName: string | null; email: string | null; phone: string | null;
  languagePreference: string | null; budgetMin: number | null; budgetMax: number | null; timeline: string | null;
  financing: string | null; nationality: string | null; countryOfResidence: string | null; message: string | null;
};

const EDIT_FIELD_NAMES: string[] = [...EDIT_FIELDS];

export function ClientDataForm({ t, claimId, values }: { t: PartnerDict; claimId: string; values: ClientValues }) {
  const P = t.pipeline;
  const F = P.field;
  const [state, action] = useFormState<PipelineState, FormData>(editPipelineClientAction, null);
  // A language the form does not offer (kept from before) stays selectable so saving does not drop it.
  const langs = values.languagePreference && !LANG_OPTIONS.some(([c]) => c === values.languagePreference)
    ? [...LANG_OPTIONS, [values.languagePreference, values.languagePreference] as [string, string]]
    : LANG_OPTIONS;
  return (
    <form action={action} className="pp-form" noValidate>
      <input type="hidden" name="claimId" value={claimId} />
      <FormError t={t} state={state} fields={EDIT_FIELD_NAMES} />
      <div className="pp-row">
        <Field t={t} state={state} name="salutation" label={F.salutation}>
          {(a) => (
            <select {...a} name="salutation" defaultValue={values.salutation ?? "UNKNOWN"}>
              {SALUTATIONS.map((s) => <option key={s} value={s}>{P.salutation[s]}</option>)}
            </select>
          )}
        </Field>
        <Field t={t} state={state} name="languagePreference" label={F.language}>
          {(a) => (
            <select {...a} name="languagePreference" defaultValue={values.languagePreference ?? ""}>
              <option value="">{P.notSet}</option>
              {langs.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          )}
        </Field>
      </div>
      <div className="pp-row">
        <Field t={t} state={state} name="firstName" label={F.firstName}>
          {(a) => <input {...a} name="firstName" maxLength={80} defaultValue={values.firstName} required autoComplete="off" />}
        </Field>
        <Field t={t} state={state} name="lastName" label={F.lastName}>
          {(a) => <input {...a} name="lastName" maxLength={80} defaultValue={values.lastName ?? ""} autoComplete="off" />}
        </Field>
      </div>
      <div className="pp-row">
        <Field t={t} state={state} name="email" label={F.email}>
          {(a) => <input {...a} name="email" type="email" maxLength={200} defaultValue={values.email ?? ""} autoComplete="off" />}
        </Field>
        <Field t={t} state={state} name="phone" label={F.phone}>
          {(a) => <input {...a} name="phone" type="tel" maxLength={40} defaultValue={values.phone ?? ""} autoComplete="off" />}
        </Field>
      </div>
      <div className="pp-row">
        <Field t={t} state={state} name="budgetMin" label={F.budgetMin}>
          {(a) => <input {...a} name="budgetMin" inputMode="numeric" maxLength={16} defaultValue={values.budgetMin ?? ""} />}
        </Field>
        <Field t={t} state={state} name="budgetMax" label={F.budgetMax}>
          {(a) => <input {...a} name="budgetMax" inputMode="numeric" maxLength={16} defaultValue={values.budgetMax ?? ""} />}
        </Field>
      </div>
      <div className="pp-row">
        <Field t={t} state={state} name="timeline" label={F.timeline}>
          {(a) => (
            <select {...a} name="timeline" defaultValue={values.timeline ?? ""}>
              <option value="">{P.notSet}</option>
              {TIMELINES.map((x) => <option key={x} value={x}>{P.timeline[x]}</option>)}
            </select>
          )}
        </Field>
        <Field t={t} state={state} name="financing" label={F.financing}>
          {(a) => (
            <select {...a} name="financing" defaultValue={values.financing ?? ""}>
              <option value="">{P.notSet}</option>
              {FINANCINGS.map((x) => <option key={x} value={x}>{P.financing[x]}</option>)}
            </select>
          )}
        </Field>
      </div>
      <div className="pp-row">
        <Field t={t} state={state} name="nationality" label={F.nationality}>
          {(a) => <input {...a} name="nationality" maxLength={80} defaultValue={values.nationality ?? ""} />}
        </Field>
        <Field t={t} state={state} name="countryOfResidence" label={F.countryOfResidence}>
          {(a) => <input {...a} name="countryOfResidence" maxLength={80} defaultValue={values.countryOfResidence ?? ""} />}
        </Field>
      </div>
      <Field t={t} state={state} name="message" label={F.message}>
        {(a) => <textarea {...a} name="message" rows={4} maxLength={4000} defaultValue={values.message ?? ""} />}
      </Field>
      <div className="pp-actions">
        <Submit wide={false}>{P.dataSave}</Submit>
        <Saved state={state} text={P.dataSaved} unchangedText={P.dataUnchanged} />
      </div>
    </form>
  );
}
