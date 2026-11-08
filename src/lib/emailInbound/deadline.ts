/**
 * A wall-clock budget for one cron run.
 *
 * Why this exists: the email-inbound route declares `maxDuration = 60`, but
 * nothing enforced it. One run opened up to three separate IMAP sessions back
 * to back, each able to spend connectionTimeout 20 s + socketTimeout 60 s
 * (imapClient.ts) before giving up. The arithmetic alone allows a run far past
 * a minute, and on 2026-11-08 one took 86 s and then failed — while the NEXT
 * run was already due, because the cron fires every 5 minutes.
 *
 * The rule this encodes: a poll that cannot finish inside its budget must hand
 * the rest to the next run rather than overrun. Nothing is lost by deferring —
 * both mailbox pollers advance a UID cursor, so the next run picks up exactly
 * where this one stopped.
 *
 * `now` is injectable so the behaviour is testable without sleeping.
 */
export type Deadline = {
  /** Milliseconds left in the budget; never negative. */
  remainingMs(): number;
  /** True while at least `ms` of budget is left — ask BEFORE starting a unit of work. */
  hasRoomFor(ms: number): boolean;
  /**
   * How long a single phase may take: its own cap, trimmed to whatever is
   * actually left. Always at least 1, so a caller that already checked
   * `hasRoomFor` never passes 0 to a timeout and turns it into "expire now".
   */
  budgetFor(capMs: number): number;
};

export function createDeadline(budgetMs: number, now: () => number = Date.now): Deadline {
  const startedAt = now();
  const remainingMs = () => Math.max(0, budgetMs - (now() - startedAt));
  return {
    remainingMs,
    hasRoomFor: (ms: number) => remainingMs() >= ms,
    budgetFor: (capMs: number) => Math.max(1, Math.min(capMs, remainingMs())),
  };
}

/**
 * Was a budgeted run healthy?
 *
 * A deferral is not a failure — the next run resumes from the UID cursor, so a
 * slow mailbox pushing its neighbours to the next poll is the system working as
 * designed, and alerting on it would manufacture exactly the recurring false
 * alarm this work set out to avoid.
 *
 * But a run that deferred EVERYTHING did no work at all. Left unchecked that
 * logs ok forever while no mail is ever read — the silent-failure shape the
 * budget was supposed to prevent, not create. So: partial deferral is healthy,
 * total deferral is not. (With the budget set well above a healthy poll, the
 * first mailbox is always started, so total deferral means something is wrong.)
 *
 * Structurally typed on purpose: the caller's richer summary rows fit as they are.
 */
export function runIsHealthy(results: ReadonlyArray<{ ok: boolean; deferred?: boolean }>): boolean {
  return results.every((r) => r.ok) && (results.length === 0 || results.some((r) => !r.deferred));
}
