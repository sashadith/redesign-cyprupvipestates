// Per-locale message templates for sharing a Client Presentation — centralised
// here during the Lead Cockpit correction batch (WHATSAPP_MSG/WHATSAPP_UPDATED_MSG
// used to be duplicated between api/admin/presentations/route.ts and [id]/route.ts;
// PRESENTATION_EMAIL_TEMPLATE is new, for the "Send by email" option added
// alongside the existing "Share via WhatsApp"/"Copy link").
import { buildEmailClosing, SIGNER_NAME, VALEDICTION } from "./compose/closing";
import { bidiIsolate } from "@/lib/locale";
import type { Locale } from "@/lib/locale";
export type { Locale };

// A brand-new link, just generated ("Generate Client Presentation").
// Wording set by the operator 2026-10-26 (DE is the master text, EN/PL/RU follow it):
// greeting, link, what the map shows + the heart, a personal line, signed with
// the first name; the email adds the signature block below it.
const SIGNER_FIRST = SIGNER_NAME.split(" ")[0];

// Shared by WhatsApp and the email body: everything between greeting and closing.
const SELECTION_LINES: Record<Exclude<Locale, "he">, (url: string) => string> = {
  en: (url) =>
    `I have prepared your personal property selection: ${url}\n\nThe interactive map shows the location of every property and what is around it: restaurants, supermarkets, beaches and more. Please tap the heart on the ones you like.\n\nI am here for any questions, and I am already curious to see which ones you like best.`,
  // The operator's master text (2026-10-26) — the other languages follow its tone.
  de: (url) =>
    `ich habe Ihre persönliche Immobilienauswahl vorbereitet: ${url}\n\nDie interaktive Karte zeigt die Lage jeder Immobilie und was es in der Umgebung gibt: Restaurants, Supermärkte, Strände und mehr. Tippen Sie bitte bei den Objekten, die Ihnen gefallen, auf das Herz.\n\nFür Fragen bin ich jederzeit für Sie da und ich bin schon gespannt, welche Objekte Ihnen am besten gefallen.`,
  pl: (url) =>
    `przygotowałem Państwa osobisty wybór nieruchomości: ${url}\n\nInteraktywna mapa pokazuje położenie każdej nieruchomości i to, co znajduje się w okolicy: restauracje, supermarkety, plaże i nie tylko. Proszę kliknąć serduszko przy obiektach, które się Państwu podobają.\n\nW razie pytań jestem zawsze do dyspozycji i już jestem ciekaw, które obiekty spodobają się Państwu najbardziej.`,
  // Opening line as the operator wrote it.
  ru: (url) =>
    `Я подготовил для вас персональную подборку объектов недвижимости на Кипре: ${url}\n\nИнтерактивная карта показывает расположение каждого объекта и то, что находится рядом: рестораны, супермаркеты, пляжи и многое другое. Пожалуйста, нажмите на сердечко у объектов, которые вам понравились.\n\nБуду рад ответить на любые ваши вопросы. С нетерпением жду, какие объекты понравятся вам больше всего.`,
};

// The selection message is personal, so it signs off warmer than the pinned
// valedictions of other CRM mails ("Mit freundlichen Grüßen" was "zu trocken").
const SIGN_OFF: Record<Exclude<Locale, "he">, string> = {
  en: VALEDICTION.en,
  de: "Herzliche Grüße",
  pl: "Serdecznie pozdrawiam",
  ru: "С наилучшими пожеланиями,",
};

const GREETING: Record<Exclude<Locale, "he">, (name: string) => string> = {
  en: (name) => `Dear ${name},`,
  de: (name) => `Hallo ${name},`,
  pl: (name) => `Dzień dobry ${name},`,
  ru: (name) => `Здравствуйте, ${name}.`,
};

