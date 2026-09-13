// Per-locale confirmation email for a confirmed BookingRequest — mirrors
// presentationMessages.ts's PRESENTATION_EMAIL_TEMPLATE shape. The Zoom-vs-
// Phone line intentionally matches booking/ics.ts's own event description
// almost word for word (just first-person, since this is Sascha writing to
// the lead directly) — one meeting, one consistent story about "where's the
// link" across the calendar invite and the email.
import type { Locale } from "./presentationMessages";
import { BCP47, bidiIsolate } from "@/lib/locale";

function meetingNote(locale: Locale, meetingType: "ZOOM" | "PHONE"): string {
  if (meetingType === "PHONE") {
    return {
      en: "I'll call you at the agreed time.",
      de: "Ich rufe Sie zur vereinbarten Zeit an.",
      pl: "Zadzwonię o uzgodnionej porze.",
      ru: "Я позвоню вам в согласованное время.",
      // Word-identical with `confirmedPhoneNote` in src/app/book/[token]/copy.ts
      // (styleguide §11.6 — duplicated strings stay identical).
      he: "אתקשר אליכם במועד שנקבע.", // REVIEW(he)
    }[locale];
  }
  return {
    en: "I'll send the Zoom link separately, shortly before our call.",
    de: "Den Zoom-Link sende ich Ihnen separat, kurz vor unserem Gespräch.",
    pl: "Link do Zoom wyślę osobno, tuż przed naszą rozmową.",
    ru: "Ссылку на Zoom я пришлю отдельно, незадолго до нашего разговора.",
    // Word-identical with `confirmedZoomNote` in src/app/book/[token]/copy.ts.
    he: "את הקישור לפגישת Zoom אשלח בנפרד, זמן קצר לפני השיחה.", // REVIEW(he)
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
  // `|` instead of the em dash the LTR subjects use (styleguide §3).
  he: (name, dt, mt) => ({
    subject: "הפגישה שלכם מאושרת | Cyprus VIP Estates",
    body: `שלום ${bidiIsolate(name)},\n\nהפגישה שלכם מאושרת ל-${dt} (לפי השעון שלכם).\n\nמצורפת הזמנה ליומן (.ics) עם כל הפרטים.\n\n${meetingNote("he", mt)}`,
  }), // REVIEW(he)
};

// Maps our Locale to an Intl.DateTimeFormat locale for formatting the
// confirmed slot in the lead's own timezone — display only, same
// booking/timezone.ts formatInZone() used everywhere else in this feature.
export const INTL_LOCALE = BCP47;
