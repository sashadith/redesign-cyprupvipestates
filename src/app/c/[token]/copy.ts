import { HE_LANGUAGE_NOTE, LOCALES, isLocale, type Locale } from "@/lib/locale";
export type PLocale = Locale;
export const P_LOCALES = LOCALES;
export const asPLocale = (v: string | null | undefined): PLocale => (v && isLocale(v) ? v : "en");

type Greeting = { morning: string; afternoon: string; evening: string };
const GREETING_EN: Greeting = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" };
const GREETING: Record<PLocale, Greeting> = {
  en: GREETING_EN,
  de: { morning: "Guten Morgen", afternoon: "Guten Tag", evening: "Guten Abend" },
  pl: { morning: "Dzień dobry", afternoon: "Dzień dobry", evening: "Dobry wieczór" },
  ru: { morning: "Доброе утро", afternoon: "Добрый день", evening: "Добрый вечер" },
  he: { morning: "בוקר טוב", afternoon: "צהריים טובים", evening: "ערב טוב" }, // REVIEW(he)
};

/** Time-of-day greeting word, by server clock hour (0-23). */
export function timeOfDayGreeting(locale: PLocale, hour: number): string {
  const g = GREETING[locale];
  if (hour < 12) return g.morning;
  if (hour < 18) return g.afternoon;
  return g.evening;
}

export type PresentationCopy = {
  /** Browser-tab title + meta description. Carries NO per-token content —
   *  only the locale reaches it (Pass B Should fix #21). */
  metaTitle: string;
  metaDescription: string;
  eyebrowTag: string;
  intro: string;
  requirementsTitle: string;
  budgetUpTo: string;
  /** Budget-chip LOWER bound ("from €300,000"). Deliberately NOT `priceFrom`:
   *  that one is a card caption for an OBJECT's entry price, this one is the
   *  client's own budget floor. Hebrew needs two different words for them
   *  (`מעל` vs `מחיר התחלתי`) — Pass B Must fix #14. */
  budgetFrom: string;
  propertyTypeNames: Record<string, string>;
  timelineLabels: Record<string, string>;
  bedroomLabels: Record<string, string>; // keyed "0".."5" — 0 = studio, 5 = "5+"
  viewDetails: string;
  availableUnits: string;
  unitsTable: { unit: string; type: string; beds: string; area: string; price: string; status: string };
  // Keyed by DevelopmentUnit.status (a plain string, not an enum — see
  // prisma/schema.prisma). Must cover "available"/"reserved"/"sold" plus
  // "unlisted" — the one status a hand-picked unit can carry that a live feed
  // never reports itself (derived by the sync when a unit disappears from the
  // feed, see feedSync.ts) — shown here, never hidden, per the 2026-08-06
  // decision: a client who already saw a unit shouldn't have it vanish
  // without explanation.
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
  /** Icon-button screen-reader labels — English `aria-label`s were the last
   *  untranslated strings on the Hebrew page (Pass B Should fix #16). */
  close: string;
  favorite: string;
  priceFrom: string;
  units: string;
  delivery: string;
  viewOnSite: string;
};

const COPY_EN: PresentationCopy = {
  metaTitle: "Your Property Selection - Cyprus VIP Estates",
  metaDescription: "A personal property selection.",
  eyebrowTag: "YOUR PERSONAL SELECTION",
  intro: "Thank you for your trust. I have personally selected these properties for you - each of them matches your wishes and deserves your attention.",
  requirementsTitle: "Your preferences",
  budgetUpTo: "up to",
  budgetFrom: "from",
  propertyTypeNames: { Apartment: "Apartment", Villa: "Villa", Townhouse: "Townhouse", Penthouse: "Penthouse" },
  timelineLabels: { IMMEDIATE: "Immediate", THREE_MONTHS: "Within 3 months", SIX_MONTHS: "Within 6 months", ONE_YEAR: "Within a year", TWO_YEARS: "Within 2 years", JUST_LOOKING: "Just looking" },
  bedroomLabels: { "0": "Studio", "1": "1 bedroom", "2": "2 bedrooms", "3": "3 bedrooms", "4": "4 bedrooms", "5": "5+ bedrooms" },
  viewDetails: "View details",
  availableUnits: "Available units",
  unitsTable: { unit: "Unit", type: "Type", beds: "Beds", area: "Area", price: "Price", status: "Status" },
  statusLabel: { available: "Available", reserved: "Reserved", sold: "Sold", unlisted: "No longer available" },
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
  close: "Close",
  favorite: "Favorite",
  priceFrom: "from",
  units: "units",
  delivery: "Delivery",
  viewOnSite: "View on site",
};

