// Locale copy for the booking page — same PLocale set as the Client
// Presentation page's copy.ts, but a distinct file since the content has
// nothing to do with property presentation.
export type BLocale = "en" | "de" | "pl" | "ru";
const B_LOCALES: BLocale[] = ["en", "de", "pl", "ru"];
export const asBLocale = (v: string | null | undefined): BLocale => (B_LOCALES.includes(v as BLocale) ? (v as BLocale) : "en");

export const COPY: Record<BLocale, {
  eyebrow: string;
  title: (name: string) => string;
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
}> = {
  en: {
    eyebrow: "Cyprus VIP Estates",
    title: (name) => `Hello ${name}, let's find a time`,
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
  },
  de: {
    eyebrow: "Cyprus VIP Estates",
    title: (name) => `Hallo ${name}, lassen Sie uns einen Termin finden`,
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
    eyebrow: "Cyprus VIP Estates",
    title: (name) => `Dzień dobry ${name}, znajdźmy dogodny termin`,
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
    eyebrow: "Cyprus VIP Estates",
    title: (name) => `Здравствуйте, ${name}, давайте подберём время`,
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
};
