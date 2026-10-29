// Partner-branded client presentations (partner portal phase 3e, Decision 7). Pure: the public page
// /c/[token], its logo route and the view route take their branding decisions from here.
//
// A presentation WITHOUT a partnerId is "cve" mode and nothing else: the page keeps its existing
// code path (advisor block, office WhatsApp number, CVE logo) untouched.

export type PresentationBrandPartner = {
  brandName: string | null;
  company: string | null;
  firstName: string;
  lastName: string;
  brandPhone: string | null;
  brandEmail: string | null;
  brandWebsite: string | null;
  /** A logo is stored (brandLogoType and brandLogo are always written and cleared together). */
  hasLogo: boolean;
  /** Cache-busting version for the logo URL (brandLogoUpdatedAt). */
  logoUpdatedAt?: Date | null;
};

export type PresentationBranding =
  | { mode: "cve" }
  | {
      mode: "partner";
      name: string;
      phone: string | null;
      /** Digits only (wa.me format), from brandPhone; null without a phone. */
      whatsapp: string | null;
      email: string | null;
      website: string | null;
      logoUrl: string | null;
    };

const clean = (v: string | null | undefined): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
};

/** Shown name: brandName, else company, else first + last name. */
export function brandDisplayName(p: Pick<PresentationBrandPartner, "brandName" | "company" | "firstName" | "lastName">): string {
  return clean(p.brandName) ?? clean(p.company) ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
}

/** Digits of a phone number for wa.me links; null when fewer than 6 digits remain. */
export function whatsappDigits(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 6 ? d : null;
}

/** Only https URLs reach an href (validateBrand already enforces it; this is the render-side guard). */
function safeWebsite(w: string | null | undefined): string | null {
  const s = clean(w);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? s : null;
  } catch {
    return null;
  }
}

export function presentationBranding(p: {
  token: string;
  partnerId: string | null;
  partner?: PresentationBrandPartner | null;
}): PresentationBranding {
  if (!p.partnerId) return { mode: "cve" };
  // A partner presentation never falls back to CVE contact data, even if the partner row is missing.
  const partner = p.partner ?? null;
  if (!partner) return { mode: "partner", name: "", phone: null, whatsapp: null, email: null, website: null, logoUrl: null };
  const phone = clean(partner.brandPhone);
  const version = partner.logoUpdatedAt ? `?v=${partner.logoUpdatedAt.getTime()}` : "";
  return {
    mode: "partner",
    name: brandDisplayName(partner),
    phone,
    whatsapp: whatsappDigits(phone),
    email: clean(partner.brandEmail),
    website: safeWebsite(partner.brandWebsite),
    logoUrl: partner.hasLogo ? `/c/${encodeURIComponent(p.token)}/logo${version}` : null,
  };
}

/**
 * A partner presentation is shown only while its partner is ACTIVE: a suspended (or otherwise inactive,
 * or missing) partner's presentations get the "not available" page and their logo route answers 404.
 */
export function partnerPresentationAvailable(partner: { status: string } | null | undefined): boolean {
  return partner?.status === "ACTIVE";
}

// ── Partner preview (not a client view) ─────────────────────────────────────

/**
 * The portal's own "Open" links add `?preview=1`, so the partner looking at their presentation is not
 * recorded as the client opening it (no PresentationView, no PRESENTATION_OPENED notification, no
 * office alert). This is a SOFT marker: anyone holding the link can add it, and all it does is skip view
 * tracking — it grants nothing. The link the partner copies for the client never carries it.
 */
export const PREVIEW_PARAM = "preview";

