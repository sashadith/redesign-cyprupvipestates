// Marketing attribution helpers — shared by client forms (capture) and API routes (parse).
// No "use client" directive: every function guards window access so it is safe to import
// from both client components and server route handlers.

export type Attribution = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  referrer?: string | null;
};

const KEY = "cve_attribution";
const PARAM_MAP: Record<string, keyof Attribution> = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_term: "utmTerm",
  utm_content: "utmContent",
  gclid: "gclid",
  fbclid: "fbclid",
};

// CLIENT: capture first-touch attribution into sessionStorage. Safe to call on every
// page load — once UTM/click data is stored it is never overwritten (first-touch wins).
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const existingRaw = window.sessionStorage.getItem(KEY);
    let stored: Attribution = {};
    try { stored = existingRaw ? JSON.parse(existingRaw) : {}; } catch { stored = {}; }
    const hasStored = Object.keys(stored).length > 0;
    if (hasStored) return; // first-touch already locked in for this session

    const params = new URLSearchParams(window.location.search);
    const data: Attribution = {};
    for (const [param, key] of Object.entries(PARAM_MAP)) {
      const v = params.get(param);
      if (v) data[key] = v.slice(0, 255);
    }
    const ref = document.referrer || "";
    try {
      const refHost = ref ? new URL(ref).host : "";
      if (ref && refHost && refHost !== window.location.host) data.referrer = ref.slice(0, 255);
    } catch { /* ignore malformed referrer */ }

    // Store only when we actually captured something, so a later page that *does*
    // carry UTM params can still become the session's first-touch source.
    if (Object.keys(data).length > 0) window.sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* attribution must never break the page */ }
}

// CLIENT: read the stored attribution to merge into a form submission body.
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    captureAttribution(); // ensure entry-page data is captured even if the tracker hasn't run
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch { return {}; }
}

// SERVER: normalize attribution fields from a request body into Lead columns.
export function parseAttribution(body: any): Attribution {
  const s = (v: unknown) => { const t = String(v ?? "").trim(); return t ? t.slice(0, 255) : null; };
  return {
    utmSource: s(body?.utmSource),
    utmMedium: s(body?.utmMedium),
    utmCampaign: s(body?.utmCampaign),
    utmTerm: s(body?.utmTerm),
    utmContent: s(body?.utmContent),
    gclid: s(body?.gclid),
    fbclid: s(body?.fbclid),
    referrer: s(body?.referrer),
  };
}
