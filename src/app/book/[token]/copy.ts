// Locale copy for the booking page — same PLocale set as the Client
// Presentation page's copy.ts, but a distinct file since the content has
// nothing to do with property presentation.
import { HE_LANGUAGE_NOTE, LOCALES, hePrefixDate, isLocale, type Locale } from "@/lib/locale";
export type BLocale = Locale;
export const B_LOCALES = LOCALES;
export const asBLocale = (v: string | null | undefined): BLocale => (v && isLocale(v) ? v : "en");

export type BookingCopy = {
  /** Browser-tab title + meta description. The page is noindex, but the tab
   *  is visible — and it was English over a Hebrew page (Pass B S21). */
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  // Split around the name (rather than a single `title(name)` string) so the
  // name/formal-address segment can be wrapped in its own gold-shimmer span
  // (Batch A, 2026-07-25 — reuses the Client Presentation page's ".it" style,
  // not a new component). `titleSuffix` is shared by the informal and the
  // formal (DE/PL) address forms below — only the greeting + name differs.
  titlePrefix: string;
  titleSuffix: string;
  // DE/PL only: formal address ("Herr/Frau [Nachname]", "Panie/Pani
  // [Nachname]") when the lead's Salutation is set to MR/MS. EN/RU never use
  // this — informal titlePrefix + first name always, regardless of salutation.
  formalGreeting?: (salutation: "MR" | "MS", lastName: string) => { prefix: string; name: string };
  intro: string;
  yourTime: string;
  cyprusTime: string;
  detectingTimezone: string;
  selectedTitle: string;
  submit: string;
  submitting: string;
  hint: string;
  pickCountError: string;
  genericError: string;
  submittedTitle: string;
  submittedBody: string;
  alreadyProposedTitle: string;
  alreadyProposedBody: string;
  confirmedTitle: string;
  confirmedBody: (dateTime: string) => string;
  confirmedZoomNote: string;
  confirmedPhoneNote: string;
  goneTitle: string;
  goneBody: string;
  contactUs: string;
};

const COPY_EN: BookingCopy = {
  metaTitle: "Book a time - Cyprus VIP Estates",
  metaDescription: "Schedule a personal appointment.",
  eyebrow: "Schedule a meeting",
  titlePrefix: "Hello ",
  titleSuffix: ", let's find a time",
  intro: "Pick 2-3 times that work for you and I'll confirm one shortly.",
  yourTime: "Your time",
  cyprusTime: "Cyprus time",
  detectingTimezone: "Detecting your timezone…",
  selectedTitle: "Your selected times",
  submit: "Send my available times",
  submitting: "Sending…",
  hint: "Select between 1 and 3 times above.",
  pickCountError: "Please select between 1 and 3 times.",
  genericError: "Something went wrong. Please try again.",
  submittedTitle: "Thank you",
  submittedBody: "I've received your available times and will confirm one shortly by email.",
  alreadyProposedTitle: "Thank you",
  alreadyProposedBody: "I've already received your available times and will confirm one shortly by email.",
  confirmedTitle: "Your appointment is confirmed",
  confirmedBody: (dt) => `We're set for ${dt} (your time). A calendar invite has been sent to your email.`,
  confirmedZoomNote: "I'll send the Zoom link separately, shortly before our call.",
  confirmedPhoneNote: "I'll call you at the agreed time.",
  goneTitle: "This link is no longer available",
  goneBody: "This booking link has expired or is no longer active. Please get in touch and I'll send you a new one.",
  contactUs: "Contact us",
};

