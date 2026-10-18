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

/** Display form of a website URL (no scheme, no trailing slash). */
export function websiteLabel(url: string): string {
  return url.replace(/^https:\/\//, "").replace(/\/$/, "");
}

// ── Logo route ──────────────────────────────────────────────────────────────

export type LogoRow = {
  status: string;
  expiresAt: Date | null;
  partnerId: string | null;
  partner: { brandLogo: Uint8Array | null; brandLogoType: string | null } | null;
} | null;

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Serve the logo only for an active, unexpired partner presentation with a stored logo of an allowed type. */
export function logoDecision(row: LogoRow, now: Date): { ok: true; bytes: Uint8Array; type: string } | { ok: false } {
  if (!row || row.status !== "active" || !row.partnerId) return { ok: false };
  if (row.expiresAt && row.expiresAt < now) return { ok: false };
  const bytes = row.partner?.brandLogo;
  const type = row.partner?.brandLogoType ?? "";
  if (!bytes || bytes.length === 0 || !LOGO_TYPES.has(type)) return { ok: false };
  return { ok: true, bytes, type };
}

export const LOGO_HEADERS = { "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } as const;

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
