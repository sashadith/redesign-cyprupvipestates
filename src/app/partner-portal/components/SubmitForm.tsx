"use client";
/**
 * Submit-client form (partner portal phase 3b). Works without JavaScript: the mode tabs and the
 * contact-mode choice are plain radios (rep fields revealed by CSS :has), the project list is a
 * list of real checkboxes. JavaScript adds the search filter, the single-project rule for Fix,
 * the selection chips and the commission estimate.
 */
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import type { PartnerDict, PartnerLocale } from "@/lib/partner/i18n";
import { parseBudgetField } from "@/lib/partner/budgetField";
import type { ContactMode, SubmissionMode } from "@/lib/partner/submission";
import { submitClientAction } from "../submitActions";
import { isErr } from "../formState";
import { Field, FormError, LANG_OPTIONS, Submit, fill, say } from "./forms";

export type SubmitProject = {
  id: string;
  name: string;
  town: string | null;
  handoverRate: number | null;
  fixRate: number | null;
  ourRate: number | null;
};

type Props = {
  t: PartnerDict;
  locale: PartnerLocale;
  projects: SubmitProject[];
  handoverShare: number;
  fixShare: number;
  trustMode: boolean;
};

const MAX_PROJECTS = 10;
const SHOWN = [
  "mode", "firstName", "lastName", "email", "phone", "language", "budgetMin", "budgetMax", "projectIds", "projectsText",
  "contactMode", "repName", "repPhone", "comment", "consent",
];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function SubmitForm({ t, locale, projects, handoverShare, fixShare, trustMode }: Props) {
  const S = t.submit;
  const [state, action] = useFormState(submitClientAction, null);
  const [mode, setMode] = useState<SubmissionMode>("HANDOVER");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState({ min: "", max: "" });

  const pct = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);
  const eur = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }), [locale]);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const q = norm(query.trim());

  const errOn = (name: string) => (isErr(state) && state.field === name ? say(t, state.error) : null);

  if (state && "ok" in state) {
    return (
      <div className="pp-done" role="status">
        {state.alreadyYours ? (
          <h2>{S.alreadyYours}</h2>
        ) : (
          <>
            <h2>{fill(S.thanks, { name: state.name })}</h2>
            <p>{S.thanksText}</p>
          </>
        )}
        <div className="pp-cta">
          <a className="pp-btn" href="/clients">{S.toClients}</a>
          <a className="pp-btn pp-btn-ghost" href="/submit">{S.another}</a>
        </div>
      </div>
    );
  }

  const switchMode = (m: SubmissionMode) => {
    setMode(m);
    if (m === "FIX") setSelected((s) => s.slice(0, 1));
  };
  const toggle = (id: string, on: boolean) => {
    if (mode === "FIX") setSelected(on ? [id] : []);
    else setSelected((s) => (on ? (s.includes(id) || s.length >= MAX_PROJECTS ? s : [...s, id]) : s.filter((x) => x !== id)));
  };

  // Estimate: exactly one project with a known rate, and at least one valid budget figure.
  const one = selected.length === 1 ? byId.get(selected[0]) : undefined;
  const rate = one ? (mode === "FIX" ? one.fixRate : one.handoverRate) : null;
  const figures = [parseBudgetField(budget.min), parseBudgetField(budget.max)].filter((n): n is number => typeof n === "number" && n > 0);
  let estimate: string | null = null;
  if (rate != null && figures.length) {
    const amounts = Array.from(new Set(figures.map((b) => Math.round((b * rate) / 100)))).sort((a, b) => a - b);
    estimate = amounts.map((a) => eur.format(a)).join(" – ");
  }

  const tab = (m: SubmissionMode, title: string, text: string, share: number) => (
    <label className="pp-tab">
      <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => switchMode(m)} />
      <span className="pp-tab-title">{title}</span>
      <span className="pp-tab-text">{text}</span>
      <span className="pp-tab-share">{fill(S.shareLine, { share: pct.format(share) })}</span>
    </label>
  );
  const contact = (m: ContactMode, label: string) => (
    <label className="pp-radio">
      <input type="radio" name="contactMode" value={m} defaultChecked={m === "DIRECT"} />
      <span>{label}</span>
    </label>
  );
  const [consentBefore, consentAfter = ""] = S.consent.split("{agreement}");
  const projectsErr = errOn("projectIds");
  const modeErr = errOn("mode");
  const contactErr = errOn("contactMode");
  const consentErr = errOn("consent");
  const visible = projects.filter((p) => !q || selected.includes(p.id) || norm(`${p.name} ${p.town ?? ""}`).includes(q));

  return (
    <form action={action} className="pp-form pp-submit" noValidate>
      <FormError t={t} state={state} fields={SHOWN} />

      <fieldset className="pp-fieldset">
        <legend>{S.modeTitle}</legend>
        <div className="pp-tabs">
          {tab("HANDOVER", S.tabHandover, S.modeHandover, handoverShare)}
          {tab("FIX", S.tabFix, S.modeFix, fixShare)}
        </div>
        {modeErr && <small className="pp-err" role="alert">{modeErr}</small>}
      </fieldset>

      <fieldset className="pp-fieldset">
        <legend>{S.clientDetails}</legend>
        <div className="pp-row">
          <Field t={t} state={state} name="firstName" label={S.firstName}>
            {(a) => <input {...a} name="firstName" autoComplete="off" maxLength={80} required />}
          </Field>
          <Field t={t} state={state} name="lastName" label={S.lastName}>
            {(a) => <input {...a} name="lastName" autoComplete="off" maxLength={80} />}
          </Field>
        </div>
        <div className="pp-row">
          <Field t={t} state={state} name="email" label={S.email}>
            {(a) => <input {...a} name="email" type="email" autoComplete="off" maxLength={254} />}
          </Field>
          <Field t={t} state={state} name="phone" label={S.phone}>
            {(a) => <input {...a} name="phone" type="tel" inputMode="tel" autoComplete="off" maxLength={40} />}
          </Field>
        </div>
        <Field t={t} state={state} name="language" label={S.language}>
          {(a) => (
            <select {...a} name="language" defaultValue="">
              <option value="">{S.languageNone}</option>
              {LANG_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          )}
        </Field>
        <div className="pp-row">
          <Field t={t} state={state} name="budgetMin" label={S.budgetMin}>
            {(a) => (
              <input {...a} name="budgetMin" inputMode="numeric" autoComplete="off" maxLength={24}
                onChange={(e) => setBudget((b) => ({ ...b, min: e.target.value }))} />
            )}
          </Field>
          <Field t={t} state={state} name="budgetMax" label={S.budgetMax}>
            {(a) => (
              <input {...a} name="budgetMax" inputMode="numeric" autoComplete="off" maxLength={24}
                onChange={(e) => setBudget((b) => ({ ...b, max: e.target.value }))} />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className={projectsErr ? "pp-fieldset pp-field-bad" : "pp-fieldset"} aria-describedby="f-projects-hint">
        <legend>{S.projects}</legend>
        <small id="f-projects-hint" className="pp-hint">{mode === "FIX" ? S.projectsHintFix : S.projectsHint}</small>
        {projects.length === 0 ? (
          <p className="pp-muted">{S.projectsNone}</p>
        ) : (
          <>
            <input
              type="search"
              className="pp-search"
              placeholder={S.projectsSearch}
              aria-label={S.projectsSearch}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {selected.length > 0 && (
              <div className="pp-chips" aria-live="polite">
                <span className="pp-chips-count">{fill(S.projectsSelected, { count: String(selected.length) })}</span>
                {selected.map((id) => {
                  const p = byId.get(id);
                  return p ? (
                    <button key={id} type="button" className="pp-chip" aria-label={fill(S.remove, { name: p.name })} onClick={() => toggle(id, false)}>
                      {p.name} <span aria-hidden="true">×</span>
                    </button>
                  ) : null;
                })}
              </div>
            )}
            <ul className="pp-projects">
              {visible.map((p) => {
                const r = mode === "FIX" ? p.fixRate : p.handoverRate;
                const on = selected.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className={on ? "pp-proj pp-proj-on" : "pp-proj"}>
                      <input
                        type={mode === "FIX" ? "radio" : "checkbox"}
                        name="projectIds"
                        value={p.id}
                        checked={on}
                        disabled={!on && mode === "HANDOVER" && selected.length >= MAX_PROJECTS}
                        onChange={(e) => toggle(p.id, e.target.checked)}
                      />
                      <span className="pp-proj-name">{p.name}{p.town ? <span className="pp-proj-town"> · {p.town}</span> : null}</span>
                      <span className="pp-proj-rate">
                        {r == null ? S.rateOnRequest : fill(S.yourRate, { rate: pct.format(r) })}
                        {trustMode && p.ourRate != null ? <> · {fill(S.ourRate, { rate: pct.format(p.ourRate) })}</> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
              {visible.length === 0 && <li className="pp-muted pp-proj-empty">{S.projectsEmpty}</li>}
            </ul>
          </>
        )}
        {projectsErr && <small className="pp-err" role="alert">{projectsErr}</small>}
        {estimate && <p className="pp-estimate" aria-live="polite">{fill(S.estimate, { amount: estimate })}</p>}
      </fieldset>

      <Field t={t} state={state} name="projectsText" label={S.projectsText}>
        {(a) => <input {...a} name="projectsText" autoComplete="off" maxLength={300} />}
      </Field>

      <fieldset className="pp-fieldset">
        <legend>{S.contactModeTitle}</legend>
        <div className="pp-radios">
          {contact("DIRECT", S.contactDirect)}
          {contact("VIA_PARTNER", S.contactViaPartner)}
          {contact("VIA_PARTNER_REP", S.contactViaPartnerRep)}
          {contact("VIA_CLIENT_REP", S.contactViaClientRep)}
        </div>
        {contactErr && <small className="pp-err" role="alert">{contactErr}</small>}
        <div className="pp-row pp-rep">
          <Field t={t} state={state} name="repName" label={S.repName}>
            {(a) => <input {...a} name="repName" autoComplete="off" maxLength={80} />}
          </Field>
          <Field t={t} state={state} name="repPhone" label={S.repPhone}>
            {(a) => <input {...a} name="repPhone" type="tel" inputMode="tel" autoComplete="off" maxLength={40} />}
          </Field>
        </div>
      </fieldset>

      <Field t={t} state={state} name="comment" label={S.comment}>
        {(a) => <textarea {...a} name="comment" rows={4} maxLength={2000} />}
      </Field>

      <div className={consentErr ? "pp-check pp-field-bad" : "pp-check"}>
        <input id="f-consent" type="checkbox" name="consent" required aria-invalid={consentErr ? true : undefined} />
        <label htmlFor="f-consent">
          {consentBefore}
          <a href="/agreement" target="_blank" rel="noopener noreferrer">{S.consentLink}</a>
          {consentAfter}
        </label>
        {consentErr && <small className="pp-err" role="alert">{consentErr}</small>}
      </div>

      <Submit>{S.submit}</Submit>
    </form>
  );
}
