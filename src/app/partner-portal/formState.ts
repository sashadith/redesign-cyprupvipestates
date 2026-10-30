/** Shape returned by every partner-portal form action (consumed via useFormState). */
export type FormOk = { ok: true; email?: string };
/** `vars` fill {placeholder}s in the error text (values are plain text, rendered by React). */
export type FormErr = { error: string; field?: string; resend?: boolean; email?: string; vars?: Record<string, string> };
export type FormState = FormOk | FormErr | null;

export const isErr = (s: FormState): s is FormErr => !!s && "error" in s;
export const isOk = (s: FormState): s is FormOk => !!s && "ok" in s;

/** Submit-client form: the partner's own typed name comes back for the thank-you panel. */
export type SubmitOk = { ok: true; name: string; alreadyYours?: boolean };
export type SubmitState = SubmitOk | FormErr | null;

/** Profile email settings: the saved values come back so the form shows what is stored. */
export type SettingsOk = { ok: true; emailNotifications: boolean; digestOptIn: boolean; marketAlerts: boolean; reminders: boolean; notifyChannel: NotifyChannelValue };
export type SettingsState = SettingsOk | FormErr | null;

export type NotifyChannelValue = "EMAIL" | "TELEGRAM" | "BOTH";

/** Telegram link code: shown once (never stored in clear text, never re-displayed after a reload). */
export type TelegramCodeOk = { ok: true; code: string; link: string };
export type TelegramCodeState = TelegramCodeOk | FormErr | null;

/** Branding (phase 3e): the stored values come back so the form shows what is saved. */
export type BrandOk = {
  ok: true;
  brandName: string | null; brandPhone: string | null; brandEmail: string | null; brandWebsite: string | null;
};
export type BrandState = BrandOk | FormErr | null;

/** Logo upload / removal (phase 3e). */
export type LogoState = { ok: true; removed?: boolean } | FormErr | null;

/** New presentation (phase 3e): the public link comes back for the copy button. */
export type PresentationOk = { ok: true; url: string };
export type PresentationState = PresentationOk | FormErr | null;