export const COPY: Record<BLocale, BookingCopy> = {
  en: COPY_EN,
  de: {
    metaTitle: "Termin buchen - Cyprus VIP Estates",
    metaDescription: "Vereinbaren Sie einen persönlichen Termin.",
    eyebrow: "Terminvereinbarung",
    titlePrefix: "Hallo ",
    titleSuffix: ", lassen Sie uns einen Termin finden",
    formalGreeting: (salutation, lastName) => ({ prefix: "Hallo ", name: `${salutation === "MR" ? "Herr" : "Frau"} ${lastName}` }),
    intro: "Wählen Sie 2-3 Zeiten, die Ihnen passen — ich bestätige in Kürze eine davon.",
    yourTime: "Ihre Zeit",
    cyprusTime: "Zypern-Zeit",
    detectingTimezone: "Zeitzone wird ermittelt…",
    selectedTitle: "Ihre ausgewählten Zeiten",
    submit: "Meine verfügbaren Zeiten senden",
    submitting: "Wird gesendet…",
    hint: "Wählen Sie oben zwischen 1 und 3 Zeiten aus.",
    pickCountError: "Bitte wählen Sie zwischen 1 und 3 Zeiten aus.",
    genericError: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    submittedTitle: "Vielen Dank",
    submittedBody: "Ich habe Ihre verfügbaren Zeiten erhalten und bestätige in Kürze eine davon per E-Mail.",
    alreadyProposedTitle: "Vielen Dank",
    alreadyProposedBody: "Ich habe Ihre verfügbaren Zeiten bereits erhalten und bestätige in Kürze eine davon per E-Mail.",
    confirmedTitle: "Ihr Termin ist bestätigt",
    confirmedBody: (dt) => `Wir sind verabredet für ${dt} (Ihre Zeit). Eine Kalendereinladung wurde an Ihre E-Mail gesendet.`,
    confirmedZoomNote: "Den Zoom-Link sende ich Ihnen separat, kurz vor unserem Gespräch.",
    confirmedPhoneNote: "Ich rufe Sie zur vereinbarten Zeit an.",
    goneTitle: "Dieser Link ist nicht mehr verfügbar",
    goneBody: "Dieser Terminlink ist abgelaufen oder nicht mehr aktiv. Bitte melden Sie sich bei uns, ich sende Ihnen gerne einen neuen.",
    contactUs: "Kontakt aufnehmen",
  },
  pl: {
    metaTitle: "Umów termin - Cyprus VIP Estates",
    metaDescription: "Umów osobiste spotkanie.",
    eyebrow: "Umów spotkanie",
    titlePrefix: "Dzień dobry ",
    titleSuffix: ", znajdźmy dogodny termin",
    // Formal address adds the comma the informal form doesn't have ("Dzień
    // dobry, Panie ..." vs "Dzień dobry {imię}, ...") — per the exact wording specified.
    formalGreeting: (salutation, lastName) => ({ prefix: "Dzień dobry, ", name: `${salutation === "MR" ? "Panie" : "Pani"} ${lastName}` }),
    intro: "Proszę wybrać 2-3 godziny, które Państwu odpowiadają — wkrótce potwierdzę jedną z nich.",
    yourTime: "Państwa czas",
    cyprusTime: "Czas cypryjski",
    detectingTimezone: "Wykrywanie strefy czasowej…",
    selectedTitle: "Wybrane godziny",
    submit: "Wyślij moje dostępne godziny",
    submitting: "Wysyłanie…",
    hint: "Proszę wybrać od 1 do 3 godzin powyżej.",
    pickCountError: "Proszę wybrać od 1 do 3 godzin.",
    genericError: "Coś poszło nie tak. Proszę spróbować ponownie.",
    submittedTitle: "Dziękuję",
    submittedBody: "Otrzymałem Państwa dostępne godziny i wkrótce potwierdzę jedną z nich e-mailem.",
    alreadyProposedTitle: "Dziękuję",
    alreadyProposedBody: "Otrzymałem już Państwa dostępne godziny i wkrótce potwierdzę jedną z nich e-mailem.",
    confirmedTitle: "Państwa spotkanie zostało potwierdzone",
    confirmedBody: (dt) => `Spotykamy się ${dt} (Państwa czas). Zaproszenie do kalendarza zostało wysłane na Państwa e-mail.`,
    confirmedZoomNote: "Link do Zoom wyślę osobno, tuż przed naszą rozmową.",
    confirmedPhoneNote: "Zadzwonię o uzgodnionej porze.",
    goneTitle: "Ten link jest już nieaktywny",
    goneBody: "Ten link do umówienia spotkania wygasł lub nie jest już aktywny. Proszę o kontakt — chętnie wyślę nowy.",
    contactUs: "Skontaktuj się z nami",
  },
  ru: {
    metaTitle: "Запись на встречу - Cyprus VIP Estates",
    metaDescription: "Запишитесь на личную встречу.",
    eyebrow: "Запись на встречу",
    titlePrefix: "Здравствуйте, ",
    titleSuffix: ", давайте подберём время",
    intro: "Выберите 2-3 удобных для вас времени — я скоро подтвержу одно из них.",
    yourTime: "Ваше время",
    cyprusTime: "Время Кипра",
    detectingTimezone: "Определяем ваш часовой пояс…",
    selectedTitle: "Выбранное время",
    submit: "Отправить доступное время",
    submitting: "Отправка…",
    hint: "Пожалуйста, выберите от 1 до 3 времени выше.",
    pickCountError: "Пожалуйста, выберите от 1 до 3 времени.",
    genericError: "Что-то пошло не так. Пожалуйста, попробуйте ещё раз.",
    submittedTitle: "Спасибо",
    submittedBody: "Я получил ваше доступное время и скоро подтвержу одно из них по электронной почте.",
    alreadyProposedTitle: "Спасибо",
    alreadyProposedBody: "Я уже получил ваше доступное время и скоро подтвержу одно из них по электронной почте.",
    confirmedTitle: "Ваша встреча подтверждена",
    confirmedBody: (dt) => `Договорились на ${dt} (по вашему времени). Приглашение в календарь отправлено на вашу почту.`,
    confirmedZoomNote: "Ссылку на Zoom я пришлю отдельно, незадолго до нашего разговора.",
    confirmedPhoneNote: "Я позвоню вам в согласованное время.",
    goneTitle: "Эта ссылка больше недоступна",
    goneBody: "Срок действия ссылки для записи истёк, либо она больше не активна. Пожалуйста, свяжитесь со мной — я пришлю новую.",
    contactUs: "Связаться с нами",
  },
  he: {
    metaTitle: "תיאום פגישה | Cyprus VIP Estates",
    metaDescription: "תיאום פגישה אישית עם היועץ שלכם.",
    eyebrow: "תיאום פגישה",
    titlePrefix: "שלום ",
    titleSuffix: ", נמצא זמן שמתאים לכם",
    // No `formalGreeting` for he: Israeli business practice addresses a client
    // by first name, and "מר/גב'" would read as stiff or as a slash form (§2.3).
    intro: `אפשר לבחור 2-3 מועדים שמתאימים לכם, ואחזור אליכם עם אישור בקרוב. ${HE_LANGUAGE_NOTE}`,
    yourTime: "השעה אצלכם",
    cyprusTime: "שעון קפריסין",
    detectingTimezone: "מזהים את אזור הזמן שלכם…",
    selectedTitle: "המועדים שבחרתם",
    submit: "שליחת המועדים הפנויים",
    submitting: "שולחים…",
    hint: "יש לבחור למעלה בין 1 ל-3 מועדים.",
    pickCountError: "יש לבחור בין 1 ל-3 מועדים.",
    genericError: "משהו השתבש, נסו שוב.",
    submittedTitle: "תודה",
    submittedBody: "קיבלתי את המועדים הפנויים שלכם ואשלח אישור בקרוב באימייל.",
    alreadyProposedTitle: "תודה",
    alreadyProposedBody: "כבר קיבלתי את המועדים הפנויים שלכם ואשלח אישור בקרוב באימייל.",
    confirmedTitle: "הפגישה שלכם מאושרת",
    confirmedBody: (dt) => `נפגשים ${hePrefixDate("ב", dt)} (לפי השעון שלכם). הזמנה ליומן נשלחה לאימייל שלכם.`,
    confirmedZoomNote: "את הקישור לפגישת Zoom אשלח בנפרד, זמן קצר לפני השיחה.",
    confirmedPhoneNote: "אתקשר אליכם במועד שנקבע.",
    goneTitle: "הקישור אינו זמין עוד",
    goneBody: "תוקף קישור התיאום פג או שהוא כבר אינו פעיל. אפשר לפנות אלינו ואשלח לכם קישור חדש.",
    contactUs: "ליצירת קשר",
  }, // REVIEW(he)
};
