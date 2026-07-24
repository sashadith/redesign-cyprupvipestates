// Deterministic salutation construction — never left to the model, since it
// must reproduce exact names/titles verbatim (same hallucination-guard
// reasoning as matched-property data). Only used for the FIRST-CONTACT
// opening line (state NEW); for every other state the model is instructed to
// mirror whatever address style the lead has already used in the timeline.

export type SalutationTitle = "UNKNOWN" | "MR" | "MS";

function clean(name: string | null | undefined): string {
  const s = (name ?? "").replace(/^_+/, "").trim();
  return /^unknown$/i.test(s) ? "" : s;
}

export function buildFirstContactGreeting(
  lead: { firstName: string | null; lastName: string | null; salutation: SalutationTitle },
  language: string,
): string {
  const first = clean(lead.firstName);
  const last = clean(lead.lastName);

  switch (language) {
    case "de":
      if (lead.salutation === "MR" && last) return `Sehr geehrter Herr ${last},`;
      if (lead.salutation === "MS" && last) return `Sehr geehrte Frau ${last},`;
      if (first && last) return `Guten Tag ${first} ${last},`;
      if (first) return `Guten Tag ${first},`;
      return `Guten Tag,`;
    case "pl":
      if (lead.salutation === "MR" && last) return `Szanowny Panie ${last},`;
      if (lead.salutation === "MS" && last) return `Szanowna Pani ${last},`;
      if (first && last) return `Dzień dobry, ${first} ${last},`;
      if (first) return `Dzień dobry, ${first},`;
      return `Dzień dobry,`;
    case "ru":
      return first ? `Здравствуйте, ${first},` : `Здравствуйте,`;
    default: // en
      return first ? `Hi ${first},` : `Hi,`;
  }
}

// The "thank you! my name is Sascha Dith from Cyprus VIP Estates" sentence
// that always follows the greeting on first contact (see examples.md) —
// deterministic so the company name and the one permitted exclamation mark
// never drift or get mangled by the model.
const FIRST_CONTACT_INTRO: Record<string, string> = {
  en: "thank you for your message! My name is Sascha Dith from Cyprus VIP Estates.",
  de: "vielen Dank für Ihre Anfrage! Mein Name ist Sascha Dith von Cyprus VIP Estates.",
  ru: "спасибо за ваше обращение! Меня зовут Саша Дит, я из Cyprus VIP Estates.",
  pl: "dziękuję za wiadomość! Nazywam się Sascha Dith z Cyprus VIP Estates.",
};

export function buildFirstContactOpening(
  lead: { firstName: string | null; lastName: string | null; salutation: SalutationTitle },
  language: string,
): string {
  const greeting = buildFirstContactGreeting(lead, language);
  const intro = FIRST_CONTACT_INTRO[language] ?? FIRST_CONTACT_INTRO.en;
  return `${greeting}\n\n${intro}`;
}
