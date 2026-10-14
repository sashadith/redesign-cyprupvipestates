// The campaign tags a page view keeps (2026-10-14). Pure, no window access, so
// the browser tracker and the /api/analytics/track route share one rule:
// exactly utm_source, utm_medium and utm_campaign, trimmed, at most 100
// characters each, empty → null. Every other query parameter — utm_term,
// utm_content, gclid, fbclid, ref, anything a link happens to carry — is
// dropped and never stored.

export const UTM_MAX = 100;

export type PageViewUtm = { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null };

const KEYS: [param: string, field: keyof PageViewUtm][] = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
];

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, UTM_MAX).trim();
  return t || null;
};

/** From a query string ("?a=1&utm_source=x"), a full URL or a path with a query. */
export function extractUtm(input: string | null | undefined): PageViewUtm {
  const out: PageViewUtm = { utmSource: null, utmMedium: null, utmCampaign: null };
  const raw = (input ?? "").trim();
  const q = raw.indexOf("?");
  if (q < 0) return out;
  const params = new URLSearchParams(raw.slice(q + 1).split("#")[0]);
  for (const [param, field] of KEYS) out[field] = clean(params.get(param));
  return out;
}

/** The three fields from a beacon body ({ utmSource, utmMedium, utmCampaign }),
 *  re-validated on the server: a client can send anything. */
export function utmFromBody(body: unknown): PageViewUtm {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return { utmSource: clean(b.utmSource), utmMedium: clean(b.utmMedium), utmCampaign: clean(b.utmCampaign) };
}

export const hasUtm = (u: Partial<PageViewUtm> | null | undefined): boolean =>
  !!u && !!(u.utmSource || u.utmMedium || u.utmCampaign);
