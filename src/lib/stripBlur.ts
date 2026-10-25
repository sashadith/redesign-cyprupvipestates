/* Deep copy of a JSON-like value without any `blurDataURL` keys.

   Image assets dereferenced from the CMS data carry a ~0.5 KB base64 blur placeholder each
   (src/lib/sanityRefs.ts). Pages whose components never render a blur placeholder still serialise
   them into the React Server Components payload that every client component receives: the homepage
   shipped 172 copies of the same two strings, ~91 KB raw / 258 KB with the surrounding data, inside
   the HTML (2026-10-19). Strip them before they reach the render tree. Non-plain values (Date etc.)
   are passed through untouched; the input is not mutated. */
export function stripBlurDataUrls<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripBlurDataUrls) as unknown as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "blurDataURL") continue;
      out[k] = stripBlurDataUrls(v);
    }
    return out as T;
  }
  return value;
}
