// Marketing attribution helpers — shared by client forms (capture) and API routes (parse).
// No "use client" directive: every function guards window access so it is safe to import
// from both client components and server route handlers.
//
// Two stores, both FIRST TOUCH (a later visit without parameters never overwrites):
//  - sessionStorage (KEY): the current visit in this tab. Always on — the same
//    behaviour the site has had since attribution was added.
//  - a first-party cookie (ATTRIBUTION_COOKIE), 90 days: ONLY with marketing
//    consent from the cookie banner. Remembering a partner referral across visits
//    is not strictly necessary for the site to work, so it waits for consent and
//    is deleted when marketing consent is refused (2026-09-28, partner links such
//    as https://cyprusvipestates.com/?utm_source=alfitouri).

export type Attribution = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  referrer?: string | null;
  /** The `?ref=` parameter partners may use instead of (or besides) utm_source. */
  attributionRef?: string | null;
};

const KEY = "cve_attribution";
export const ATTRIBUTION_COOKIE = "cve_attr";
export const ATTRIBUTION_DAYS = 90;
const CONSENT_COOKIE = "cookieConsent"; // written by CustomCookieConsent

const PARAM_MAP: Record<string, keyof Attribution> = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_term: "utmTerm",
  utm_content: "utmContent",
  gclid: "gclid",
  fbclid: "fbclid",
  ref: "attributionRef",
};

/* Everything except `referrer`: an explicit campaign / partner / click signal. */
const CAMPAIGN_KEYS: (keyof Attribution)[] = ["utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent", "gclid", "fbclid", "attributionRef"];

const nonEmpty = (a: Attribution | null | undefined): a is Attribution => !!a && Object.values(a).some((v) => !!v);
export const hasCampaign = (a: Attribution | null | undefined): boolean => !!a && CAMPAIGN_KEYS.some((k) => !!a[k]);

// PURE: what a page URL + document.referrer contribute. The referrer counts only
// when it is another site.
export function readLandingParams(search: string, referrer: string, host: string): Attribution {
  const out: Attribution = {};
  const params = new URLSearchParams(search);
  for (const [param, key] of Object.entries(PARAM_MAP)) {
    const v = params.get(param);
    if (v && v.trim()) out[key] = v.trim().slice(0, 255);
  }
  try {
    const refHost = referrer ? new URL(referrer).host : "";
    if (referrer && refHost && refHost !== host) out.referrer = referrer.slice(0, 255);
  } catch { /* ignore malformed referrer */ }
  return out;
}

// PURE: first-touch merge. The stored value wins, with one exception: a stored
// value that is only a referrer (e.g. arrived from Google) gives way to the
// first explicit campaign/partner parameters — otherwise a partner link clicked
// later in the same visit could never be attributed. The original referrer is
// kept alongside.
export function mergeFirstTouch(stored: Attribution | null | undefined, incoming: Attribution | null | undefined): Attribution | null {
  const s = nonEmpty(stored) ? stored : null;
  const i = nonEmpty(incoming) ? incoming : null;
  if (!s) return i;
  if (!i) return s;
  if (hasCampaign(s)) return s;
  if (hasCampaign(i)) return { ...i, referrer: s.referrer ?? i.referrer ?? null };
  return s;
}

// PURE: the marketing flag from the consent cookie's raw value (js-cookie
// stores it URI-encoded JSON). No decision yet, or unreadable → false.
export function marketingConsentFrom(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    return JSON.parse(decodeURIComponent(raw))?.marketing === true;
  } catch {
    return false;
  }
}

/* ── browser plumbing ───────────────────────────────────────────────────── */

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(name + "="));
  return hit ? hit.slice(name.length + 1) : null;
}

function readStoredCookie(): Attribution | null {
  const raw = readCookie(ATTRIBUTION_COOKIE);
  if (!raw) return null;
  try { return JSON.parse(decodeURIComponent(raw)) as Attribution; } catch { return null; }
}

function writeCookie(a: Attribution): void {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(a))}; Max-Age=${ATTRIBUTION_DAYS * 86400}; Path=/; SameSite=Lax${secure}`;
}

function deleteCookie(): void {
  document.cookie = `${ATTRIBUTION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function readSession(): Attribution | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch { return null; }
}

export function hasMarketingConsent(): boolean {
  return marketingConsentFrom(readCookie(CONSENT_COOKIE));
}

// CLIENT: capture first-touch attribution. Safe to call on every page load.
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const incoming = readLandingParams(window.location.search, document.referrer || "", window.location.host);
    const session = readSession();
    const nextSession = mergeFirstTouch(session, incoming);
    if (nextSession && JSON.stringify(nextSession) !== JSON.stringify(session)) {
      window.sessionStorage.setItem(KEY, JSON.stringify(nextSession));
    }
    syncConsentCookie(nextSession);
  } catch { /* attribution must never break the page */ }
}

/* The 90-day cookie follows the consent: written (first touch, expiry counted
   from that first touch — it is only rewritten when its content changes) while
   marketing consent is given; removed once it is refused. */
function syncConsentCookie(current: Attribution | null): void {
  const consentRaw = readCookie(CONSENT_COOKIE);
  const stored = readStoredCookie();
  if (!marketingConsentFrom(consentRaw)) {
    if (consentRaw && stored) deleteCookie(); // a decision was made, and it was not "marketing"
    return;
  }
  const next = mergeFirstTouch(stored, current);
  if (next && JSON.stringify(next) !== JSON.stringify(stored)) writeCookie(next);
}

// CLIENT: call right after the visitor answers the cookie banner.
export function onMarketingConsentChanged(): void {
  if (typeof window === "undefined") return;
  try { syncConsentCookie(readSession()); } catch { /* never break the banner */ }
}

// CLIENT: read the stored attribution to merge into a form submission body. The
// 90-day cookie holds the earliest touch, so it goes first.
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    captureAttribution(); // ensure entry-page data is captured even if no tracker ran
    const cookie = hasMarketingConsent() ? readStoredCookie() : null;
    return mergeFirstTouch(cookie, readSession()) ?? {};
  } catch { return {}; }
}

// PURE: the tag appended to a pre-filled WhatsApp message, so a chat can be
// attributed like a form lead. Empty when there is nothing to tell, or when the
// page URL in the message already carries it.
export function attributionTag(a: Attribution | null | undefined, pageUrl = ""): string {
  if (!a) return "";
  const parts: string[] = [];
  if (a.utmSource && !pageUrl.includes(`utm_source=${encodeURIComponent(a.utmSource)}`)) parts.push(`utm_source=${a.utmSource}`);
  if (a.attributionRef && !pageUrl.includes(`ref=${encodeURIComponent(a.attributionRef)}`)) parts.push(`ref=${a.attributionRef}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
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
    attributionRef: s(body?.attributionRef),
  };
}
