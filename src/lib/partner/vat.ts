/**
 * Partner VAT number rules (plan 3d, Decision 10). Pure: shared by registration, profile, CRM and tests.
 * A company registered in an EU member state must give its VAT number; vatMode follows from
 * country + vatId unless an operator set it manually (Partner.vatModeManual).
 */
export type DerivedVatMode = "NONE" | "CY_VAT" | "REVERSE_CHARGE";

/** EU-27 member states, ISO 3166-1 alpha-2. */
export const EU_COUNTRIES: readonly string[] = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];
const EU = new Set(EU_COUNTRIES);

export const isEuCountry = (country: string): boolean => EU.has(country.trim().toUpperCase());

/** VAT prefix of a country: Greece uses "EL", every other state its ISO code. */
export function vatPrefixFor(country: string): string {
  const c = country.trim().toUpperCase();
  return c === "GR" ? "EL" : c;
}

/** Upper-case, without spaces, dots and dashes. */
export function normaliseVatId(s: string): string {
  return s.replace(/[\s.-]+/g, "").toUpperCase();
}

/** EU format: the country's prefix, then 2–13 letters/digits. Input may be unnormalised. */
export function euVatIdValid(country: string, vatId: string): boolean {
  const v = normaliseVatId(vatId);
  const prefix = vatPrefixFor(country);
  if (!/^[A-Z]{2}$/.test(prefix) || !v.startsWith(prefix)) return false;
  return /^[A-Z0-9]{2,13}$/.test(v.slice(2));
}

/** Outside the EU: a generic 4–20 letters/digits after normalisation. */
export function genericVatIdValid(vatId: string): boolean {
  return /^[A-Z0-9]{4,20}$/.test(normaliseVatId(vatId));
}

/** A company in an EU member state must give its VAT number. */
export function vatIdRequired(i: { country: string; company: string | null | undefined }): boolean {
  return isEuCountry(i.country) && !!(i.company ?? "").trim();
}

/** REVERSE_CHARGE for an EU business outside Cyprus with a VAT number, CY_VAT for Cyprus with one, else NONE. */
export function deriveVatMode(i: { country: string; vatId: string | null | undefined }): DerivedVatMode {
  if (!(i.vatId ?? "").trim()) return "NONE";
  const c = i.country.trim().toUpperCase();
  if (c === "CY") return "CY_VAT";
  if (EU.has(c)) return "REVERSE_CHARGE";
  return "NONE";
}

/** An EU company without a stored VAT number: shown as a prompt on /profile and an onboarding item on /home. */
export function vatIdMissing(p: { country: string; company: string | null | undefined; vatId: string | null | undefined }): boolean {
  return vatIdRequired(p) && !(p.vatId ?? "").trim();
}

/**
 * Soft path for existing partners (registered before the rule): while no VAT number is stored and the company
 * name stays the same, a save without one is accepted. A new registration or a changed company name gets the
 * hard rule.
 */
export function vatIdSoftExempt(
  stored: { vatId: string | null | undefined; company: string | null | undefined },
  nextCompany: string | null | undefined,
): boolean {
  return !(stored.vatId ?? "").trim() && (stored.company ?? "").trim() === (nextCompany ?? "").trim();
}

export type VatIdCheck = { ok: true; vatId: string | null } | { ok: false; code: "err.vatIdRequired" | "err.vatIdFormat" };

/**
 * One rule for every entry point: empty → null unless required (and not `allowMissing`, the soft path);
 * EU country → EU format; elsewhere → generic format. Returns the normalised value to store.
 */
export function checkPartnerVatId(i: { country: string; company: string | null | undefined; vatId: unknown; allowMissing?: boolean }): VatIdCheck {
  if (i.vatId !== undefined && i.vatId !== null && typeof i.vatId !== "string") return { ok: false, code: "err.vatIdFormat" };
  const raw = typeof i.vatId === "string" ? i.vatId : "";
  if (raw.length > 40) return { ok: false, code: "err.vatIdFormat" };
  const v = normaliseVatId(raw);
  if (!v) return vatIdRequired(i) && !i.allowMissing ? { ok: false, code: "err.vatIdRequired" } : { ok: true, vatId: null };
  const valid = isEuCountry(i.country) ? euVatIdValid(i.country, v) : genericVatIdValid(v);
  return valid ? { ok: true, vatId: v } : { ok: false, code: "err.vatIdFormat" };
}

/** The mode to store after a VAT-number change: a manually set mode stays, otherwise it is re-derived. */
export function vatModeAfterChange(
  current: { vatMode: DerivedVatMode; vatModeManual: boolean },
  next: { country: string; vatId: string | null },
): DerivedVatMode {
  return current.vatModeManual ? current.vatMode : deriveVatMode(next);
}

/** Recipient VAT number on a credit note: the partner's own VAT number wins, the bank-details one is the fallback. */
export function creditNoteRecipientVatId(partnerVatId: string | null | undefined, bankVatId: string | null | undefined): string | null {
  return partnerVatId?.trim() || bankVatId?.trim() || null;
}
