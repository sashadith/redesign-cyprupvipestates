/* Contacts — four-locale copy.

   The old page was a wall of options: one generic form, plus the same ten
   people the About page already listed, with nothing to tell a visitor whom
   to actually talk to. This page is built as a ROUTING tool instead — the
   real question on a contacts page is "who do I reach for MY situation, and
   how fast?" — so the team is filtered by the one dimension the stored data
   genuinely supports and an international buyer genuinely cares about:
   the languages each consultant speaks. */

import { bidiIsolate, ltrIsolate, type Locale } from "@/lib/locale";

export type ContactsStrings = {
  metaTitle: string;
  metaDescription: string;

  heroEyebrow: string;
  heroTitle: [string, string, string];
  heroLead: string;

  channelsEyebrow: string;
  channelsTitle: string;
  channelWhatsapp: string;
  channelPhone: string;
  channelEmail: string;
  channelHint: { whatsapp: string; phone: string; email: string };

  hoursLabel: string;
  hoursValue: string;
  hoursOpen: string;
  hoursClosed: string;
  hoursOpensAt: string;
  hoursTimezone: string;

  finderEyebrow: string;
  finderTitle: string;
  finderLead: string;
  finderAll: string;
  finderLanguageLabel: string;
  finderEmpty: string;
  /** "{n}" is substituted at render time — a function can't cross the
      server/client boundary, and these strings are consumed by a client
      component (ConsultantFinder). */
  finderCountOne: string;
  finderCountMany: string;
  speaks: string;

  formEyebrow: string;
  /* The shared Form collects a name, contact details and a preferred channel —
     there is NO free-text message field on this page (showQuestionField is
     opt-in and only the FAQ page turns it on). "Send us a message" therefore
     promised an input that isn't there; the wording now asks for details and
     offers a callback instead. */
  /** Split so the middle part carries the .it gold accent, like heroTitle. */
  formTitle: [string, string, string];
  formLead: string;

  officeEyebrow: string;
  officeTitle: string;
  officeCompany: string;
  officeAddress: string;
  officeDirections: string;
};

const EN: ContactsStrings = {
  metaTitle: "Contact Us — Cyprus VIP Estates",
  metaDescription:
    "Reach the Cyprus VIP Estates team by WhatsApp, phone or email — daily 9:00–18:00. Find a consultant who speaks your language, or visit our office in Paphos.",
  heroEyebrow: "Contacts",
  heroTitle: ["Talk to someone who ", "lives", " here"],
  heroLead:
    "Cyprus VIP Estates is a project of SecretBrand Solutions LTD. Whichever way you reach out, a real person answers — daily from 9:00 to 18:00 Cyprus time.",

  channelsEyebrow: "Direct lines",
  channelsTitle: "Pick whatever suits you",
  channelWhatsapp: "WhatsApp",
  channelPhone: "Phone",
  channelEmail: "Email",
  channelHint: {
    whatsapp: "Fastest reply, usually within minutes",
    phone: "Call us directly during office hours",
    email: "For detailed enquiries and documents",
  },

  hoursLabel: "Working hours",
  hoursValue: "Daily, 9:00 – 18:00",
  hoursOpen: "Open now",
  hoursClosed: "Closed right now",
  hoursOpensAt: "Opens at 9:00",
  hoursTimezone: "Cyprus time",

  finderEyebrow: "Your contact",
  finderTitle: "Find a consultant who speaks your language",
  finderLead:
    "Our team covers six languages. Choose yours and see exactly who you will be talking to.",
  finderAll: "All",
  finderLanguageLabel: "Language",
  finderEmpty: "No one listed for this language yet — write to us and we will find the right person.",
  finderCountOne: "1 consultant",
  finderCountMany: "{n} consultants",
  speaks: "Speaks",

  formEyebrow: "Write to us",
  formTitle: ["Let us ", "come back", " to you"],
  formLead: "Leave your details and tell us how you would rather be reached. One of our consultants gets in touch personally — usually the same day.",

  officeEyebrow: "Visit us",
  officeTitle: "Our office in Paphos",
  officeCompany: "SecretBrand Solutions LTD",
  officeAddress: "Palaion Patron Germanou 11, 8011 Paphos, Cyprus",
  officeDirections: "Open in Google Maps",
};

