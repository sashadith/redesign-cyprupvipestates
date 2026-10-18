// Programme response time shown on the public landing (partner portal phase 3d). Pure.
export const MIN_RESPONSE_SAMPLES = 5;

/** Mean minutes, rounded; null below 5 samples (too few to publish). */
export function averageResponse(minutes: number[]): number | null {
  const ok = minutes.filter((m) => Number.isFinite(m) && m >= 0);
  if (ok.length < MIN_RESPONSE_SAMPLES) return null;
  return Math.round(ok.reduce((a, b) => a + b, 0) / ok.length);
}

/** Under 120 minutes → minutes, else hours rounded to the nearest 0.5. Templates carry {n}. */
export function formatResponse(min: number, t: { minutes: string; hours: string }, locale = "en"): string {
  if (min < 120) return t.minutes.replace("{n}", String(Math.max(1, Math.round(min))));
  const h = Math.round((min / 60) * 2) / 2;
  return t.hours.replace("{n}", h.toLocaleString(locale, { maximumFractionDigits: 1 }));
}

/** Look-back window and query cap of the landing figure. */
export const RESPONSE_WINDOW_DAYS = 90;
export const RESPONSE_CLAIM_CAP = 500;

/**
 * Claims + first outbound contact per lead (already restricted to occurredAt >= that claim's createdAt)
 * → minutes per claim. Claims without a contact, or with a contact before creation, are left out.
 */
export function responseMinutesFrom(
  claims: { leadId: string; createdAt: Date }[],
  firstOutbound: Map<string, Date>,
): number[] {
  const out: number[] = [];
  for (const c of claims) {
    const at = firstOutbound.get(c.leadId);
    if (!at) continue;
    const ms = at.getTime() - c.createdAt.getTime();
    if (ms >= 0) out.push(ms / 60_000);
  }
  return out;
}
