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

export type ConsentCopy = {
  lead: string;
  termsLabel: string;
  termsHref: string;
  mid: string;
  privacyLabel: string;
  privacyHref: string;
  tail: string;
};

const CONSENT: Record<string, ConsentCopy> = {
  en: {
    lead: "I agree to the ", termsLabel: "Terms and Conditions", termsHref: "/terms-and-conditions",
    mid: " and the ", privacyLabel: "Data Privacy Policy", privacyHref: "/privacy-policy", tail: "",
  },
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
};

export function consentCopy(lang: string): ConsentCopy {
  return CONSENT[lang] ?? CONSENT.en;
}