export const WHATSAPP_MSG: Record<Locale, (name: string, url: string) => string> = {
  en: (name, url) => `${GREETING.en(name)}\n\n${SELECTION_LINES.en(url)}\n\n${SIGN_OFF.en}\n${SIGNER_FIRST}`,
  de: (name, url) => `${GREETING.de(name)}\n\n${SELECTION_LINES.de(url)}\n\n${SIGN_OFF.de}\n${SIGNER_FIRST}`,
  pl: (name, url) => `${GREETING.pl(name)}\n\n${SELECTION_LINES.pl(url)}\n\n${SIGN_OFF.pl}\n${SIGNER_FIRST}`,
  ru: (name, url) => `${GREETING.ru(name)}\n\n${SELECTION_LINES.ru(url)}\n\n${SIGN_OFF.ru}\n${SIGNER_FIRST}`,
  // The URL is deliberately NOT bidi-isolated: it is the last token of the
  // message and WhatsApp's own link detection can swallow a trailing PDI.
  he: (name, url) => `שלום ${bidiIsolate(name)}, הכנתי עבורכם מבחר נכסים אישי: ${url}`, // REVIEW(he)
};

// A nudge back to an EXISTING, already-shared link that was just edited —
// deliberately distinct wording from WHATSAPP_MSG (which introduces a
// brand-new link).
export const WHATSAPP_UPDATED_MSG: Record<Locale, (url: string) => string> = {
  en: (url) => `I've updated your selection - take a look, there's something new: ${url}`,
  de: (url) => `Ich habe Ihre Auswahl aktualisiert - werfen Sie einen Blick darauf, es gibt etwas Neues: ${url}`,
  pl: (url) => `Zaktualizowałem Państwa wybór - proszę spojrzeć, pojawiło się coś nowego: ${url}`,
  ru: (url) => `Я обновил вашу подборку — взгляните, там появилось кое-что новое: ${url}`,
  he: (url) => `עדכנתי את המבחר שלכם, יש שם משהו חדש: ${url}`, // REVIEW(he)
};

// Email version of WHATSAPP_MSG's "brand-new link" message — used by the new
// "Send by email" option on the generated-presentation modal. Subject +
// body, personalized with the lead's greeting name; body is prefilled into
// ComposeEmailModal and stays editable before sending.
//
// Valediction and signer name come from src/lib/crm/compose/closing.ts (the
// same pinned values Compose uses). The blank line before the signature block
// comes from sendCrmEmailAction's own SIGNATURE_SPACER, appended after this body.
export const PRESENTATION_EMAIL_TEMPLATE: Record<Locale, (name: string, url: string) => { subject: string; body: string }> = {
  // Same text as WHATSAPP_MSG (operator 2026-10-26), signed with the first name
  // only — the signature block (logo/contact) follows right after.
  en: (name, url) => ({
    subject: "Your personal property selection from Cyprus VIP Estates",
    body: `${GREETING.en(name)}\n\n${SELECTION_LINES.en(url)}\n\n${SIGN_OFF.en}\n${SIGNER_FIRST}`,
  }),
  de: (name, url) => ({
    subject: "Ihre persönliche Immobilienauswahl von Cyprus VIP Estates",
    body: `${GREETING.de(name)}\n\n${SELECTION_LINES.de(url)}\n\n${SIGN_OFF.de}\n${SIGNER_FIRST}`,
  }),
  pl: (name, url) => ({
    subject: "Państwa osobisty wybór nieruchomości od Cyprus VIP Estates",
    body: `${GREETING.pl(name)}\n\n${SELECTION_LINES.pl(url)}\n\n${SIGN_OFF.pl}\n${SIGNER_FIRST}`,
  }),
  ru: (name, url) => ({
    subject: "Ваша персональная подборка объектов от Cyprus VIP Estates",
    body: `${GREETING.ru(name)}\n\n${SELECTION_LINES.ru(url)}\n\n${SIGN_OFF.ru}\n${SIGNER_FIRST}`,
  }),
  // `|` instead of the em dash the LTR subjects use (styleguide §3: no `—` in
  // Hebrew). The URL stays on its own line and un-isolated so mail clients
  // still auto-link it.
  he: (name, url) => ({
    subject: "מבחר הנכסים האישי שלכם | Cyprus VIP Estates",
    body: `שלום ${bidiIsolate(name)},\n\nהכנתי עבורכם מבחר נכסים אישי. אפשר לצפות בו כאן:\n${url}\n\nאשמח לענות על כל שאלה.\n\n${buildEmailClosing("he")}`,
  }), // REVIEW(he)
};
