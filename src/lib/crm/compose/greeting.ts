// Deterministic salutation construction — never left to the model, since it
// must reproduce exact names/titles verbatim (same hallucination-guard
// reasoning as matched-property data). Only used for the FIRST-CONTACT
// opening line (state NEW); for every other state the model is instructed to
// mirror whatever address style the lead has already used in the timeline.

import { bidiIsolate, isLocale, type Locale } from "@/lib/locale";

export type SalutationTitle = "UNKNOWN" | "MR" | "MS";

function clean(name: string | null | undefined): string {
  const s = (name ?? "").replace(/^_+/, "").trim();
  return /^unknown$/i.test(s) ? "" : s;
}

type GreetingArgs = { first: string; last: string; salutation: SalutationTitle };

const GREETING_EN = ({ first }: GreetingArgs): string => (first ? `Hi ${first},` : `Hi,`);

const GREETING: Record<Locale, (args: GreetingArgs) => string> = {
  en: GREETING_EN,
  de: ({ first, last, salutation }) => {
    if (salutation === "MR" && last) return `Sehr geehrter Herr ${last},`;
    if (salutation === "MS" && last) return `Sehr geehrte Frau ${last},`;
    if (first && last) return `Guten Tag ${first} ${last},`;
    if (first) return `Guten Tag ${first},`;
    return `Guten Tag,`;
  },
  pl: ({ first, last, salutation }) => {
    if (salutation === "MR" && last) return `Szanowny Panie ${last},`;
    if (salutation === "MS" && last) return `Szanowna Pani ${last},`;
    if (first && last) return `Dzień dobry, ${first} ${last},`;
    if (first) return `Dzień dobry, ${first},`;
    return `Dzień dobry,`;
  },
  ru: ({ first }) => (first ? `Здравствуйте, ${first},` : `Здравствуйте,`),
  // Hebrew has no neutral "Herr/Frau [Nachname]" register in business e-mail —
  // Israeli practice is the first name, and any titled form would force a
  // gender choice (styleguide §2). `שלום` covers every time of day.
  he: ({ first }) => (first ? `שלום ${bidiIsolate(first)},` : `שלום,`), // REVIEW(he)
};

export function buildFirstContactGreeting(
  lead: { firstName: string | null; lastName: string | null; salutation: SalutationTitle },
  language: string,
): string {
  const first = clean(lead.firstName);
  const last = clean(lead.lastName);
  const lang: Locale = isLocale(language) ? language : "en";
  return GREETING[lang]({ first, last, salutation: lead.salutation });
}

// The "thank you! my name is Sascha Dith from Cyprus VIP Estates" sentence
// that always follows the greeting on first contact (see examples.md) —
// deterministic so the company name and the one permitted exclamation mark
// never drift or get mangled by the model.
const FIRST_CONTACT_INTRO_EN = "thank you for your message! My name is Sascha Dith from Cyprus VIP Estates.";

const FIRST_CONTACT_INTRO: Record<Locale, string> = {
  en: FIRST_CONTACT_INTRO_EN,
  de: "vielen Dank für Ihre Anfrage! Mein Name ist Sascha Dith von Cyprus VIP Estates.",
  ru: "спасибо за ваше обращение! Меня зовут Саша Дит, я из Cyprus VIP Estates.",
  pl: "dziękuję za wiadomość! Nazywam się Sascha Dith z Cyprus VIP Estates.",
  // Carries the consulting-language note (glossary §5, Entscheidung E) — this
  // is the one first-contact line every Hebrew lead sees, and the playbook
  // (compose/playbook/by-language.md) tells the model not to repeat it later.
  he: "תודה על ההודעה! שמי Sascha Dith, מסוכנות Cyprus VIP Estates. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.", // REVIEW(he)
};

export function buildFirstContactOpening(
  lead: { firstName: string | null; lastName: string | null; salutation: SalutationTitle },
  language: string,
): string {
  const greeting = buildFirstContactGreeting(lead, language);
  const intro = FIRST_CONTACT_INTRO[isLocale(language) ? language : "en"];
  return `${greeting}\n\n${intro}`;
}