export const COPY: Record<PLocale, PresentationCopy> = {
  en: COPY_EN,
  de: {
    metaTitle: "Ihre Immobilienauswahl - Cyprus VIP Estates",
    metaDescription: "Eine persönliche Immobilienauswahl.",
    eyebrowTag: "IHRE PERSÖNLICHE AUSWAHL",
    intro: "Ich danke Ihnen für Ihr Vertrauen. Ich habe diese Objekte persönlich für Sie ausgewählt - jedes von ihnen entspricht Ihren Wünschen und verdient Ihre Aufmerksamkeit.",
    requirementsTitle: "Ihre Wünsche",
    budgetUpTo: "bis",
    budgetFrom: "ab",
    propertyTypeNames: { Apartment: "Apartment", Villa: "Villa", Townhouse: "Stadthaus", Penthouse: "Penthouse" },
    timelineLabels: { IMMEDIATE: "Sofort", THREE_MONTHS: "Innerhalb von 3 Monaten", SIX_MONTHS: "Innerhalb von 6 Monaten", ONE_YEAR: "Innerhalb eines Jahres", TWO_YEARS: "Innerhalb von 2 Jahren", JUST_LOOKING: "Nur interessiert" },
    bedroomLabels: { "0": "Studio", "1": "1 Schlafzimmer", "2": "2 Schlafzimmer", "3": "3 Schlafzimmer", "4": "4 Schlafzimmer", "5": "5+ Schlafzimmer" },
    viewDetails: "Details ansehen",
    availableUnits: "Verfügbare Einheiten",
    unitsTable: { unit: "Einheit", type: "Typ", beds: "Zimmer", area: "Fläche", price: "Preis", status: "Status" },
    statusLabel: { available: "Verfügbar", reserved: "Reserviert", sold: "Verkauft", unlisted: "Nicht mehr verfügbar" },
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
    close: "Schließen",
    favorite: "Merken",
    priceFrom: "ab",
    units: "Einheiten",
    delivery: "Fertigstellung",
    viewOnSite: "Auf der Website ansehen",
  },
  pl: {
    metaTitle: "Twój wybór nieruchomości - Cyprus VIP Estates",
    metaDescription: "Indywidualny wybór nieruchomości.",
    eyebrowTag: "TWÓJ INDYWIDUALNY WYBÓR",
    intro: "Dziękuję za zaufanie. Osobiście wybrałem dla Państwa te nieruchomości - każda z nich odpowiada Państwa oczekiwaniom i zasługuje na uwagę.",
    requirementsTitle: "Twoje preferencje",
    budgetUpTo: "do",
    budgetFrom: "od",
    propertyTypeNames: { Apartment: "Apartament", Villa: "Willa", Townhouse: "Dom szeregowy", Penthouse: "Penthouse" },
    timelineLabels: { IMMEDIATE: "Natychmiast", THREE_MONTHS: "W ciągu 3 miesięcy", SIX_MONTHS: "W ciągu 6 miesięcy", ONE_YEAR: "W ciągu roku", TWO_YEARS: "W ciągu 2 lat", JUST_LOOKING: "Tylko oglądam" },
    bedroomLabels: { "0": "Kawalerka", "1": "1 sypialnia", "2": "2 sypialnie", "3": "3 sypialnie", "4": "4 sypialnie", "5": "5+ sypialni" },
    viewDetails: "Zobacz szczegóły",
    availableUnits: "Dostępne lokale",
    unitsTable: { unit: "Lokal", type: "Typ", beds: "Sypialnie", area: "Powierzchnia", price: "Cena", status: "Status" },
    statusLabel: { available: "Dostępne", reserved: "Zarezerwowane", sold: "Sprzedane", unlisted: "Już niedostępne" },
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
    close: "Zamknij",
    favorite: "Dodaj do ulubionych",
    priceFrom: "od",
    units: "lokali",
    delivery: "Termin oddania",
    viewOnSite: "Zobacz na stronie",
  },
  ru: {
    metaTitle: "Ваш подбор объектов - Cyprus VIP Estates",
    metaDescription: "Персональная подборка объектов.",
    eyebrowTag: "ВАШ ИНДИВИДУАЛЬНЫЙ ПОДБОР",
    intro: "Благодарю вас за доверие. Я лично отобрал для вас эти объекты - каждый из них соответствует вашим пожеланиям и заслуживает внимания.",
    requirementsTitle: "Ваши пожелания",
    budgetUpTo: "до",
    budgetFrom: "от",
    propertyTypeNames: { Apartment: "Квартира", Villa: "Вилла", Townhouse: "Таунхаус", Penthouse: "Пентхаус" },
    timelineLabels: { IMMEDIATE: "Срочно", THREE_MONTHS: "В течение 3 месяцев", SIX_MONTHS: "В течение 6 месяцев", ONE_YEAR: "В течение года", TWO_YEARS: "В течение 2 лет", JUST_LOOKING: "Пока присматриваюсь" },
    bedroomLabels: { "0": "Студия", "1": "1 спальня", "2": "2 спальни", "3": "3 спальни", "4": "4 спальни", "5": "5+ спален" },
    viewDetails: "Подробнее",
    availableUnits: "Доступные объекты",
    unitsTable: { unit: "Объект", type: "Тип", beds: "Спальни", area: "Площадь", price: "Цена", status: "Статус" },
    statusLabel: { available: "Доступно", reserved: "Забронировано", sold: "Продано", unlisted: "Больше не доступно" },
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
    close: "Закрыть",
    favorite: "В избранное",
    priceFrom: "от",
    units: "объектов",
    delivery: "Срок сдачи",
    viewOnSite: "Смотреть на сайте",
  },
  he: {
    metaTitle: "המבחר האישי שלכם | Cyprus VIP Estates",
    metaDescription: "מבחר נכסים אישי בקפריסין.",
    eyebrowTag: "המבחר האישי שלכם",
    intro: "תודה על האמון. בחרתי עבורכם באופן אישי את הנכסים האלה. כל אחד מהם מתאים למה שביקשתם ושווה תשומת לב.",
    requirementsTitle: "ההעדפות שלכם",
    budgetUpTo: "עד",
    budgetFrom: "מעל",
    propertyTypeNames: { Apartment: "דירה", Villa: "וילה", Townhouse: "בית טורי", Penthouse: "פנטהאוז" },
    timelineLabels: { IMMEDIATE: "מיידי", THREE_MONTHS: "תוך 3 חודשים", SIX_MONTHS: "תוך 6 חודשים", ONE_YEAR: "תוך שנה", TWO_YEARS: "תוך שנתיים", JUST_LOOKING: "בשלב בדיקה" },
    bedroomLabels: { "0": "סטודיו", "1": "חדר שינה אחד", "2": "2 חדרי שינה", "3": "3 חדרי שינה", "4": "4 חדרי שינה", "5": "5+ חדרי שינה" },
    viewDetails: "לפרטים נוספים",
    availableUnits: "יחידות זמינות",
    unitsTable: { unit: "יחידה", type: "סוג", beds: "חד׳ שינה", area: "שטח", price: "מחיר", status: "סטטוס" },
    statusLabel: { available: "זמינה", reserved: "שמורה", sold: "נמכרה", unlisted: "לא זמינה עוד" },
    advisorTitle: "היועץ האישי שלכם",
    unitsPlural: { one: "יחידה", many: "יחידות" },
    newForYou: "חדש עבורכם",
    vatLabel: "+ מע\"מ",
    soldOut: "נמכר",
    lifeNearby: "החיים בסביבה",
    closingEyebrow: "קשר ישיר",
    closingTrust: `אני עונה לכל הודעה בעצמי, בדרך כלל בתוך שעה. אפשר לשאול אותי כל דבר על הנכסים שבמבחר שלכם, על תיאום סיור ועל פרטי הרכישה בקפריסין. בלי התחייבות ובלי לחץ. ${HE_LANGUAGE_NOTE}`,
    whatsapp: "וואטסאפ",
    call: "להתקשר",
    email: "אימייל",
    whatsappMessage: "שלום, עברתי על המבחר האישי שלי ואשמח לדבר על",
    notAvailableTitle: "הדף אינו זמין עוד",
    notAvailableBody: "תוקף הקישור פג או שהוא כבר אינו פעיל. אפשר לפנות אלינו ונשמח לעזור.",
    contactUs: "ליצירת קשר",
    legal: "המבחר נועד למידע בלבד ואינו מהווה הצעה.",
    privacyPolicy: "מדיניות הפרטיות",
    close: "סגירה",
    favorite: "שמירה למועדפים",
    priceFrom: "מחיר התחלתי",
    units: "יחידות",
    delivery: "מסירה",
    viewOnSite: "לצפייה באתר",
  }, // REVIEW(he)
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
