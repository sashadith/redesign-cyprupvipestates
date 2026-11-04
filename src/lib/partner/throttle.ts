const SWEEP_ABOVE = 5000;
const HARD_CAP = 20000;

/** In-memory fixed-window throttle. Refused calls do not extend the window. Per-process only. */
export function makeThrottle(max: number, windowMs: number) {
  const buckets = new Map<string, { start: number; count: number }>();
  function prune(now: number) {
    if (buckets.size <= SWEEP_ABOVE) return;
    buckets.forEach((b, k) => {
      if (now - b.start >= windowMs) buckets.delete(k);
    });
    // Still too big (a flood inside one window): drop oldest by insertion order.
    const keys = buckets.keys();
    while (buckets.size > HARD_CAP) {
      const k = keys.next();
      if (k.done) break;
      buckets.delete(k.value);
    }
  }
  return {
    /** true = allowed */
    hit(key: string, now: number = Date.now()): boolean {
      const b = buckets.get(key);
      if (!b || now - b.start >= windowMs) {
        buckets.delete(key);
        buckets.set(key, { start: now, count: 1 });
        prune(now);
        return true;
      }
      if (b.count >= max) return false;
      b.count += 1;
      return true;
    },
    reset(key: string): void {
      buckets.delete(key);
    },
    size(): number {
      return buckets.size;
    },
  };
}
