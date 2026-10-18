/** In-memory fixed-window throttle. Refused calls do not extend the window. Per-process only. */
export function makeThrottle(max: number, windowMs: number) {
  const buckets = new Map<string, { start: number; count: number }>();
  return {
    /** true = allowed */
    hit(key: string, now: number = Date.now()): boolean {
      const b = buckets.get(key);
      if (!b || now - b.start >= windowMs) {
        buckets.set(key, { start: now, count: 1 });
        return true;
      }
      if (b.count >= max) return false;
      b.count += 1;
      return true;
    },
    reset(key: string): void {
      buckets.delete(key);
    },
  };
}
