// Sliding-window limiter for the CRM's Claude actions (Phase 2c, 2026-10-18).
// Same idea as antispam.ts's makeRateLimiter (the admin compose precedent), but
// returns "allowed" and does not count refused calls, so a user who keeps
// clicking is not locked out longer than the window. In-memory and
// per-instance — fine for the single-instance deploy.
export function makeLimiter(max: number, windowMs: number): (key: string, now?: number) => boolean {
  const hits = new Map<string, number[]>();
  return (key, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}
