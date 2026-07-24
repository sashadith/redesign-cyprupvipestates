// Deterministic email closing — valediction + real name (+ either a role
// line or the company name, see variant), appended in code (never generated
// by the model) so the exact wording never drifts or gets mistranslated.
// Blank lines between each part are intentional (see the 2026-07-24 spacing
// fix) — the signature block itself (logo/contact/social) starts right
// after this, appended separately by sendCrmEmailAction via getSignatureHtml.

const SIGNER_NAME = "Sascha Dith";
const COMPANY_NAME = "Cyprus VIP Estates";

const VALEDICTION: Record<string, string> = {
  en: "Best regards,",
  de: "Mit freundlichen Grüßen,",
  ru: "С уважением,",
  pl: "Z poważaniem,",
};

const ROLE_LINE: Record<string, string> = {
  en: "Your personal property advisor",
  de: "Ihr persönlicher Immobilienberater",
  ru: "Ваш персональный консультант по недвижимости",
  pl: "Twój osobisty doradca nieruchomości",
};

export type ClosingVariant = "role-line" | "company-name";

// Decided 2026-07-24: role-line variant. Exact layout, blank line only after
// the valediction — name and role line sit directly under each other with no
// gap between them (see the rendered-HTML check in the same commit).
export function buildEmailClosing(language: string, variant: ClosingVariant = "role-line"): string {
  const lang = VALEDICTION[language] ? language : "en";
  if (variant === "company-name") {
    return `${VALEDICTION[lang]} ${SIGNER_NAME}\n\n${COMPANY_NAME}`;
  }
  return `${VALEDICTION[lang]}\n\n${SIGNER_NAME}\n${ROLE_LINE[lang]}`;
}
