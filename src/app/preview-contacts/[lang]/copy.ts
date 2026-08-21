/* Contacts — four-locale copy.

   The old page was a wall of options: one generic form, plus the same ten
   people the About page already listed, with nothing to tell a visitor whom
   to actually talk to. This page is built as a ROUTING tool instead — the
   real question on a contacts page is "who do I reach for MY situation, and
   how fast?" — so the team is filtered by the one dimension the stored data
   genuinely supports and an international buyer genuinely cares about:
   the languages each consultant speaks. */

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
  formTitle: string;
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

  hoursLabel: "Office hours",
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
  formTitle: "Send us a message",
  formLead: "Tell us what you are looking for. We reply personally, usually the same day.",

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

  hoursLabel: "Bürozeiten",
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
  formTitle: "Senden Sie uns eine Nachricht",
  formLead: "Sagen Sie uns, wonach Sie suchen. Wir antworten persönlich, meist noch am selben Tag.",

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
  formTitle: "Wyślij nam wiadomość",
  formLead: "Powiedz nam, czego szukasz. Odpowiadamy osobiście, zwykle tego samego dnia.",

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
  formTitle: "Отправьте сообщение",
  formLead: "Расскажите, что вы ищете. Мы отвечаем лично, обычно в тот же день.",

  officeEyebrow: "Приезжайте",
  officeTitle: "Наш офис в Пафосе",
  officeCompany: "SecretBrand Solutions LTD",
  officeAddress: "Palaion Patron Germanou 11, 8011 Пафос, Кипр",
  officeDirections: "Открыть в Google Картах",
};

const ALL: Record<string, ContactsStrings> = { en: EN, de: DE, pl: PL, ru: RU };

export const contactsCopy = (lang: string): ContactsStrings => ALL[lang] ?? EN;

/* The three channels are identical in every locale (same number, same
   address) — stored once here rather than four times above. */
export const CHANNELS = {
  whatsappNumber: "+357 99 278 285",
  phoneNumber: "+357 99 278 285",
  email: "office@cyprusvipestates.com",
};

/** Office geo-point, from the old page's locationBlock. */
export const OFFICE = { lat: 34.77374771739058, lng: 32.42693982209025 };
