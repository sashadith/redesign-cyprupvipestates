type HeaderBag = { get(name: string): string | null };

/**
 * Client IP for throttling and agreement acceptance. nginx sets x-real-ip; otherwise the LAST
 * x-forwarded-for hop (added by our own proxy) — the first hop is whatever the client sent.
 */
export function partnerClientIp(h: HeaderBag): string | null {
  const clean = (v: string | null | undefined) => {
    const s = (v ?? "").trim();
    return s && s.length <= 64 && /^[0-9a-fA-F:.]+$/.test(s) ? s : null;
  };
  const real = clean(h.get("x-real-ip"));
  if (real) return real;
  const xff = h.get("x-forwarded-for");
  if (!xff) return null;
  const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length ? clean(parts[parts.length - 1]) : null;
}
