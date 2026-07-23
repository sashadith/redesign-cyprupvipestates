// Per-locale message templates for sharing a Client Presentation — centralised
// here during the Lead Cockpit correction batch (WHATSAPP_MSG/WHATSAPP_UPDATED_MSG
// used to be duplicated between api/admin/presentations/route.ts and [id]/route.ts;
// PRESENTATION_EMAIL_TEMPLATE is new, for the "Send by email" option added
// alongside the existing "Share via WhatsApp"/"Copy link").

export type Locale = "en" | "de" | "pl" | "ru";

// A brand-new link, just generated ("Generate Client Presentation").
export const WHATSAPP_MSG: Record<Locale, (name: string, url: string) => string> = {
  en: (name, url) => `Hello ${name}, I have prepared your personal property selection: ${url}`,
  de: (name, url) => `Hallo ${name}, ich habe Ihre persönliche Immobilienauswahl vorbereitet: ${url}`,
  pl: (name, url) => `Dzień dobry ${name}, przygotowałem Państwa osobisty wybór nieruchomości: ${url}`,
  ru: (name, url) => `Здравствуйте, ${name}. Я подготовил для вас персональную подборку объектов: ${url}`,
};

// A nudge back to an EXISTING, already-shared link that was just edited —
// deliberately distinct wording from WHATSAPP_MSG (which introduces a
// brand-new link).
export const WHATSAPP_UPDATED_MSG: Record<Locale, (url: string) => string> = {
  en: (url) => `I've updated your selection - take a look, there's something new: ${url}`,
  de: (url) => `Ich habe Ihre Auswahl aktualisiert - werfen Sie einen Blick darauf, es gibt etwas Neues: ${url}`,
  pl: (url) => `Zaktualizowałem Państwa wybór - proszę spojrzeć, pojawiło się coś nowego: ${url}`,
  ru: (url) => `Я обновил вашу подборку — взгляните, там появилось кое-что новое: ${url}`,
};

// Email version of WHATSAPP_MSG's "brand-new link" message — used by the new
// "Send by email" option on the generated-presentation modal. Subject +
// body, personalized with the lead's greeting name; body is prefilled into
// ComposeEmailModal and stays editable before sending.
export const PRESENTATION_EMAIL_TEMPLATE: Record<Locale, (name: string, url: string) => { subject: string; body: string }> = {
  en: (name, url) => ({
    subject: "Your personal property selection — Cyprus VIP Estates",
    body: `Hello ${name},\n\nI have prepared your personal property selection. You can view it here:\n${url}\n\nLet me know if you have any questions.`,
  }),
  de: (name, url) => ({
    subject: "Ihre persönliche Immobilienauswahl — Cyprus VIP Estates",
    body: `Hallo ${name},\n\nich habe Ihre persönliche Immobilienauswahl vorbereitet. Sie können sie hier ansehen:\n${url}\n\nBei Fragen stehe ich Ihnen gerne zur Verfügung.`,
  }),
  pl: (name, url) => ({
    subject: "Państwa osobisty wybór nieruchomości — Cyprus VIP Estates",
    body: `Dzień dobry ${name},\n\nprzygotowałem Państwa osobisty wybór nieruchomości. Można go zobaczyć tutaj:\n${url}\n\nW razie pytań jestem do dyspozycji.`,
  }),
  ru: (name, url) => ({
    subject: "Ваша персональная подборка объектов — Cyprus VIP Estates",
    body: `Здравствуйте, ${name}.\n\nЯ подготовил для вас персональную подборку объектов. Вы можете посмотреть её здесь:\n${url}\n\nЕсли у вас появятся вопросы, буду рад помочь.`,
  }),
};
