"use client";
/** Partner-portal forms (React 18 / Next 14: useFormState + useFormStatus). */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { PartnerDict, PartnerLocale } from "@/lib/partner/i18n";
import {
  changePasswordAction, forgotAction, loginAction, registerAction, resendVerifyAction, resetAction,
  updateProfileAction, verifyAction,
} from "../actions";
import { saveBankDetailsAction } from "../bankActions";
import { savePartnerSettingsAction } from "../settingsActions";
import { isErr, isOk, type FormState, type SettingsState, type SubmitState } from "../formState";
import { vatIdRequired } from "@/lib/partner/vat";

const LANG_NAMES = new Map<string, string>([
  ["en", "English"],
  ["de", "Deutsch"],
  ["pl", "Polski"],
  ["ru", "Русский"],
]);
// Type-only i18n import above keeps the four dictionaries out of the client bundle.
export const LANG_OPTIONS = Array.from(LANG_NAMES);

/** Resolve a dotted dictionary key against the dictionary passed from the server. */
export function say(t: PartnerDict, key: string): string {
  let cur: unknown = t;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as object)) cur = (cur as Record<string, unknown>)[part];
    else return t.err.generic;
  }
  return typeof cur === "string" ? cur : t.err.generic;
}
export const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

export function Submit({ children, wide = true }: { children: React.ReactNode; wide?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={wide ? "pp-btn pp-btn-wide" : "pp-btn"} disabled={pending} aria-busy={pending}>
      {children}
    </button>
  );
}

/** Form-level error (errors without a field, or for a field not shown in this form). */
export function FormError({ t, state, fields }: { t: PartnerDict; state: FormState | SubmitState; fields: string[] }) {
  if (!isErr(state) || (state.field && fields.includes(state.field))) return null;
  return <p className="pp-alert pp-alert-error" role="alert">{fill(say(t, state.error), state.vars ?? {})}</p>;
}

