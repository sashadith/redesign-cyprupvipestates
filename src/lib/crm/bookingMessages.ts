// Per-locale confirmation email for a confirmed BookingRequest — mirrors
// presentationMessages.ts's PRESENTATION_EMAIL_TEMPLATE shape. The Zoom-vs-
// Phone line intentionally matches booking/ics.ts's own event description
// almost word for word (just first-person, since this is Sascha writing to
// the lead directly) — one meeting, one consistent story about "where's the
// link" across the calendar invite and the email.
import type { Locale } from "./presentationMessages";

function meetingNote(locale: Locale, meetingType: "ZOOM" | "PHONE"): string {
  if (meetingType === "PHONE") {
    return {
      en: "I'll call you at the agreed time.",
      de: "Ich rufe Sie zur vereinbarten Zeit an.",
      pl: "Zadzwonię o uzgodnionej porze.",
      ru: "Я позвоню вам в согласованное время.",
    }[locale];
  }
  return {
    en: "I'll send the Zoom link separately, shortly before our call.",
    de: "Den Zoom-Link sende ich Ihnen separat, kurz vor unserem Gespräch.",
    pl: "Link do Zoom wyślę osobno, tuż przed naszą rozmową.",
    ru: "Ссылку на Zoom я пришлю отдельно, незадолго до нашего разговора.",
  }[locale];
}

export const BOOKING_CONFIRMATION_EMAIL: Record<
  Locale,
  (name: string, formattedDateTime: string, meetingType: "ZOOM" | "PHONE") => { subject: string; body: string }
> = {
  en: (name, dt, mt) => ({
    subject: "Your appointment is confirmed — Cyprus VIP Estates",
    body: `Hello ${name},\n\nYour appointment is confirmed for ${dt} (your time).\n\nI've attached a calendar invite (.ics) with the details.\n\n${meetingNote("en", mt)}`,
  }),
  de: (name, dt, mt) => ({
    subject: "Ihr Termin ist bestätigt — Cyprus VIP Estates",
    body: `Hallo ${name},\n\nIhr Termin ist bestätigt für ${dt} (Ihre Zeit).\n\nIm Anhang finden Sie eine Kalendereinladung (.ics) mit den Details.\n\n${meetingNote("de", mt)}`,
  }),
  pl: (name, dt, mt) => ({
    subject: "Państwa spotkanie zostało potwierdzone — Cyprus VIP Estates",
    body: `Dzień dobry ${name},\n\nPaństwa spotkanie zostało potwierdzone na ${dt} (Państwa czas).\n\nW załączniku znajduje się zaproszenie do kalendarza (.ics) ze szczegółami.\n\n${meetingNote("pl", mt)}`,
  }),
  ru: (name, dt, mt) => ({
    subject: "Ваша встреча подтверждена — Cyprus VIP Estates",
    body: `Здравствуйте, ${name}.\n\nВаша встреча подтверждена на ${dt} (по вашему времени).\n\nВо вложении — приглашение в календарь (.ics) с деталями.\n\n${meetingNote("ru", mt)}`,
  }),
};

// Maps our Locale to an Intl.DateTimeFormat locale for formatting the
// confirmed slot in the lead's own timezone — display only, same
// booking/timezone.ts formatInZone() used everywhere else in this feature.
export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  de: "de-DE",
  pl: "pl-PL",
  ru: "ru-RU",
};
