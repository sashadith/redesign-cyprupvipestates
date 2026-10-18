"use client";
/** Phase 3e: branding (profile) and "New presentation" forms, plus the revoke button. */
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import type { PartnerDict, PartnerLocale } from "@/lib/partner/i18n";
import { presentationPreviewUrl } from "@/lib/partner/presentationBranding";
import { removeBrandLogoAction, saveBrandAction, uploadBrandLogoAction } from "../brandActions";
import { createPresentationAction, revokePresentationAction } from "../presentationActions";
import { isErr, type BrandState, type LogoState, type PresentationState } from "../formState";
import { CopyLink, Field, FormError, LANG_OPTIONS, Submit, fill, say } from "./forms";

// Mirrors MAX_PRESENTATION_PROJECTS / PERSONAL_NOTE_MAX / GREETING_NAME_MAX (the server re-checks all of them).
const MAX_PROJECTS = 12;
const NOTE_MAX = 600;
const GREETING_MAX = 60;

// ─── Branding ────────────────────────────────────────────────────────────────

export type BrandValues = { brandName: string | null; brandPhone: string | null; brandEmail: string | null; brandWebsite: string | null };

export function BrandForm({ t, values, fallbackName }: { t: PartnerDict; values: BrandValues; fallbackName: string }) {
  const B = t.branding;
  const [state, action] = useFormState<BrandState, FormData>(saveBrandAction, null);
  const shown = state && "ok" in state ? state : values;
  const key = [shown.brandName, shown.brandPhone, shown.brandEmail, shown.brandWebsite].join("|");
  return (
    <form action={action} className="pp-form" key={key} noValidate>
      <FormError t={t} state={state} fields={["brandName", "brandPhone", "brandEmail", "brandWebsite"]} />
      <Field t={t} state={state} name="brandName" label={B.brandName} hint={B.brandNameHint}>
        {(a) => <input {...a} name="brandName" maxLength={80} defaultValue={shown.brandName ?? ""} placeholder={fallbackName} autoComplete="organization" />}
      </Field>
      <div className="pp-row">
        <Field t={t} state={state} name="brandPhone" label={B.phone}>
          {(a) => <input {...a} name="brandPhone" type="tel" maxLength={40} defaultValue={shown.brandPhone ?? ""} autoComplete="tel" />}
        </Field>
        <Field t={t} state={state} name="brandEmail" label={B.email}>
          {(a) => <input {...a} name="brandEmail" type="email" maxLength={254} defaultValue={shown.brandEmail ?? ""} autoComplete="email" />}
        </Field>
      </div>
      <Field t={t} state={state} name="brandWebsite" label={B.website} hint={B.websiteHint}>
        {(a) => <input {...a} name="brandWebsite" type="url" maxLength={200} defaultValue={shown.brandWebsite ?? ""} placeholder="https://" autoComplete="url" />}
      </Field>
      <div className="pp-actions">
        <Submit wide={false}>{B.save}</Submit>
        {state && "ok" in state && <span className="pp-saved" role="status">{B.saved}</span>}
      </div>
    </form>
  );
}

/** `logoSrc`: the partner's own logo (portal route), or null when none is stored. */
export function LogoForm({ t, logoSrc }: { t: PartnerDict; logoSrc: string | null }) {
  const B = t.branding;
  const [upState, upload] = useFormState<LogoState, FormData>(uploadBrandLogoAction, null);
  const [rmState, remove] = useFormState<LogoState, FormData>(removeBrandLogoAction, null);
  const err = isErr(upState) ? upState : isErr(rmState) ? rmState : null;
  return (
    <div className="pp-brandlogo">
      <p className="pp-brandlogo-label">{B.logo}</p>
      {logoSrc ? (
        <img className="pp-brandlogo-img" src={logoSrc} alt="" width={160} height={60} />
      ) : (
        <p className="pp-muted">{B.noLogo}</p>
      )}
      {err && <p className="pp-alert pp-alert-error" role="alert">{fill(say(t, err.error), err.vars ?? {})}</p>}
      <form action={upload} className="pp-form pp-brandlogo-form">
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" aria-label={B.logo} aria-describedby="brand-logo-hint" required />
        <small id="brand-logo-hint" className="pp-hint">{B.logoHint}</small>
        <div className="pp-actions">
          <Submit wide={false}>{logoSrc ? B.logoReplace : B.logoUpload}</Submit>
          {upState && "ok" in upState && <span className="pp-saved" role="status">{B.saved}</span>}
        </div>
      </form>
      {logoSrc && (
        <form action={remove}>
          <button type="submit" className="pp-btn pp-btn-ghost">{B.logoRemove}</button>
        </form>
      )}
    </div>
  );
}

// ─── New presentation ────────────────────────────────────────────────────────

export type PresentationClientOption = { claimId: string; name: string; firstName: string; locale: PartnerLocale };
export type PresentationProjectOption = { id: string; name: string; town: string | null };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const FIELDS = ["claimId", "projectIds", "greetingName", "personalNote", "locale"];

