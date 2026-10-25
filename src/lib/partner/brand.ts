// Partner branding for partner-sent presentations (partner portal phase 3e, Decision 7). Pure.
import { normalizePartnerPhone, PARTNER_EMAIL_RE } from "./registration";

export const BRAND_LOGO_MAX_BYTES = 300 * 1024;
export const BRAND_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type BrandLogoType = (typeof BRAND_LOGO_TYPES)[number];

export type BrandInput = { brandName: string | null; brandPhone: string | null; brandEmail: string | null; brandWebsite: string | null };
export type BrandResult = { ok: true; data: BrandInput } | { ok: false; field: string; code: string };

/** Every `code` validateBrand / the logo upload can return (dotted keys into the partner dictionary). */
export const BRAND_ERROR_CODES = [
  "err.invalid", "err.unknownField", "err.brandName", "err.phone", "err.email", "err.website", "err.logoType", "err.logoSize",
] as const;

const ALLOWED = new Set(["brandName", "brandPhone", "brandEmail", "brandWebsite"]);
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const URL_UNSAFE_RE = /[\s"'<>`\\]/;

const fail = (field: string, code: string): BrandResult => ({ ok: false, field, code });
/** undefined / null / blank → null; a non-string → undefined (invalid). */
const optional = (v: unknown): string | null | undefined => {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  return v.trim() || null;
};

function websiteOk(w: string): boolean {
  if (w.length > 200 || !w.startsWith("https://") || URL_UNSAFE_RE.test(w)) return false;
  try {
    const u = new URL(w);
    return u.protocol === "https:" && u.hostname.includes(".") && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** All fields optional; unknown keys rejected. Phone as in registration, website https only. */
export function validateBrand(raw: unknown): BrandResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("_", "err.invalid");
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!ALLOWED.has(k)) return fail(k, "err.unknownField");

  const brandName = optional(r.brandName);
  if (brandName === undefined || (brandName && (brandName.length > 80 || CONTROL_RE.test(brandName)))) return fail("brandName", "err.brandName");

  const phoneRaw = optional(r.brandPhone);
  if (phoneRaw === undefined) return fail("brandPhone", "err.phone");
  const brandPhone = phoneRaw === null ? null : normalizePartnerPhone(phoneRaw);
  if (phoneRaw !== null && !brandPhone) return fail("brandPhone", "err.phone");

  const emailRaw = optional(r.brandEmail);
  const brandEmail = emailRaw ? emailRaw.toLowerCase() : emailRaw;
  if (brandEmail === undefined || (brandEmail && (brandEmail.length > 254 || !PARTNER_EMAIL_RE.test(brandEmail)))) return fail("brandEmail", "err.email");

  const brandWebsite = optional(r.brandWebsite);
  if (brandWebsite === undefined || (brandWebsite && !websiteOk(brandWebsite))) return fail("brandWebsite", "err.website");

  return { ok: true, data: { brandName, brandPhone, brandEmail, brandWebsite } };
}

const startsWith = (b: Uint8Array, sig: number[], at = 0) => b.length >= at + sig.length && sig.every((x, i) => b[at + i] === x);

/** Logo type from magic bytes — never from the file name or the browser's claimed type. SVG/GIF are refused. */
export function sniffImageType(bytes: Uint8Array): BrandLogoType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/**
 * Upload check for a logo file (phase 3e, Task 5): empty → err.logoType, over BRAND_LOGO_MAX_BYTES →
 * err.logoSize, type from the magic bytes only (the browser's claimed MIME type is never used).
 */
export function checkBrandLogo(bytes: Uint8Array): { ok: true; type: BrandLogoType } | { ok: false; code: "err.logoType" | "err.logoSize" } {
  if (!bytes.length) return { ok: false, code: "err.logoType" };
  if (bytes.length > BRAND_LOGO_MAX_BYTES) return { ok: false, code: "err.logoSize" };
  const type = sniffImageType(bytes);
  return type ? { ok: true, type } : { ok: false, code: "err.logoType" };
}