type FieldProps = {
  t: PartnerDict;
  state: FormState | SubmitState;
  name: string;
  label: string;
  hint?: string;
  children: (a11y: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode;
};
export function Field({ t, state, name, label, hint, children }: FieldProps) {
  const id = `f-${name}`;
  const err = isErr(state) && state.field === name ? say(t, state.error) : null;
  const describedBy = [hint ? `${id}-hint` : "", err ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={err ? "pp-field pp-field-bad" : "pp-field"}>
      <label htmlFor={id}>{label}</label>
      {children({ id, ...(err ? { "aria-invalid": true as const } : {}), "aria-describedby": describedBy })}
      {hint && <small id={`${id}-hint`} className="pp-hint">{hint}</small>}
      {err && <small id={`${id}-err`} className="pp-err" role="alert">{err}</small>}
    </div>
  );
}

/**
 * VAT number. Always rendered; marked required (client hint only — the server decides) when the
 * country is an EU member state and a company is filled in.
 */
function VatIdField({ t, state, country, company, defaultValue }: {
  t: PartnerDict; state: FormState; country: string; company: string; defaultValue?: string;
}) {
  const required = vatIdRequired({ country, company });
  return (
    <Field t={t} state={state} name="vatId" label={t.register.vatId} hint={t.register.vatIdHelp}>
      {(a) => (
        <>
          <input
            {...a}
            aria-describedby={[a["aria-describedby"], required ? "f-vatId-req" : ""].filter(Boolean).join(" ") || undefined}
            name="vatId" autoComplete="off" spellCheck={false} maxLength={40} defaultValue={defaultValue}
            required={required} aria-required={required || undefined}
          />
          {required && <small id="f-vatId-req" className="pp-hint"><strong>{t.register.vatIdRequiredNow}</strong></small>}
        </>
      )}
    </Field>
  );
}

// ─── Register ────────────────────────────────────────────────────────────────

export function RegisterForm({ t, locale, countries }: { t: PartnerDict; locale: PartnerLocale; countries: { code: string; name: string }[] }) {
  const [state, action] = useFormState(registerAction, null);
  const [country, setCountry] = useState("");
  const [company, setCompany] = useState("");
  if (isOk(state)) {
    return (
      <div className="pp-done" role="status">
        <h2>{t.register.successTitle}</h2>
        <p>{fill(t.register.successText, { email: state.email ?? "" })}</p>
      </div>
    );
  }
  const shown = ["firstName", "lastName", "company", "country", "vatId", "phone", "email", "language", "type", "password", "acceptAgreement"];
  return (
    <form action={action} className="pp-form" noValidate>
      <FormError t={t} state={state} fields={shown} />
      <div className="pp-row">
        <Field t={t} state={state} name="firstName" label={t.register.firstName}>
          {(a) => <input {...a} name="firstName" autoComplete="given-name" maxLength={80} required />}
        </Field>
        <Field t={t} state={state} name="lastName" label={t.register.lastName}>
          {(a) => <input {...a} name="lastName" autoComplete="family-name" maxLength={80} required />}
        </Field>
      </div>
      <Field t={t} state={state} name="company" label={t.register.company}>
        {(a) => <input {...a} name="company" autoComplete="organization" maxLength={120} onChange={(e) => setCompany(e.target.value)} />}
      </Field>
      <div className="pp-row">
        <Field t={t} state={state} name="country" label={t.register.country}>
          {(a) => (
            <select {...a} name="country" defaultValue="" required onChange={(e) => setCountry(e.target.value)}>
              <option value="" disabled>—</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          )}
        </Field>
        <Field t={t} state={state} name="phone" label={t.register.phone}>
          {(a) => <input {...a} name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} required />}
        </Field>
      </div>
      <VatIdField t={t} state={state} country={country} company={company} />
      <Field t={t} state={state} name="email" label={t.register.email}>
        {(a) => <input {...a} name="email" type="email" autoComplete="email" maxLength={254} required />}
      </Field>
      <div className="pp-row">
        <Field t={t} state={state} name="language" label={t.register.language}>
          {(a) => (
            <select {...a} name="language" defaultValue={locale}>
              {LANG_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          )}
        </Field>
        <Field t={t} state={state} name="type" label={t.register.type}>
          {(a) => (
            <select {...a} name="type" defaultValue="" required>
              <option value="" disabled>—</option>
              {Object.entries(t.types).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          )}
        </Field>
      </div>
      <Field t={t} state={state} name="password" label={t.register.password} hint={t.register.passwordHint}>
        {(a) => <input {...a} name="password" type="password" autoComplete="new-password" minLength={10} required />}
      </Field>
      <div className={isErr(state) && state.field === "acceptAgreement" ? "pp-check pp-field-bad" : "pp-check"}>
        <input id="f-acceptAgreement" type="checkbox" name="acceptAgreement" required aria-invalid={isErr(state) && state.field === "acceptAgreement" ? true : undefined} />
        <label htmlFor="f-acceptAgreement">
          {t.register.agreementPrefix}{" "}
          <a href="/agreement" target="_blank" rel="noopener noreferrer">{t.register.agreementLink}</a>.
        </label>
        {isErr(state) && state.field === "acceptAgreement" && <small className="pp-err" role="alert">{say(t, state.error)}</small>}
      </div>
      <Submit>{t.register.submit}</Submit>
      <p className="pp-alt">{t.register.haveAccount} <Link href="/login">{t.nav.login}</Link></p>
    </form>
  );
}

// ─── Resend verification link ────────────────────────────────────────────────

export function ResendForm({ t, email, intro = true }: { t: PartnerDict; email?: string; intro?: boolean }) {
  const [state, action] = useFormState(resendVerifyAction, null);
  if (isOk(state)) return <p className="pp-alert pp-alert-ok" role="status">{t.verify.resent}</p>;
  return (
    <form action={action} className="pp-form">
      {intro && <p className="pp-muted">{t.verify.resendText}</p>}
      <FormError t={t} state={state} fields={["email"]} />
      <Field t={t} state={state} name="email" label={t.login.email}>
        {(a) => <input {...a} name="email" type="email" autoComplete="email" defaultValue={email} maxLength={254} required />}
      </Field>
      <Submit>{t.verify.resend}</Submit>
    </form>
  );
}

// ─── Verify (button — a GET of the link never changes anything) ──────────────

export function VerifyForm({ t, token }: { t: PartnerDict; token: string }) {
  const [state, action] = useFormState(verifyAction, null);
  if (isErr(state) && state.resend) {
    return (
      <>
        <p className="pp-alert pp-alert-error" role="alert">{t.verify.invalid}</p>
        <ResendForm t={t} />
      </>
    );
  }
  return (
    <form action={action} className="pp-form">
      <p>{t.verify.confirmIntro}</p>
      <FormError t={t} state={state} fields={[]} />
      <input type="hidden" name="token" value={token} />
      <Submit>{t.verify.confirm}</Submit>
    </form>
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────

export function LoginForm({ t }: { t: PartnerDict }) {
  const [state, action] = useFormState(loginAction, null);
  const [showResend, setShowResend] = useState(false);
  const needsVerify = isErr(state) && state.resend;
  return (
    <>
      <form action={action} className="pp-form">
        <FormError t={t} state={state} fields={[]} />
        <Field t={t} state={state} name="email" label={t.login.email}>
          {(a) => <input {...a} name="email" type="email" autoComplete="username" maxLength={254} required />}
        </Field>
        <Field t={t} state={state} name="password" label={t.login.password}>
          {(a) => <input {...a} name="password" type="password" autoComplete="current-password" required />}
        </Field>
        <Submit>{t.login.submit}</Submit>
        <p className="pp-alt"><Link href="/forgot">{t.login.forgot}</Link></p>
      </form>
      {needsVerify && !showResend && (
        <button type="button" className="pp-linkbtn pp-linkbtn-accent" onClick={() => setShowResend(true)}>{t.login.resend}</button>
      )}
      {needsVerify && showResend && <ResendForm t={t} email={state.email} intro={false} />}
      <p className="pp-alt">{t.login.noAccount} <Link href="/register">{t.nav.register}</Link></p>
    </>
  );
}

// ─── Forgot / reset ──────────────────────────────────────────────────────────

export function ForgotForm({ t }: { t: PartnerDict }) {
  const [state, action] = useFormState(forgotAction, null);
  if (isOk(state)) return <p className="pp-alert pp-alert-ok" role="status">{t.forgot.neutral}</p>;
  return (
    <form action={action} className="pp-form">
      <p className="pp-muted">{t.forgot.intro}</p>
      <FormError t={t} state={state} fields={["email"]} />
      <Field t={t} state={state} name="email" label={t.forgot.email}>
        {(a) => <input {...a} name="email" type="email" autoComplete="email" maxLength={254} required />}
      </Field>
      <Submit>{t.forgot.submit}</Submit>
      <p className="pp-alt"><Link href="/login">{t.verify.goLogin}</Link></p>
    </form>
  );
}

export function ResetForm({ t, token }: { t: PartnerDict; token: string }) {
  const [state, action] = useFormState(resetAction, null);
  if (isOk(state)) {
    return (
      <>
        <p className="pp-alert pp-alert-ok" role="status">{t.reset.success}</p>
        <p className="pp-alt"><Link href="/login">{t.verify.goLogin}</Link></p>
      </>
    );
  }
  if (isErr(state) && state.error === "reset.invalid") {
    return (
      <>
        <p className="pp-alert pp-alert-error" role="alert">{t.reset.invalid}</p>
        <p className="pp-alt"><Link href="/forgot">{t.reset.requestNew}</Link></p>
      </>
    );
  }
  return (
    <form action={action} className="pp-form">
      <FormError t={t} state={state} fields={["password"]} />
      <input type="hidden" name="token" value={token} />
      <Field t={t} state={state} name="password" label={t.reset.password} hint={t.register.passwordHint}>
        {(a) => <input {...a} name="password" type="password" autoComplete="new-password" minLength={10} required />}
      </Field>
      <Submit>{t.reset.submit}</Submit>
    </form>
  );
}

// ─── Profile ─────────────────────────────────────────────────────────────────

type ProfileValues = { firstName: string; lastName: string; company: string; vatId: string; language: string };

/** `country` is the stored (locked) country; it only drives the VAT-number hint. */
export function ProfileForm({ t, values, country }: { t: PartnerDict; values: ProfileValues; country: string }) {
  const [state, action] = useFormState(updateProfileAction, null);
  const [company, setCompany] = useState(values.company);
  return (
    <form action={action} className="pp-form">
      <FormError t={t} state={state} fields={["firstName", "lastName", "company", "vatId", "language"]} />
      <div className="pp-row">
        <Field t={t} state={state} name="firstName" label={t.register.firstName}>
          {(a) => <input {...a} name="firstName" autoComplete="given-name" maxLength={80} defaultValue={values.firstName} required />}
        </Field>
        <Field t={t} state={state} name="lastName" label={t.register.lastName}>
          {(a) => <input {...a} name="lastName" autoComplete="family-name" maxLength={80} defaultValue={values.lastName} required />}
        </Field>
      </div>
      <Field t={t} state={state} name="company" label={t.register.company}>
        {(a) => <input {...a} name="company" autoComplete="organization" maxLength={120} defaultValue={values.company} onChange={(e) => setCompany(e.target.value)} />}
      </Field>
      <VatIdField t={t} state={state} country={country} company={company} defaultValue={values.vatId} />
      <Field t={t} state={state} name="language" label={t.profile.language}>
        {(a) => (
          <select {...a} name="language" defaultValue={values.language}>
            {LANG_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        )}
      </Field>
      <div className="pp-actions">
        <Submit wide={false}>{t.profile.save}</Submit>
        {isOk(state) && <span className="pp-saved" role="status">{t.profile.saved}</span>}
      </div>
    </form>
  );
}

export function PasswordForm({ t }: { t: PartnerDict }) {
  const [state, action] = useFormState(changePasswordAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (isOk(state)) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="pp-form">
      <FormError t={t} state={state} fields={["currentPassword", "newPassword"]} />
      <Field t={t} state={state} name="currentPassword" label={t.profile.currentPassword}>
        {(a) => <input {...a} name="currentPassword" type="password" autoComplete="current-password" required />}
      </Field>
      <Field t={t} state={state} name="newPassword" label={t.profile.newPassword} hint={t.register.passwordHint}>
        {(a) => <input {...a} name="newPassword" type="password" autoComplete="new-password" minLength={10} required />}
      </Field>
      <div className="pp-actions">
        <Submit wide={false}>{t.profile.changePassword}</Submit>
        {isOk(state) && <span className="pp-saved" role="status">{t.profile.passwordSaved}</span>}
      </div>
    </form>
  );
}

// ─── Email settings (phase 3d) ───────────────────────────────────────────────

type SettingsValues = { emailNotifications: boolean; digestOptIn: boolean };

export function SettingsForm({ t, values }: { t: PartnerDict; values: SettingsValues }) {
  const S = t.profileSettings;
  const [state, action] = useFormState<SettingsState, FormData>(savePartnerSettingsAction, null);
  // After a save the stored values win (the key remounts the checkboxes with them).
  const shown = state && "ok" in state ? { emailNotifications: state.emailNotifications, digestOptIn: state.digestOptIn } : values;
  const err = state && "error" in state ? state : null;
  return (
    <form action={action} className="pp-form" key={`${shown.emailNotifications}-${shown.digestOptIn}`}>
      {err && <p className="pp-alert pp-alert-error" role="alert">{fill(say(t, err.error), err.vars ?? {})}</p>}
      <label className="pp-check">
        <input type="checkbox" name="emailNotifications" defaultChecked={shown.emailNotifications} aria-describedby="set-notif-hint" />
        <span>{S.emailNotifications}</span>
        <small id="set-notif-hint" className="pp-hint pp-check-hint">{S.emailNotificationsHint}</small>
      </label>
      <label className="pp-check">
        <input type="checkbox" name="digestOptIn" defaultChecked={shown.digestOptIn} aria-describedby="set-digest-hint" />
        <span>{S.digestOptIn}</span>
        <small id="set-digest-hint" className="pp-hint pp-check-hint">{S.digestOptInHint}</small>
      </label>
      <div className="pp-actions">
        <Submit wide={false}>{t.profile.save}</Submit>
        {state && "ok" in state && <span className="pp-saved" role="status">{S.saved}</span>}
      </div>
    </form>
  );
}

// ─── Bank & billing details ──────────────────────────────────────────────────

/** The partner's own stored values, minus the IBAN (which is never sent to the client). */
export type BankPrefill = { holder: string; bic: string; billingName: string; billingAddress: string; vatId: string };

export function BankForm({ t, prefill, ibanLast4 }: { t: PartnerDict; prefill: BankPrefill | null; ibanLast4: string | null }) {
  const B = t.bank;
  const [state, action] = useFormState(saveBankDetailsAction, null);
  const [open, setOpen] = useState(!prefill);
  const ibanRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!state) return;
    // After every answer the IBAN and password inputs are emptied: neither is ever kept or echoed back.
    if (ibanRef.current) ibanRef.current.value = "";
    if (pwRef.current) pwRef.current.value = "";
    if (isOk(state)) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <div className="pp-actions">
        <button type="button" className="pp-btn pp-btn-ghost" onClick={() => setOpen(true)}>{B.edit}</button>
        {isOk(state) && <span className="pp-saved" role="status">{B.saved}</span>}
      </div>
    );
  }
  const shown = ["holder", "iban", "bic", "billingName", "billingAddress", "vatId", "currentPassword"];
  return (
    <form action={action} className="pp-form" noValidate>
      <FormError t={t} state={state} fields={shown} />
      <Field t={t} state={state} name="holder" label={B.holder}>
        {(a) => <input {...a} name="holder" autoComplete="cc-name" maxLength={80} defaultValue={prefill?.holder ?? ""} required />}
      </Field>
      <div className="pp-row">
        <Field t={t} state={state} name="iban" label={B.iban} hint={ibanLast4 ? B.ibanKeepHelp : undefined}>
          {(a) => (
            <input
              {...a}
              ref={ibanRef}
              name="iban"
              autoComplete="off"
              spellCheck={false}
              maxLength={60}
              placeholder={ibanLast4 ? `•••• ${ibanLast4}` : undefined}
              defaultValue=""
              required={!ibanLast4}
            />
          )}
        </Field>
        <Field t={t} state={state} name="bic" label={B.bic}>
          {(a) => <input {...a} name="bic" autoComplete="off" spellCheck={false} maxLength={14} defaultValue={prefill?.bic ?? ""} />}
        </Field>
      </div>
      <Field t={t} state={state} name="billingName" label={B.billingName}>
        {(a) => <input {...a} name="billingName" autoComplete="organization" maxLength={120} defaultValue={prefill?.billingName ?? ""} required />}
      </Field>
      <Field t={t} state={state} name="billingAddress" label={B.billingAddress} hint={B.billingAddressHelp}>
        {(a) => <textarea {...a} name="billingAddress" rows={3} maxLength={300} defaultValue={prefill?.billingAddress ?? ""} required />}
      </Field>
      <Field t={t} state={state} name="vatId" label={B.vatId} hint={B.vatIdHelp}>
        {(a) => <input {...a} name="vatId" autoComplete="off" spellCheck={false} maxLength={24} defaultValue={prefill?.vatId ?? ""} />}
      </Field>
      <Field t={t} state={state} name="currentPassword" label={B.password} hint={B.passwordHelp}>
        {(a) => <input {...a} ref={pwRef} name="currentPassword" type="password" autoComplete="current-password" required />}
      </Field>
      <p className="pp-muted pp-small">{B.emailNote}</p>
      <div className="pp-actions">
        <Submit wide={false}>{B.save}</Submit>
        {prefill && (
          <button type="button" className="pp-btn pp-btn-ghost" onClick={() => setOpen(false)}>{B.cancel}</button>
        )}
      </div>
    </form>
  );
}

// ─── Copy button ─────────────────────────────────────────────────────────────

export function CopyLink({ value, copyLabel, copiedLabel }: { value: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <div className="pp-copy">
      <input readOnly value={value} aria-label={value} onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="pp-btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? copiedLabel : copyLabel}
      </button>
      <span className="pp-sr" aria-live="polite">{copied ? copiedLabel : ""}</span>
    </div>
  );
}