const DE: ContactsStrings = {
  metaTitle: "Kontakt — Cyprus VIP Estates",
  metaDescription:
    "Erreichen Sie das Team von Cyprus VIP Estates per WhatsApp, Telefon oder E-Mail — täglich 9:00–18:00. Finden Sie einen Berater, der Ihre Sprache spricht, oder besuchen Sie unser Büro in Paphos.",
  heroEyebrow: "Kontakt",
  heroTitle: ["Sprechen Sie mit jemandem, der hier ", "lebt", ""],
  heroLead:
    "Cyprus VIP Estates ist ein Projekt der SecretBrand Solutions LTD. Wie auch immer Sie uns erreichen — es antwortet ein echter Mensch, täglich von 9:00 bis 18:00 Uhr zyprischer Zeit.",

  channelsEyebrow: "Direkte Wege",
  channelsTitle: "Wählen Sie, was Ihnen passt",
  channelWhatsapp: "WhatsApp",
  channelPhone: "Telefon",
  channelEmail: "E-Mail",
  channelHint: {
    whatsapp: "Schnellste Antwort, meist innerhalb von Minuten",
    phone: "Rufen Sie uns während der Bürozeiten direkt an",
    email: "Für ausführliche Anfragen und Unterlagen",
  },

  hoursLabel: "Arbeitszeiten",
  hoursValue: "Täglich, 9:00 – 18:00 Uhr",
  hoursOpen: "Jetzt geöffnet",
  hoursClosed: "Gerade geschlossen",
  hoursOpensAt: "Öffnet um 9:00 Uhr",
  hoursTimezone: "zyprischer Zeit",

  finderEyebrow: "Ihr Ansprechpartner",
  finderTitle: "Finden Sie einen Berater, der Ihre Sprache spricht",
  finderLead:
    "Unser Team deckt sechs Sprachen ab. Wählen Sie Ihre — und sehen Sie genau, mit wem Sie sprechen werden.",
  finderAll: "Alle",
  finderLanguageLabel: "Sprache",
  finderEmpty: "Für diese Sprache ist noch niemand hinterlegt — schreiben Sie uns, wir finden die richtige Person.",
  finderCountOne: "1 Berater",
  finderCountMany: "{n} Berater",
  speaks: "Spricht",

  formEyebrow: "Schreiben Sie uns",
  formTitle: ["Wir ", "melden uns", " bei Ihnen"],
  formLead: "Hinterlassen Sie Ihre Kontaktdaten und auf welchem Weg Sie am liebsten erreicht werden. Eine unserer Beraterinnen oder einer unserer Berater meldet sich persönlich — meist noch am selben Tag.",

  officeEyebrow: "Besuchen Sie uns",
  officeTitle: "Unser Büro in Paphos",
  officeCompany: "SecretBrand Solutions LTD",
  officeAddress: "Palaion Patron Germanou 11, 8011 Paphos, Zypern",
  officeDirections: "In Google Maps öffnen",
};

