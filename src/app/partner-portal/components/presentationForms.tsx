"use client";
/** Phase 3e: branding (profile) forms and the presentation revoke button (the builder lives in presentationBuilder/). */
import { useFormState } from "react-dom";
import type { PartnerDict } from "@/lib/partner/i18n";
import { removeBrandLogoAction, removeBrandPhotoAction, saveBrandAction, uploadBrandLogoAction, uploadBrandPhotoAction } from "../brandActions";
import { revokePresentationAction } from "../presentationActions";
import { isErr, type BrandState, type LogoState } from "../formState";
import { Field, FormError, Submit, fill, say } from "./forms";

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

/** `photoSrc`: the partner's own photo (portal route), or null when none is stored. Shown in the footer of their presentations. */
export function PhotoForm({ t, photoSrc }: { t: PartnerDict; photoSrc: string | null }) {
  const B = t.branding;
  const [upState, upload] = useFormState<LogoState, FormData>(uploadBrandPhotoAction, null);
  const [rmState, remove] = useFormState<LogoState, FormData>(removeBrandPhotoAction, null);
  const err = isErr(upState) ? upState : isErr(rmState) ? rmState : null;
  return (
    <div className="pp-brandlogo">
      <p className="pp-brandlogo-label">{B.photo}</p>
      {photoSrc ? (
        <img className="pp-brandphoto-img" src={photoSrc} alt="" width={96} height={96} />
      ) : (
        <p className="pp-muted">{B.noPhoto}</p>
      )}
      {err && <p className="pp-alert pp-alert-error" role="alert">{fill(say(t, err.error), err.vars ?? {})}</p>}
      <form action={upload} className="pp-form pp-brandlogo-form">
        <input type="file" name="photo" accept="image/png,image/jpeg,image/webp" aria-label={B.photo} aria-describedby="brand-photo-hint" required />
        <small id="brand-photo-hint" className="pp-hint">{B.photoHint}</small>
        <div className="pp-actions">
          <Submit wide={false}>{photoSrc ? B.photoReplace : B.photoUpload}</Submit>
          {upState && "ok" in upState && <span className="pp-saved" role="status">{B.saved}</span>}
        </div>
      </form>
      {photoSrc && (
        <form action={remove}>
          <button type="submit" className="pp-btn pp-btn-ghost">{B.photoRemove}</button>
        </form>
      )}
    </div>
  );
}

// ─── New presentation ────────────────────────────────────────────────────────

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
