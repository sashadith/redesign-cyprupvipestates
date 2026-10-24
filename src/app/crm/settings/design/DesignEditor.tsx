"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BODY_FONTS, HEADING_FONTS, RANGES, ROLE_KEYS, contrastWarnings, deriveAccentVariants, normalizeGlobal,
  type ContrastWarning, type GlobalSettings, type RoleKey, type SetValues,
} from "@/lib/design/theme";
import type { ThemeRow } from "@/lib/design/store";
import {
  deleteThemeAction, duplicateThemeAction, makeDefaultThemeAction, resetGlobalAction, restoreBuiltInAction,
  restoreThemeVersionAction, saveGlobalAction, saveThemeAction,
} from "./actions";
import { DesignPreview } from "./DesignPreview";

// Owner design page (/crm/settings/design): set list, set editor, global type/shape, preview.
// The draft set and draft global settings live here and go to <DesignPreview>, which shows them
// live in the CRM, portal and email frames before anything is saved.

export type ThemeVersion = { id: string; name: string; values: SetValues; createdAt: string };
export type GlobalVersion = { id: string; values: GlobalSettings; note: string | null; createdAt: string };

type Props = { themes: ThemeRow[]; global: GlobalSettings; histories: Record<string, ThemeVersion[]>; globalHistory: GlobalVersion[] };
type Draft = { name: string; values: Record<RoleKey, string> };

const ROLES: Record<RoleKey, { label: string; hint: string }> = {
  page: { label: "Page background", hint: "CRM, portal and email background, email quote box" },
  surface: { label: "Surface", hint: "CRM board columns and secondary areas, portal secondary surfaces" },
  card: { label: "Card", hint: "CRM panels and cards, portal cards, the email card" },
  text: { label: "Text", hint: "Main text everywhere" },
  muted: { label: "Muted text", hint: "Secondary text everywhere" },
  accent: { label: "Accent", hint: "Buttons, badges, large figures, focus ring, email button" },
  accentText: { label: "Accent text", hint: "Links and small accent text" },
  accentHover: { label: "Accent hover", hint: "Hover and pressed states" },
  gold: { label: "Gold line", hint: "Gold contours and dividers (decorative, never text)" },
  border: { label: "Border", hint: "Card borders, the email card border" },
  onAccent: { label: "On accent", hint: "Text on accent buttons and badges" },
  field: { label: "Field", hint: "Input, select and search field backgrounds" },
};