export function PresentationForm({ t, clients, projects, defaultLocale }: {
  t: PartnerDict;
  clients: PresentationClientOption[];
  projects: PresentationProjectOption[];
  defaultLocale: PartnerLocale;
}) {
  const [round, setRound] = useState(0);
  return <PresentationFormInner key={round} t={t} clients={clients} projects={projects} defaultLocale={defaultLocale} onAgain={() => setRound((r) => r + 1)} />;
}

function PresentationFormInner({ t, clients, projects, defaultLocale, onAgain }: {
  t: PartnerDict;
  clients: PresentationClientOption[];
  projects: PresentationProjectOption[];
  defaultLocale: PartnerLocale;
  onAgain: () => void;
}) {
  const P = t.presentations;
  const S = t.submit;
  const [state, action] = useFormState<PresentationState, FormData>(createPresentationAction, null);
  const [claimId, setClaimId] = useState("");
  const [greeting, setGreeting] = useState("");
  const [locale, setLocale] = useState<string>(defaultLocale);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const errOn = (name: string) => (isErr(state) && state.field === name ? say(t, state.error) : null);

  if (state && "ok" in state) {
    return (
      <div className="pp-done" role="status">
        <h2>{P.created}</h2>
        <CopyLink value={state.url} copyLabel={P.copyLink} copiedLabel={P.copied} />
        <div className="pp-cta">
          <a className="pp-btn pp-btn-ghost" href={presentationPreviewUrl(state.url)} target="_blank" rel="noopener noreferrer">{P.open}</a>
          <button type="button" className="pp-btn pp-btn-ghost" onClick={onAgain}>{P.newTitle}</button>
        </div>
      </div>
    );
  }
  if (!clients.length) return <p className="pp-alert pp-alert-neutral">{P.noClients}</p>;

  const pickClient = (id: string) => {
    setClaimId(id);
    const c = clients.find((x) => x.claimId === id);
    if (c) {
      setGreeting(c.firstName.slice(0, GREETING_MAX));
      setLocale(c.locale);
    }
  };
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => (on ? (s.includes(id) || s.length >= MAX_PROJECTS ? s : [...s, id]) : s.filter((x) => x !== id)));
  const q = norm(query.trim());
  const visible = projects.filter((p) => !q || selected.includes(p.id) || norm(`${p.name} ${p.town ?? ""}`).includes(q));
  const projectsErr = errOn("projectIds");

  return (
    <form action={action} className="pp-form" noValidate>
      <FormError t={t} state={state} fields={FIELDS} />
      <Field t={t} state={state} name="claimId" label={P.client}>
        {(a) => (
          <select {...a} name="claimId" value={claimId} onChange={(e) => pickClient(e.target.value)} required>
            <option value="" disabled>{P.clientPlaceholder}</option>
            {clients.map((c) => <option key={c.claimId} value={c.claimId}>{c.name || "—"}</option>)}
          </select>
        )}
      </Field>

      <fieldset className={projectsErr ? "pp-fieldset pp-field-bad" : "pp-fieldset"} aria-describedby="f-pres-projects-hint">
        <legend>{P.projects}</legend>
        <small id="f-pres-projects-hint" className="pp-hint">{P.projectsHint}</small>
        {/* Selection order is the presentation order: hidden inputs, not the checkboxes, carry the ids. */}
        {selected.map((id) => <input key={id} type="hidden" name="projectIds" value={id} />)}
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
            const on = selected.includes(p.id);
            return (
              <li key={p.id}>
                <label className={on ? "pp-proj pp-proj-on" : "pp-proj"}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && selected.length >= MAX_PROJECTS}
                    onChange={(e) => toggle(p.id, e.target.checked)}
                  />
                  <span className="pp-proj-name">{p.name}{p.town ? <span className="pp-proj-town"> · {p.town}</span> : null}</span>
                </label>
              </li>
            );
          })}
          {visible.length === 0 && <li className="pp-muted pp-proj-empty">{S.projectsEmpty}</li>}
        </ul>
        {projectsErr && <small className="pp-err" role="alert">{projectsErr}</small>}
      </fieldset>

      <div className="pp-row">
        <Field t={t} state={state} name="greetingName" label={P.greetingName} hint={P.greetingNameHint}>
          {(a) => <input {...a} name="greetingName" maxLength={GREETING_MAX} value={greeting} onChange={(e) => setGreeting(e.target.value)} required />}
        </Field>
        <Field t={t} state={state} name="locale" label={P.language}>
          {(a) => (
            <select {...a} name="locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
              {LANG_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          )}
        </Field>
      </div>
      <Field t={t} state={state} name="personalNote" label={P.personalNote} hint={P.personalNoteHint}>
        {(a) => <textarea {...a} name="personalNote" rows={4} maxLength={NOTE_MAX} />}
      </Field>
      <p className="pp-muted pp-small">{P.validity} {P.brandingHint}</p>
      <div className="pp-actions">
        <Submit wide={false}>{P.create}</Submit>
      </div>
    </form>
  );
}

// ─── Revoke ──────────────────────────────────────────────────────────────────

export function RevokeButton({ id, label, confirmText }: { id: string; label: string; confirmText: string }) {
  return (
    <form
      action={revokePresentationAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="pp-linkbtn pp-danger">{label}</button>
    </form>
  );
}