const PL: ContactsStrings = {
  metaTitle: "Kontakt — Cyprus VIP Estates",
  metaDescription:
    "Skontaktuj się z zespołem Cyprus VIP Estates przez WhatsApp, telefon lub e-mail — codziennie 9:00–18:00. Znajdź doradcę mówiącego w Twoim języku lub odwiedź nasze biuro w Pafos.",
  heroEyebrow: "Kontakt",
  heroTitle: ["Porozmawiaj z kimś, kto tu ", "mieszka", ""],
  heroLead:
    "Cyprus VIP Estates to projekt SecretBrand Solutions LTD. Niezależnie od tego, jak się z nami skontaktujesz, odpowie prawdziwa osoba — codziennie od 9:00 do 18:00 czasu cypryjskiego.",

  channelsEyebrow: "Bezpośredni kontakt",
  channelsTitle: "Wybierz, co Ci odpowiada",
  channelWhatsapp: "WhatsApp",
  channelPhone: "Telefon",
  channelEmail: "E-mail",
  channelHint: {
    whatsapp: "Najszybsza odpowiedź, zwykle w ciągu kilku minut",
    phone: "Zadzwoń bezpośrednio w godzinach pracy biura",
    email: "Do szczegółowych zapytań i dokumentów",
  },

  hoursLabel: "Godziny pracy",
  hoursValue: "Codziennie, 9:00 – 18:00",
  hoursOpen: "Teraz otwarte",
  hoursClosed: "Obecnie zamknięte",
  hoursOpensAt: "Otwieramy o 9:00",
  hoursTimezone: "czasu cypryjskiego",

  finderEyebrow: "Twój doradca",
  finderTitle: "Znajdź doradcę mówiącego w Twoim języku",
  finderLead:
    "Nasz zespół obsługuje sześć języków. Wybierz swój i zobacz dokładnie, z kim będziesz rozmawiać.",
  finderAll: "Wszyscy",
  finderLanguageLabel: "Język",
  finderEmpty: "Nikt nie jest jeszcze przypisany do tego języka — napisz do nas, znajdziemy właściwą osobę.",
  finderCountOne: "1 doradca",
  finderCountMany: "{n} doradców",
  speaks: "Mówi",

  formEyebrow: "Napisz do nas",
  formTitle: ["Oddzwonimy ", "do Ciebie", ""],
  formLead: "Zostaw swoje dane i wybierz, jak najchętniej się kontaktujesz. Jeden z naszych doradców odezwie się osobiście — zwykle jeszcze tego samego dnia.",

  officeEyebrow: "Odwiedź nas",
  officeTitle: "Nasze biuro w Pafos",
  officeCompany: "SecretBrand Solutions LTD",
  officeAddress: "Palaion Patron Germanou 11, 8011 Pafos, Cypr",
  officeDirections: "Otwórz w Mapach Google",
};

const RU: ContactsStrings = {
  metaTitle: "Контакты — Cyprus VIP Estates",
  metaDescription:
    "Свяжитесь с командой Cyprus VIP Estates через WhatsApp, по телефону или email — ежедневно 9:00–18:00. Найдите консультанта, говорящего на вашем языке, или посетите наш офис в Пафосе.",
  heroEyebrow: "Контакты",
  heroTitle: ["Говорите с теми, кто здесь ", "живёт", ""],
  heroLead:
    "Cyprus VIP Estates — проект компании SecretBrand Solutions LTD. Как бы вы ни обратились, вам ответит живой человек — ежедневно с 9:00 до 18:00 по кипрскому времени.",

  channelsEyebrow: "Прямая связь",
  channelsTitle: "Выберите удобный способ",
  channelWhatsapp: "WhatsApp",
  channelPhone: "Телефон",
  channelEmail: "Email",
  channelHint: {
    whatsapp: "Самый быстрый ответ, обычно за считаные минуты",
    phone: "Позвоните напрямую в рабочие часы",
    email: "Для подробных запросов и документов",
  },

  hoursLabel: "Часы работы",
  hoursValue: "Ежедневно, 9:00 – 18:00",
  hoursOpen: "Сейчас открыто",
  hoursClosed: "Сейчас закрыто",
  hoursOpensAt: "Откроется в 9:00",
  hoursTimezone: "по кипрскому времени",

  finderEyebrow: "Ваш консультант",
  finderTitle: "Найдите консультанта, говорящего на вашем языке",
  finderLead:
    "Наша команда говорит на шести языках. Выберите свой и посмотрите, с кем именно вы будете общаться.",
  finderAll: "Все",
  finderLanguageLabel: "Язык",
  finderEmpty: "Для этого языка пока никого нет — напишите нам, и мы найдём нужного человека.",
  finderCountOne: "1 консультант",
  finderCountMany: "{n} консультантов",
  speaks: "Говорит",

  formEyebrow: "Напишите нам",
  formTitle: ["Мы ", "свяжемся", " с вами"],
  formLead: "Оставьте свои контакты и удобный способ связи. Наш консультант свяжется с вами лично — обычно в тот же день.",

  officeEyebrow: "Приезжайте",
  officeTitle: "Наш офис в Пафосе",
  officeCompany: "SecretBrand Solutions LTD",
  officeAddress: "Palaion Patron Germanou 11, 8011 Пафос, Кипр",
  officeDirections: "Открыть в Google Картах",
};