const SIZES: { key: "crmBase" | "portalBase" | "emailBase" | "headingScale" | "radius"; label: string; step: number; unit: string }[] = [
  { key: "crmBase", label: "CRM base size", step: 1, unit: "px" },
  { key: "portalBase", label: "Portal base size", step: 1, unit: "px" },
  { key: "emailBase", label: "Email base size", step: 1, unit: "px" },
  { key: "headingScale", label: "Heading scale", step: 0.05, unit: "×" },
  { key: "radius", label: "Corner rounding", step: 1, unit: "px" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;
const SWATCH: RoleKey[] = ["page", "card", "accent", "text"];

function draftOf(t: ThemeRow): Draft {
  return { name: t.name, values: { ...t.values } };
}
function isDirty(d: Draft | null, t: ThemeRow | null): boolean {
  if (!d || !t) return false;
  return d.name !== t.name || ROLE_KEYS.some((k) => d.values[k].toUpperCase() !== t.values[k]);
}
// Valid draft colours; a half-typed hex shows the saved colour until it is complete.
function usable(d: Draft | null, fallback: SetValues): SetValues {
  const out = { ...fallback };
  if (d) for (const k of ROLE_KEYS) if (HEX.test(d.values[k])) out[k] = d.values[k].toUpperCase();
  return out;
}
function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function ratio(w: ContrastWarning): string {
  return `${w.ratio.toFixed(2)}:1 on ${ROLES[w.bg].label}`;
}

function Swatches({ values }: { values: SetValues }) {
  return (
    <span className="crm-ds-swatches" aria-hidden="true">
      {SWATCH.map((k) => <i key={k} style={{ background: values[k] }} />)}
    </span>
  );
}

function Toggle({ on, label, disabled, onClick }: { on: boolean; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`crm-switch${on ? " on" : ""}`} role="switch" aria-checked={on} disabled={disabled} onClick={onClick}>
      <span className="crm-switch-track"><i /></span>{label}
    </button>
  );
}

export function DesignEditor({ themes, global, histories, globalHistory }: Props) {
  const [pending, start] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(() => themes.find((t) => t.isDefault)?.id ?? themes[0]?.id ?? null);
  const saved = themes.find((t) => t.id === selectedId) ?? themes[0] ?? null;
  const [draft, setDraft] = useState<Draft | null>(() => (saved ? draftOf(saved) : null));
  const [manual, setManual] = useState(!global.derivedAccent);
  const [listError, setListError] = useState<string | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [themeNotice, setThemeNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RoleKey, string>>>({});
  const [gDraft, setGDraft] = useState<GlobalSettings>(global);
  const [gError, setGError] = useState<string | null>(null);
  const [gNotice, setGNotice] = useState<string | null>(null);
  const [gFieldErrors, setGFieldErrors] = useState<Record<string, string>>({});

  // A saved change (own save, restore, someone else's save) replaces the draft with the stored set.
  const savedKey = saved ? JSON.stringify([saved.id, saved.name, saved.values]) : "";
  useEffect(() => {
    setDraft(saved ? draftOf(saved) : null);
    setFieldErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);
  const globalKey = JSON.stringify(global);
  useEffect(() => {
    setGDraft(global);
    setGFieldErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalKey]);

  const values = useMemo(() => usable(draft, saved?.values ?? ({} as SetValues)), [draft, saved]);
  const warnings = useMemo(() => (saved ? contrastWarnings(values) : []), [values, saved]);
  const dirty = isDirty(draft, saved);
  const gDirty = JSON.stringify(gDraft) !== globalKey;
  // The preview never sees a half-typed number: out-of-range values show the default until fixed.
  const previewGlobal = useMemo(() => normalizeGlobal(gDraft), [gDraft]);

  useEffect(() => {
    if (!dirty && !gDirty) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, gDirty]);

  const select = (id: string) => {
    if (id === saved?.id) return;
    if (dirty && !window.confirm("Discard the unsaved changes to this set?")) return;
    setSelectedId(id);
    setThemeError(null);
    setThemeNotice(null);
  };

  const setRole = (k: RoleKey, raw: string) => {
    const v = raw.trim();
    setDraft((d) => {
      if (!d || !saved) return d;
      const next = { ...d.values, [k]: v };
      if (!manual && k === "accent" && HEX.test(v)) {
        const ok = (x: string, fb: string) => (HEX.test(x) ? x.toUpperCase() : fb);
        Object.assign(next, deriveAccentVariants(v.toUpperCase(), ok(next.page, saved.values.page), ok(next.card, saved.values.card)));
      }
      return { ...d, values: next };
    });
    setThemeNotice(null);
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onErr: (e: string | null) => void, after?: () => void) =>
    start(async () => {
      const r = await fn();
      onErr(r.ok ? null : r.error ?? "Something went wrong");
      if (r.ok) after?.();
    });

  const toggleOffer = (t: ThemeRow, side: "staff" | "partners") =>
    run(() => saveThemeAction({
      id: t.id, name: t.name, values: t.values, confirmLowContrast: true,
      offeredToStaff: side === "staff" ? !t.offeredToStaff : t.offeredToStaff,
      offeredToPartners: side === "partners" ? !t.offeredToPartners : t.offeredToPartners,
    }), setListError);

  const duplicate = (t: ThemeRow) => {
    if (dirty && !window.confirm("Discard the unsaved changes to this set?")) return;
    start(async () => {
      const r = await duplicateThemeAction(t.id);
      if (r.ok) { setListError(null); setSelectedId(r.id); setThemeError(null); setThemeNotice(null); }
      else setListError(r.error);
    });
  };

  const remove = (t: ThemeRow) => {
    if (!window.confirm(`Delete the set "${t.name}"? Anyone using it falls back to the default set.`)) return;
    run(() => deleteThemeAction(t.id), setListError, () => { if (t.id === saved?.id) setSelectedId(null); });
  };

  const saveSet = () => {
    if (!saved || !draft) return;
    start(async () => {
      const r = await saveThemeAction({
        id: saved.id, name: draft.name, values: draft.values,
        offeredToStaff: saved.offeredToStaff, offeredToPartners: saved.offeredToPartners,
        confirmLowContrast: warnings.length > 0,
      });
      if (r.ok) { setThemeError(null); setFieldErrors({}); setThemeNotice("Saved."); }
      else { setThemeError(r.error); setFieldErrors(r.fieldErrors ?? {}); setThemeNotice(null); }
    });
  };

  const saveGlobal = (value: GlobalSettings, notice: string) =>
    start(async () => {
      const r = await saveGlobalAction(value);
      if (r.ok) { setGError(null); setGFieldErrors({}); setGNotice(notice); }
      else { setGError(r.error); setGFieldErrors(r.fieldErrors ?? {}); setGNotice(null); }
    });

  const classic = themes.find((t) => t.key === "classic");
  const history = saved ? histories[saved.id] ?? [] : [];

  return (
    <div className="crm-ds">
      <section className="crm-panel crm-ds-sets" aria-label="Colour sets">
        <div className="crm-ds-sechead">
          <h2>Colour sets</h2>
          {classic && <button type="button" className="crm-btn" disabled={pending} onClick={() => duplicate(classic)}>New set</button>}
        </div>
        {listError && <p className="crm-ck-error" role="alert">{listError}</p>}
        <ul className="crm-ds-list">
          {themes.map((t) => (
            <li key={t.id} className={t.id === saved?.id ? "on" : undefined}>
              <div className="crm-ds-setrow">
                <Swatches values={t.values} />
                <b>{t.name}</b>
                {t.isDefault && <span className="crm-pill">Default</span>}
                {t.key !== null && <span className="crm-pill">Built-in</span>}
              </div>
              <div className="crm-ds-offers">
                <Toggle on={t.offeredToStaff} label="Staff" disabled={pending} onClick={() => toggleOffer(t, "staff")} />
                <Toggle on={t.offeredToPartners} label="Partners" disabled={pending} onClick={() => toggleOffer(t, "partners")} />
              </div>
              <div className="crm-ds-actions">
                <button type="button" className="crm-linkbtn" onClick={() => select(t.id)} aria-current={t.id === saved?.id ? "true" : undefined}>Edit</button>
                <button type="button" className="crm-linkbtn" disabled={pending} onClick={() => duplicate(t)}>Duplicate</button>
                {!t.isDefault && <button type="button" className="crm-linkbtn" disabled={pending} onClick={() => run(() => makeDefaultThemeAction(t.id), setListError)}>Make default</button>}
                {!t.isDefault && t.key === null && <button type="button" className="crm-linkbtn" disabled={pending} onClick={() => remove(t)}>Delete</button>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {saved && draft ? (
        <section className="crm-panel crm-ds-editor" aria-label={`Edit ${saved.name}`}>
          <div className="crm-ds-sechead">
            <h2>Edit “{saved.name}”</h2>
            {dirty && <span className="crm-warn">Unsaved changes</span>}
          </div>
          <label className="crm-ds-name">
            <span>Name</span>
            <input value={draft.name} maxLength={40} onChange={(e) => { const name = e.target.value; setDraft((d) => (d ? { ...d, name } : d)); }} />
          </label>
          <Toggle on={manual} label="Adjust accent variants manually" onClick={() => setManual((m) => !m)} />
          <div className="crm-ds-colors">
            {ROLE_KEYS.map((k) => {
              const locked = !manual && (k === "accentText" || k === "accentHover");
              const raw = draft.values[k];
              const bad = !HEX.test(raw);
              const err = fieldErrors[k] ?? (bad ? "Must be a #RRGGBB colour" : undefined);
              const warn = warnings.filter((w) => w.fg === k);
              const id = `ds-role-${k}`;
              return (
                <div key={k} className="crm-ds-color">
                  <input type="color" aria-label={`${ROLES[k].label} picker`} value={values[k].toLowerCase()} disabled={locked}
                    onChange={(e) => setRole(k, e.target.value.toUpperCase())} />
                  <div className="crm-ds-colortext">
                    <label htmlFor={id}>{ROLES[k].label}</label>
                    <small>{ROLES[k].hint}{locked ? " — derived from Accent" : ""}</small>
                    <input id={id} value={raw} maxLength={7} spellCheck={false} disabled={locked} aria-invalid={err ? "true" : undefined}
                      aria-describedby={err || warn.length ? `${id}-msg` : undefined} onChange={(e) => setRole(k, e.target.value)} />
                    {(err || warn.length > 0) && (
                      <span id={`${id}-msg`} className="crm-ds-msg">
                        {err && <em className="crm-rate-err">{err}</em>}
                        {warn.map((w) => <em key={w.pair} className="crm-warn">Low contrast: {ratio(w)}</em>)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {themeError && <p className="crm-ck-error" role="alert">{themeError}</p>}
          {themeNotice && <p className="crm-muted" role="status">{themeNotice}</p>}
          <div className="crm-ds-buttons">
            <button type="button" className="crm-btn primary" disabled={pending || !dirty} onClick={saveSet}>
              {warnings.length > 0 ? "Save anyway" : "Save"}
            </button>
            {dirty && <button type="button" className="crm-btn quiet" disabled={pending} onClick={() => { setDraft(draftOf(saved)); setThemeError(null); setFieldErrors({}); }}>Discard changes</button>}
            {saved.key !== null && (
              <button type="button" className="crm-btn" disabled={pending} onClick={() => {
                if (window.confirm(`Restore the original colours of "${saved.name}"?`)) run(() => restoreBuiltInAction(saved.id), setThemeError, () => setThemeNotice("Original colours restored."));
              }}>Restore original</button>
            )}
          </div>
          {warnings.length > 0 && <p className="crm-ds-note crm-muted">Some text is below 4.5:1 contrast. Saving is still possible with “Save anyway”.</p>}
          <details className="crm-ds-history">
            <summary>History ({history.length})</summary>
            {history.length === 0 ? <p className="crm-muted">No saved versions yet.</p> : (
              <ul>
                {history.map((v) => (
                  <li key={v.id}>
                    <Swatches values={v.values} />
                    <span>{v.name}</span>
                    <time dateTime={v.createdAt}>{when(v.createdAt)}</time>
                    <button type="button" className="crm-linkbtn" disabled={pending}
                      onClick={() => run(() => restoreThemeVersionAction(v.id), setThemeError, () => setThemeNotice("Version restored."))}>Restore</button>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </section>
      ) : (
        <section className="crm-panel crm-ds-editor"><p className="crm-muted">No colour set selected.</p></section>
      )}

      <section className="crm-panel crm-ds-global" aria-label="Fonts, sizes and corners">
        <div className="crm-ds-sechead">
          <h2>Fonts, sizes and corners</h2>
          {gDirty && <span className="crm-warn">Unsaved changes</span>}
        </div>
        <p className="crm-muted crm-ds-note">One setting for everyone, whichever colour set they use.</p>
        <div className="crm-ds-fonts">
          <label>
            <span>Heading font</span>
            <select value={gDraft.headingFont} style={{ fontFamily: `'${gDraft.headingFont}'` }}
              onChange={(e) => setGDraft((g) => ({ ...g, headingFont: e.target.value as GlobalSettings["headingFont"] }))}>
              {HEADING_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>{f}</option>)}
            </select>
            {gFieldErrors.headingFont && <em className="crm-rate-err">{gFieldErrors.headingFont}</em>}
          </label>
          <label>
            <span>Body font</span>
            <select value={gDraft.bodyFont} style={{ fontFamily: `'${gDraft.bodyFont}'` }}
              onChange={(e) => setGDraft((g) => ({ ...g, bodyFont: e.target.value as GlobalSettings["bodyFont"] }))}>
              {BODY_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>{f}</option>)}
            </select>
            {gFieldErrors.bodyFont && <em className="crm-rate-err">{gFieldErrors.bodyFont}</em>}
          </label>
        </div>
        <div className="crm-ds-sliders">
          {SIZES.map(({ key, label, step, unit }) => {
            const [lo, hi] = RANGES[key];
            const set = (v: string) => setGDraft((g) => ({ ...g, [key]: v === "" ? NaN : Number(v) }));
            const val = Number.isFinite(gDraft[key]) ? gDraft[key] : "";
            return (
              <div key={key} className="crm-ds-slider">
                <label htmlFor={`ds-g-${key}`}>{label} <small>({lo}–{hi}{unit === "px" ? " px" : ""})</small></label>
                <input type="range" min={lo} max={hi} step={step} value={Number.isFinite(gDraft[key]) ? gDraft[key] : lo} aria-label={`${label} slider`}
                  onChange={(e) => set(e.target.value)} />
                <span className="crm-ds-num">
                  <input id={`ds-g-${key}`} type="number" min={lo} max={hi} step={step} value={val} inputMode="decimal"
                    aria-invalid={gFieldErrors[key] ? "true" : undefined} onChange={(e) => set(e.target.value)} />
                  <small>{unit}</small>
                </span>
                {gFieldErrors[key] && <em className="crm-rate-err">{gFieldErrors[key]}</em>}
              </div>
            );
          })}
        </div>
        {gError && <p className="crm-ck-error" role="alert">{gError}</p>}
        {gNotice && <p className="crm-muted" role="status">{gNotice}</p>}
        <div className="crm-ds-buttons">
          <button type="button" className="crm-btn primary" disabled={pending || !gDirty} onClick={() => saveGlobal(gDraft, "Saved.")}>Save</button>
          {gDirty && <button type="button" className="crm-btn quiet" disabled={pending} onClick={() => { setGDraft(global); setGError(null); setGFieldErrors({}); }}>Discard changes</button>}
          <button type="button" className="crm-btn" disabled={pending} onClick={() => {
            if (window.confirm("Reset fonts, sizes and corners to the defaults?")) run(() => resetGlobalAction(), setGError, () => setGNotice("Reset to the defaults."));
          }}>Reset to default</button>
        </div>
        <details className="crm-ds-history">
          <summary>History ({globalHistory.length})</summary>
          {globalHistory.length === 0 ? <p className="crm-muted">No saved versions yet — the defaults are in use.</p> : (
            <ul>
              {globalHistory.map((v) => (
                <li key={v.id}>
                  <span>{v.values.headingFont} / {v.values.bodyFont} · {v.values.crmBase}/{v.values.portalBase}/{v.values.emailBase} px · ×{v.values.headingScale} · {v.values.radius} px{v.note ? ` (${v.note})` : ""}</span>
                  <time dateTime={v.createdAt}>{when(v.createdAt)}</time>
                  <button type="button" className="crm-linkbtn" disabled={pending} onClick={() => saveGlobal(v.values, "Version restored.")}>Restore</button>
                </li>
              ))}
            </ul>
          )}
        </details>
      </section>

      {saved && <DesignPreview draft={values} global={previewGlobal} />}
    </div>
  );
}
