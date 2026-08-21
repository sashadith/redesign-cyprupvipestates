import type { LegalDoc } from "./types";
import { PRIVACY_EN } from "./privacy.en";
import { PRIVACY_DE } from "./privacy.de";
import { PRIVACY_PL } from "./privacy.pl";
import { PRIVACY_RU } from "./privacy.ru";
import { TERMS_EN } from "./terms.en";
import { TERMS_DE } from "./terms.de";
import { TERMS_PL } from "./terms.pl";
import { TERMS_RU } from "./terms.ru";

export type LegalDocKey = "privacy" | "terms";

/* One place that knows which document exists in which locale. The type
   annotation is what keeps the four languages provably parallel — adding a
   section to the English privacy policy without adding it to the other three
   is a compile error, not something discovered a year later. */
const DOCS: Record<LegalDocKey, Record<string, LegalDoc>> = {
  privacy: { en: PRIVACY_EN, de: PRIVACY_DE, pl: PRIVACY_PL, ru: PRIVACY_RU },
  terms: { en: TERMS_EN, de: TERMS_DE, pl: TERMS_PL, ru: TERMS_RU },
};

export function getLegalDoc(doc: string, lang: string): LegalDoc | null {
  const byLocale = DOCS[doc as LegalDocKey];
  if (!byLocale) return null;
  return byLocale[lang] ?? byLocale.en ?? null;
}

export const isLegalDocKey = (v: string): v is LegalDocKey => v === "privacy" || v === "terms";