/* Hebrew. Two things are load-bearing here and must survive any edit:
   1. Decision E (he-glossary.md §5, he-styleguide.md §8): the team does NOT
      speak Hebrew. The honesty line stands verbatim in `finderLead` and in
      `metaDescription` — never replace it with a claim of Hebrew service.
      In `finderLead` it comes FIRST, before the finder invitation: stated up
      front it reads as a fact, stated after it reads as a retraction (Pass B
      Must #2). `finderTitle` must stay nominal for the same reason — it may
      not promise a consultant who speaks the reader's language.
   2. Latin brand names inside Hebrew sentences are bidi-isolated
      (he-styleguide.md §11.4); the street address is LTR-isolated so the
      house number keeps its place. */
const HE: ContactsStrings = {
  metaTitle: "יצירת קשר עם הצוות שלנו בפאפוס | Cyprus VIP Estates",
  metaDescription:
    "Cyprus VIP Estates בוואטסאפ, בטלפון ובאימייל, מדי יום 9:00 עד 18:00 שעון קפריסין. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.",
  heroEyebrow: "יצירת קשר",
  heroTitle: ["מדברים עם מי שגר ", "כאן", ""],
  heroLead: `${bidiIsolate("Cyprus VIP Estates")} הוא מותג של ${bidiIsolate("SecretBrand Solutions LTD")}. בכל דרך שתפנו אלינו יענה אדם אמיתי, מדי יום, 9:00 עד 18:00 שעון קפריסין.`,

  channelsEyebrow: "קווים ישירים",
  channelsTitle: "הדרך שנוחה לכם",
  channelWhatsapp: "וואטסאפ",
  channelPhone: "טלפון",
  channelEmail: "אימייל",
  channelHint: {
    whatsapp: "התשובה המהירה ביותר, בדרך כלל תוך דקות",
    phone: "אפשר להתקשר אלינו ישירות בשעות הפעילות",
    email: "לפניות מפורטות ולמסמכים",
  },

  hoursLabel: "שעות פעילות",
  hoursValue: "מדי יום, 9:00 עד 18:00",
  hoursOpen: "פתוח עכשיו",
  hoursClosed: "סגור כרגע",
  hoursOpensAt: "נפתח ב-9:00",
  hoursTimezone: "שעון קפריסין",

  finderEyebrow: "אנשי הקשר שלכם",
  finderTitle: "בחירת יועץ לפי שפה",
  finderLead:
    "הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה. בצוות שלנו שש שפות, וכאן אפשר לראות בדיוק עם מי תדברו.",
  finderAll: "הכל",
  finderLanguageLabel: "שפה",
  finderEmpty: "עדיין אין יועץ לשפה הזו. כתבו לנו ונחזור אליכם.",
  finderCountOne: "יועץ אחד",
  finderCountMany: "{n} יועצים",
  speaks: "שפות",

  formEyebrow: "כתבו לנו",
  formTitle: ["השאירו פרטים ", "ונחזור אליכם", " בהקדם"],
  formLead: "השאירו פרטים וספרו לנו איך נוח לכם שניצור קשר. אחד היועצים שלנו יענה לכם אישית, בדרך כלל עוד באותו יום.",

  officeEyebrow: "לבקר אצלנו",
  officeTitle: "המשרד שלנו בפאפוס",
  officeCompany: "SecretBrand Solutions LTD",
  officeAddress: `${ltrIsolate("Palaion Patron Germanou 11, 8011")} פאפוס, קפריסין`,
  officeDirections: `פתיחה ב-${bidiIsolate("Google Maps")}`,
};

/* Exported (not a file-local `const ALL`) so scripts/qa/copy-modules.json can
   register this table with the copy-snapshot and he-meta-length gates. */
export const CONTACTS_COPY: Record<Locale, ContactsStrings> = { en: EN, de: DE, pl: PL, ru: RU, he: HE /* REVIEW(he) */ };

export const contactsCopy = (lang: string): ContactsStrings => CONTACTS_COPY[lang as Locale] ?? EN;

/* The three channels are identical in every locale (same number, same
   address) — stored once here rather than four times above. */
export const CHANNELS = {
  whatsappNumber: "+357 99 278 285",
  phoneNumber: "+357 99 278 285",
  email: "office@cyprusvipestates.com",
};

/** Office geo-point, from the old page's locationBlock. */
export const OFFICE = { lat: 34.77374771739058, lng: 32.42693982209025 };