/** The portal's "Open" link for a presentation URL. */
export function presentationPreviewUrl(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${PREVIEW_PARAM}=1`;
}

/** `?preview=1` present in the page's searchParams (first value wins for a repeated key). */
export function isPreviewRequest(searchParams: Record<string, string | string[] | undefined> | null | undefined): boolean {
  const v = searchParams?.[PREVIEW_PARAM];
  return (Array.isArray(v) ? v[0] : v) === "1";
}

/**
 * Whether /c/[token] records views (page-level ViewTracker and the overlay's view POST). Only a partner
 * presentation honours the preview marker; a staff presentation (no partnerId) tracks unless the visitor is
 * signed in to the CRM (`staff`, 2026-10-29: the team opening a selection is not the client looking at it).
 */
export function tracksClientViews(p: { partnerId: string | null; preview: boolean; staff?: boolean }): boolean {
  if (p.staff) return false;
  return !p.partnerId || !p.preview;
}

/**
 * Whether a heart click is saved (POST /api/c/[token]/favorite). Same rule as views: in a partner preview
 * the hearts are local-only; a staff presentation always saves, as before.
 */
export function savesClientFavorites(p: { partnerId: string | null; preview: boolean; staff?: boolean }): boolean {
  return tracksClientViews(p);
}

// ── Share metadata (partner mode) ───────────────────────────────────────────

/**
 * Link-preview image for a partner presentation: a plain district photo (the Limassol hero the page itself
 * uses), never the Cyprus VIP Estates share image.
 */
export const PARTNER_SHARE_IMAGE = { path: "/uploads/images/7002ff319a170a66ef37739e608e14a0e3b0a9c1-2560x1441.jpg", width: 2560, height: 1441 } as const;

/**
 * Tab/share title of a partner presentation: "{localized title} — {brand name}" for an ACTIVE partner with a
 * name, else the localized title alone. Never the client's name (metadata carries no per-client content).
 */
export function partnerShareTitle(
  metaTitle: string,
  partner: (Pick<PresentationBrandPartner, "brandName" | "company" | "firstName" | "lastName"> & { status: string }) | null | undefined,
): string {
  if (!partner || !partnerPresentationAvailable(partner)) return metaTitle;
  const name = brandDisplayName(partner);
  return name ? `${metaTitle} — ${name}` : metaTitle;
}

/** Display form of a website URL (no scheme, no trailing slash). */
export function websiteLabel(url: string): string {
  return url.replace(/^https:\/\//, "").replace(/\/$/, "");
}

// ── Logo route ──────────────────────────────────────────────────────────────

export type LogoRow = {
  status: string;
  expiresAt: Date | null;
  partnerId: string | null;
  partner: { status: string; brandLogo: Uint8Array | null; brandLogoType: string | null } | null;
} | null;

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Serve the logo only for an active, unexpired presentation of an ACTIVE partner with a stored logo of an allowed type. */
export function logoDecision(row: LogoRow, now: Date): { ok: true; bytes: Uint8Array; type: string } | { ok: false } {
  if (!row || row.status !== "active" || !row.partnerId) return { ok: false };
  if (row.expiresAt && row.expiresAt < now) return { ok: false };
  if (!partnerPresentationAvailable(row.partner)) return { ok: false };
  const bytes = row.partner?.brandLogo;
  const type = row.partner?.brandLogoType ?? "";
  if (!bytes || bytes.length === 0 || !LOGO_TYPES.has(type)) return { ok: false };
  return { ok: true, bytes, type };
}

/** Private, short cache: a suspension, revocation or logo change must not be outlived by shared caches. */
export const LOGO_HEADERS = { "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } as const;

// ── View route: PRESENTATION_OPENED producer and the office Telegram prefix ─

export type PresentationOpenedRow = {
  kind: "PRESENTATION_OPENED";
  refKey: string;
  partnerId: string;
  leadId: string;
  payload: { clientName: string };
};

/**
 * The outbox row for a partner presentation's first page-level view (developmentId null, no earlier
 * page-level view); null otherwise. refKey is unique, so a race still yields a single row.
 */
export function presentationOpenedRow(input: {
  presentation: { id: string; leadId: string; partnerId: string | null; greetingName: string };
  developmentId: string | null;
  priorPageVisits: number;
  /** The partner's own submission name for this lead, if a claim was found. */
  claimName: string | null;
}): PresentationOpenedRow | null {
  const { presentation: p } = input;
  if (!p.partnerId || input.developmentId != null || input.priorPageVisits > 0) return null;
  const clientName = (clean(input.claimName) ?? clean(p.greetingName) ?? "").slice(0, 120);
  return { kind: "PRESENTATION_OPENED", refKey: `presopen:${p.id}`, partnerId: p.partnerId, leadId: p.leadId, payload: { clientName } };
}

/** Office Telegram prefix for partner presentations ("" for CVE ones). The caller HTML-escapes the name. */
export function officeAlertPrefix(partnerNameEscaped: string | null): string {
  return partnerNameEscaped === null ? "" : `Partner presentation (${partnerNameEscaped}) — `;
}
