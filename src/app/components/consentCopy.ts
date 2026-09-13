/* The consent line under every checkbox, in one place.
 *
 * Two links, not one: the terms and the privacy policy. FormStandard gets its
 * pair from the CMS (form.agreementLink2Label and friends); every other form
 * carried the text in its own file, and FormRoi and QualificationForm linked
 * the privacy policy only — so the same checkbox promised different things
 * depending on which page a visitor was standing on.
 *
 * The hrefs are the real localized slugs, verified live on 2026-09-06:
 *   /terms-and-conditions            /privacy-policy
 *   /de/geschaftsbedingungen         /de/datenschutzrichtlinie
 *   /pl/warunki                      /pl/polityka-prywatnosci
 *   /ru/uslovija-i-polozhenija       /ru/politika-privatnosti
 *
 * `lead`/`mid`/`tail` exist because the sentence brackets the links
 * differently per language: German closes with " zu" after the second link,
 * the other three end at the link itself. */

import type { Locale } from "@/lib/locale";

export type ConsentCopy = {
  lead: string;
  termsLabel: string;
  termsHref: string;
  mid: string;
  privacyLabel: string;
  privacyHref: string;
  tail: string;
};

const EN: ConsentCopy = {
  lead: "I agree to the ", termsLabel: "Terms and Conditions", termsHref: "/terms-and-conditions",
  mid: " and the ", privacyLabel: "Data Privacy Policy", privacyHref: "/privacy-policy", tail: "",
};

const CONSENT: Record<Locale, ConsentCopy> = {
  en: EN,
  de: {
    lead: "Ich stimme den ", termsLabel: "AGB", termsHref: "/de/geschaftsbedingungen",
    mid: " und der ", privacyLabel: "Datenschutzrichtlinie", privacyHref: "/de/datenschutzrichtlinie", tail: " zu",
  },
  pl: {
    lead: "Zgadzam się z ", termsLabel: "Regulaminem", termsHref: "/pl/warunki",
    mid: " i ", privacyLabel: "Polityką Prywatności", privacyHref: "/pl/polityka-prywatnosci", tail: "",
  },
  ru: {
    lead: "Согласен с ", termsLabel: "Условиями", termsHref: "/ru/uslovija-i-polozhenija",
    mid: " и ", privacyLabel: "Политикой конфиденциальности", privacyHref: "/ru/politika-privatnosti", tail: "",
  },
  // he: the hrefs stay the EN slugs under the /he prefix (registry.ts's
  // CORPORATE_SLUGS.terms/privacy.he). The checkbox label uses the one
  // gendered form the style guide allows (§2.3 exception, glossary §4).
  he: {
    lead: "קראתי את ", termsLabel: "תנאי השימוש", termsHref: "/he/terms-and-conditions",
    mid: " ואת ", privacyLabel: "מדיניות הפרטיות", privacyHref: "/he/privacy-policy",
    tail: " ואני מאשר/ת",
  }, // REVIEW(he)
};

export function consentCopy(lang: string): ConsentCopy {
  return CONSENT[lang as Locale] ?? CONSENT.en;
}
