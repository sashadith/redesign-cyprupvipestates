export type PLocale = "en" | "de" | "pl" | "ru";
export const P_LOCALES: PLocale[] = ["en", "de", "pl", "ru"];
export const asPLocale = (v: string | null | undefined): PLocale => (P_LOCALES.includes(v as PLocale) ? (v as PLocale) : "en");

type Greeting = { morning: string; afternoon: string; evening: string };
const GREETING: Record<PLocale, Greeting> = {
  en: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
  de: { morning: "Guten Morgen", afternoon: "Guten Tag", evening: "Guten Abend" },
  pl: { morning: "Dzień dobry", afternoon: "Dzień dobry", evening: "Dobry wieczór" },
  ru: { morning: "Доброе утро", afternoon: "Добрый день", evening: "Добрый вечер" },
};

/** Time-of-day greeting word, by server clock hour (0-23). */
export function timeOfDayGreeting(locale: PLocale, hour: number): string {
  const g = GREETING[locale];
  if (hour < 12) return g.morning;
  if (hour < 18) return g.afternoon;
  return g.evening;
}

export const COPY: Record<PLocale, {
  eyebrowTag: string;
  intro: string;
  requirementsTitle: string;
  budgetUpTo: string;
  propertyTypeNames: Record<string, string>;
  timelineLabels: Record<string, string>;
  bedroomLabels: Record<string, string>; // keyed "0".."5" — 0 = studio, 5 = "5+"
  viewDetails: string;
  availableUnits: string;
  unitsTable: { ref: string; type: string; beds: string; area: string; price: string; status: string };
  statusLabel: Record<string, string>;
  advisorTitle: string;
  unitsPlural: { one: string; few?: string; many: string };
  newForYou: string;
  vatLabel: string;
  soldOut: string;
  lifeNearby: string;
  closingEyebrow: string;
  closingTrust: string;
  whatsapp: string;
  call: string;
  email: string;
  whatsappMessage: string;
  notAvailableTitle: string;
  notAvailableBody: string;
  contactUs: string;
  legal: string;
  privacyPolicy: string;
  priceFrom: string;
  units: string;
}> = {
  en: {
    eyebrowTag: "YOUR PERSONAL SELECTION",
    intro: "Thank you for your trust. I have personally selected these properties for you - each of them matches your wishes and deserves your attention.",
    requirementsTitle: "Your preferences",
    budgetUpTo: "up to",
    propertyTypeNames: { Apartment: "Apartment", Villa: "Villa", Townhouse: "Townhouse", Penthouse: "Penthouse" },
    timelineLabels: { IMMEDIATE: "Immediate", THREE_MONTHS: "Within 3 months", SIX_MONTHS: "Within 6 months", ONE_YEAR: "Within a year", JUST_LOOKING: "Just looking" },
    bedroomLabels: { "0": "Studio", "1": "1 bedroom", "2": "2 bedrooms", "3": "3 bedrooms", "4": "4 bedrooms", "5": "5+ bedrooms" },
    viewDetails: "View details",
    availableUnits: "Available units",
    unitsTable: { ref: "Ref", type: "Type", beds: "Beds", area: "Area", price: "Price", status: "Status" },
    statusLabel: { available: "Available", reserved: "Reserved", sold: "Sold" },
    advisorTitle: "Your personal advisor",
    unitsPlural: { one: "unit", many: "units" },
    newForYou: "New for you",
    vatLabel: "+VAT",
    soldOut: "Sold out",
    lifeNearby: "LIFE NEARBY",
    closingEyebrow: "DIRECT CONTACT",
    closingTrust: "I personally answer every message - usually within the hour. Ask me anything about the properties in your selection, arranging a viewing, or the details of buying in Cyprus. No obligation, no rush.",
    whatsapp: "WhatsApp",
    call: "Call",
    email: "Email",
    whatsappMessage: "Hello, I viewed my personal selection and would like to talk about",
    notAvailableTitle: "This page is no longer available",
    notAvailableBody: "The link you used has expired or is no longer active. Please get in touch and we will be glad to help.",
    contactUs: "Contact us",
    legal: "This selection is provided for informational purposes and does not constitute an offer.",
    privacyPolicy: "Privacy policy",
    priceFrom: "from",
    units: "units",
  },
  de: {
    eyebrowTag: "IHRE PERSÖNLICHE AUSWAHL",
    intro: "Ich danke Ihnen für Ihr Vertrauen. Ich habe diese Objekte persönlich für Sie ausgewählt - jedes von ihnen entspricht Ihren Wünschen und verdient Ihre Aufmerksamkeit.",
    requirementsTitle: "Ihre Wünsche",
    budgetUpTo: "bis",
    propertyTypeNames: { Apartment: "Apartment", Villa: "Villa", Townhouse: "Stadthaus", Penthouse: "Penthouse" },
    timelineLabels: { IMMEDIATE: "Sofort", THREE_MONTHS: "Innerhalb von 3 Monaten", SIX_MONTHS: "Innerhalb von 6 Monaten", ONE_YEAR: "Innerhalb eines Jahres", JUST_LOOKING: "Nur interessiert" },
    bedroomLabels: { "0": "Studio", "1": "1 Schlafzimmer", "2": "2 Schlafzimmer", "3": "3 Schlafzimmer", "4": "4 Schlafzimmer", "5": "5+ Schlafzimmer" },
    viewDetails: "Details ansehen",
    availableUnits: "Verfügbare Einheiten",
    unitsTable: { ref: "Ref.", type: "Typ", beds: "Zimmer", area: "Fläche", price: "Preis", status: "Status" },
    statusLabel: { available: "Verfügbar", reserved: "Reserviert", sold: "Verkauft" },
    advisorTitle: "Ihr persönlicher Berater",
    unitsPlural: { one: "Objekt", many: "Objekte" },
    newForYou: "Neu für Sie",
    vatLabel: "+MwSt.",
    soldOut: "Ausverkauft",
    lifeNearby: "LEBEN IN DER NÄHE",
    closingEyebrow: "DIREKTER KONTAKT",
    closingTrust: "Ich beantworte jede Nachricht persönlich - in der Regel innerhalb einer Stunde. Stellen Sie mir jede Frage zu den Objekten Ihrer Auswahl, zur Organisation einer Besichtigung oder zu den Details des Kaufs. Ohne Verpflichtung und ohne Eile.",
    whatsapp: "WhatsApp",
    call: "Anrufen",
    email: "E-Mail",
    whatsappMessage: "Hallo, ich habe meine persönliche Auswahl gesehen und möchte gerne sprechen über",
    notAvailableTitle: "Diese Seite ist nicht mehr verfügbar",
    notAvailableBody: "Der verwendete Link ist abgelaufen oder wurde deaktiviert. Bitte nehmen Sie Kontakt zu uns auf, wir helfen Ihnen gerne weiter.",
    contactUs: "Kontakt aufnehmen",
    legal: "Diese Auswahl dient ausschließlich zu Informationszwecken und stellt kein Angebot dar.",
    privacyPolicy: "Datenschutzerklärung",
    priceFrom: "ab",
    units: "Einheiten",
  },
  pl: {
    eyebrowTag: "TWÓJ INDYWIDUALNY WYBÓR",
    intro: "Dziękuję za zaufanie. Osobiście wybrałem dla Państwa te nieruchomości - każda z nich odpowiada Państwa oczekiwaniom i zasługuje na uwagę.",
    requirementsTitle: "Twoje preferencje",
    budgetUpTo: "do",
    propertyTypeNames: { Apartment: "Apartament", Villa: "Willa", Townhouse: "Dom szeregowy", Penthouse: "Penthouse" },
    timelineLabels: { IMMEDIATE: "Natychmiast", THREE_MONTHS: "W ciągu 3 miesięcy", SIX_MONTHS: "W ciągu 6 miesięcy", ONE_YEAR: "W ciągu roku", JUST_LOOKING: "Tylko oglądam" },
    bedroomLabels: { "0": "Kawalerka", "1": "1 sypialnia", "2": "2 sypialnie", "3": "3 sypialnie", "4": "4 sypialnie", "5": "5+ sypialni" },
    viewDetails: "Zobacz szczegóły",
    availableUnits: "Dostępne lokale",
    unitsTable: { ref: "Nr", type: "Typ", beds: "Sypialnie", area: "Powierzchnia", price: "Cena", status: "Status" },
    statusLabel: { available: "Dostępne", reserved: "Zarezerwowane", sold: "Sprzedane" },
    advisorTitle: "Państwa osobisty doradca",
    unitsPlural: { one: "obiekt", few: "obiekty", many: "obiektów" },
    newForYou: "Nowe dla Ciebie",
    vatLabel: "+VAT",
    soldOut: "Wyprzedane",
    lifeNearby: "ŻYCIE W POBLIŻU",
    closingEyebrow: "BEZPOŚREDNI KONTAKT",
    closingTrust: "Osobiście odpowiadam na każdą wiadomość - zazwyczaj w ciągu godziny. Zadaj mi dowolne pytanie o nieruchomości z Twojej selekcji, organizację oględzin lub szczegóły zakupu. Bez zobowiązań i bez pośpiechu.",
    whatsapp: "WhatsApp",
    call: "Zadzwoń",
    email: "E-mail",
    whatsappMessage: "Dzień dobry, obejrzałem moją osobistą propozycję i chciałbym porozmawiać o",
    notAvailableTitle: "Ta strona nie jest już dostępna",
    notAvailableBody: "Użyty link wygasł lub został dezaktywowany. Prosimy o kontakt - chętnie pomożemy.",
    contactUs: "Skontaktuj się z nami",
    legal: "Ta propozycja ma charakter wyłącznie informacyjny i nie stanowi oferty.",
    privacyPolicy: "Polityka prywatności",
    priceFrom: "od",
    units: "lokali",
  },
  ru: {
    eyebrowTag: "ВАШ ИНДИВИДУАЛЬНЫЙ ПОДБОР",
    intro: "Благодарю вас за доверие. Я лично отобрал для вас эти объекты - каждый из них соответствует вашим пожеланиям и заслуживает внимания.",
    requirementsTitle: "Ваши пожелания",
    budgetUpTo: "до",
    propertyTypeNames: { Apartment: "Квартира", Villa: "Вилла", Townhouse: "Таунхаус", Penthouse: "Пентхаус" },
    timelineLabels: { IMMEDIATE: "Срочно", THREE_MONTHS: "В течение 3 месяцев", SIX_MONTHS: "В течение 6 месяцев", ONE_YEAR: "В течение года", JUST_LOOKING: "Пока присматриваюсь" },
    bedroomLabels: { "0": "Студия", "1": "1 спальня", "2": "2 спальни", "3": "3 спальни", "4": "4 спальни", "5": "5+ спален" },
    viewDetails: "Подробнее",
    availableUnits: "Доступные объекты",
    unitsTable: { ref: "№", type: "Тип", beds: "Спальни", area: "Площадь", price: "Цена", status: "Статус" },
    statusLabel: { available: "Доступно", reserved: "Забронировано", sold: "Продано" },
    advisorTitle: "Ваш персональный консультант",
    unitsPlural: { one: "объект", few: "объекта", many: "объектов" },
    newForYou: "Новое для вас",
    vatLabel: "+НДС",
    soldOut: "Продано",
    lifeNearby: "ЖИЗНЬ РЯДОМ",
    closingEyebrow: "ПРЯМОЙ КОНТАКТ",
    closingTrust: "Я лично отвечаю на каждое сообщение - обычно в течение часа. Задайте любой вопрос по объектам из вашей подборки, организации просмотра или деталям покупки. Без обязательств и без спешки.",
    whatsapp: "WhatsApp",
    call: "Позвонить",
    email: "Эл. почта",
    whatsappMessage: "Здравствуйте, я посмотрел свою персональную подборку и хотел бы обсудить",
    notAvailableTitle: "Эта страница больше не доступна",
    notAvailableBody: "Использованная ссылка истекла или была отключена. Пожалуйста, свяжитесь с нами - мы будем рады помочь.",
    contactUs: "Связаться с нами",
    legal: "Данная подборка носит исключительно информационный характер и не является офертой.",
    privacyPolicy: "Политика конфиденциальности",
    priceFrom: "от",
    units: "объектов",
  },
};

/** "N <localized unit noun>" with correct plural form per locale (RU/PL are
 *  3-way: one/few/many with the standard mod-10/mod-100 teen exceptions;
 *  EN/DE are a plain singular/plural binary). */
export function formatUnitsCount(locale: PLocale, n: number): string {
  const p = COPY[locale].unitsPlural;
  const mod10 = n % 10;
  const mod100 = n % 100;
  let form: "one" | "few" | "many";
  if (locale === "ru") {
    form = mod10 === 1 && mod100 !== 11 ? "one"
      : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? "few"
      : "many";
  } else if (locale === "pl") {
    form = n === 1 ? "one"
      : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? "few"
      : "many";
  } else {
    form = n === 1 ? "one" : "many";
  }
  const word = (form === "few" ? p.few : undefined) ?? p.many;
  return `${n} ${form === "one" ? p.one : word}`;
}
