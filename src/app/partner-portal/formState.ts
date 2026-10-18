/** Shape returned by every partner-portal form action (consumed via useFormState). */
export type FormOk = { ok: true; email?: string };
export type FormErr = { error: string; field?: string; resend?: boolean; email?: string };
export type FormState = FormOk | FormErr | null;

export const isErr = (s: FormState): s is FormErr => !!s && "error" in s;
export const isOk = (s: FormState): s is FormOk => !!s && "ok" in s;
