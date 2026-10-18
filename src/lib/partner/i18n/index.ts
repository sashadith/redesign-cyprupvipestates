import { en, type PartnerDict } from "./en";
import { de } from "./de";
import { pl } from "./pl";
import { ru } from "./ru";

export type { PartnerDict };
import { LOCALES, type Locale } from "@/lib/locale";

/** The partner portal is never offered in Hebrew (not a verified locale for it). */
export type PartnerLocale = Exclude<Locale, "he">;
export const PARTNER_LOCALES: readonly PartnerLocale[] = LOCALES.filter((l): l is PartnerLocale => l !== "he");
export const PARTNER_LANG_COOKIE = "cve_partner_lang";

const DICTS: Record<PartnerLocale, PartnerDict> = { en, de, pl, ru };

export function dict(locale: PartnerLocale): PartnerDict {
  return DICTS[locale];
}

/** Resolve a dotted key such as "err.email" in the given locale; undefined if missing. */
export function lookup(locale: PartnerLocale, path: string): string | undefined {
  let cur: unknown = DICTS[locale];
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as object)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

/**
 * Replace {name}-style placeholders. Unknown placeholders are left as-is.
 * NOTE: no HTML escaping — the caller must escape values (or the result) for HTML contexts.
 */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const isLocale = (v: unknown): v is PartnerLocale => typeof v === "string" && (PARTNER_LOCALES as readonly string[]).includes(v);

function fromAcceptLanguage(header: string | null | undefined): PartnerLocale | null {
  if (!header) return null;
  const items = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const qv = q ? Number(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split("-")[0], q: Number.isFinite(qv) ? qv : 0, i };
    })
    .filter((x) => x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const it of items) if (isLocale(it.lang)) return it.lang;
  return null;
}

/** Priority: partner's saved setting > cookie cve_partner_lang > Accept-Language > en. */
export function pickPartnerLocale(input: {
  cookie?: string | null;
  acceptLanguage?: string | null;
  partnerLanguage?: string | null;
}): PartnerLocale {
  if (isLocale(input.partnerLanguage)) return input.partnerLanguage;
  if (isLocale(input.cookie)) return input.cookie;
  return fromAcceptLanguage(input.acceptLanguage) ?? "en";
}
