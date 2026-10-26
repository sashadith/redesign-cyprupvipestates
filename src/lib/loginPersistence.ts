// "Keep me signed in" (2026-10-26) — one rule for both logins: the admin
// (/admin, /crm; NextAuth JWT in src/auth.ts) and the partner portal (own DB
// sessions in src/lib/partner/session.ts).
//   ticked   → signed in for 30 days from sign-in (fixed, not sliding: the
//              admin's auth() only reads the JWT, nothing re-signs it)
//   unticked → 8 hours from sign-in, the admin's old fixed lifetime; the
//              partner cookie is then a browser-session cookie as well

export const REMEMBER_DAYS = 30;
export const SHORT_SESSION_HOURS = 8;
export const REMEMBER_MS = REMEMBER_DAYS * 86_400_000;
export const SHORT_SESSION_MS = SHORT_SESSION_HOURS * 3_600_000;

/** A checkbox value from a form ("on") or a credentials body ("true"); everything else is "no". */
export function wantsRemember(v: unknown): boolean {
  return v === true || v === "on" || v === "true";
}

/** Admin JWT: an unticked sign-in ends SHORT_SESSION_HOURS after `loginAt`, however often the token is re-signed. */
export function adminSessionExpired(t: { remember: boolean; loginAt: number }, now: number): boolean {
  return !t.remember && now - t.loginAt >= SHORT_SESSION_MS;
}

/** How long a new partner session lives. */
export function partnerSessionMs(remember: boolean): number {
  return remember ? REMEMBER_MS : SHORT_SESSION_MS;
}

/** A partner session was a remembered one when it was created for longer than a short one (no extra column needed). */
export function partnerSessionWasRemembered(s: { createdAt: Date; expiresAt: Date }): boolean {
  return s.expiresAt.getTime() - s.createdAt.getTime() > SHORT_SESSION_MS + 60_000;
}
