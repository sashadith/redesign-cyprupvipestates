/* UI copy for the redesigned Case Studies index + detail pages, per language.
   The story CONTENT itself (title, excerpt, narrative, client-overview facts)
   already lives fully translated in the database — see prisma.caseStudy,
   language-keyed via translationGroupId. This file only covers the page
   CHROME around it: hero copy, stat labels, buttons, section titles — text
   that was hardcoded English before this page had any locale beyond "en".

   DE/PL/RU translations here are a first pass (not run past a professional
   translator) — flagged when this went live; happy to swap in reviewed
   copy if/when that's available, same file/shape either way. */

import type { Locale } from "@/lib/locale";

export type CaseStudiesCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  heroTitlePlain: string;
  heroTitleItalic: string;
  heroLead: string;
  heroMetaOne: string;
  heroMetaMany: (n: number) => string;
  deviceKickerFallback: string;
  deviceHeadlineFallback: string;
  deviceRead: string;
  statBudget: string;
  statLocation: string;
  statProperty: string;
  statTimeline: string;
  ctaReadFull: string;
  formIndexTitlePlain: string;
  formIndexTitleItalic: string;
  formIndexSubtitle: string;
  backLink: string;
  privacyNote: string;
  stageClientSituation: string;
  stageClientRequirements: string;
  stageOurSolution: string;
  stageSelectedProperty: string;
  stageResult: string;
  journeyLabel: string;
  relatedTitlePlain: string;
  relatedTitleItalic: string;
  soldBadge: string;
  formDetailTitlePlain: string;
  formDetailTitleItalic: string;
  formDetailSubtitle: string;
  propertyTypeVilla: string;
  propertyTypeApartment: string;
  propertyTypePenthouse: string;
  propertyTypeTownhouse: string;
  propertyTypePlot: string;
  guideEyebrow: string;
  guideTitle: string;
};

const EN: CaseStudiesCopy = {
    metaTitle: "Cyprus Property Success Stories",
    metaDescription: "Real Cyprus property purchases — relocation, investment and lifestyle buyers, and how we helped them find the right home.",
    eyebrow: "Success Stories",
    heroTitlePlain: "Case ",
    heroTitleItalic: "Studies",
    heroLead: "Real Cyprus property purchases, from first consultation to keys in hand — how relocation, investment and lifestyle buyers found the right home with us.",
    heroMetaOne: "client success story",
    heroMetaMany: (n) => `${n} client success stories`,
    deviceKickerFallback: "Case Study",
    deviceHeadlineFallback: "A Cyprus property success story",
    deviceRead: "Read the story",
    statBudget: "Budget",
    statLocation: "Location",
    statProperty: "Property",
    statTimeline: "Timeline",
    ctaReadFull: "Read the full story",
    formIndexTitlePlain: "Considering ",
    formIndexTitleItalic: "your own",
    formIndexSubtitle: "Leave your details and our team will get in touch to understand your needs, answer your questions, and help you find the right way forward.",
    backLink: "Case Studies",
    privacyNote: "Client privacy comes first — sensitive business information and identifying details are not disclosed in this case study.",
    stageClientSituation: "Client Situation",
    stageClientRequirements: "Client Requirements",
    stageOurSolution: "Our Solution",
    stageSelectedProperty: "Selected Property",
    stageResult: "Result",
    journeyLabel: "The Journey",
    relatedTitlePlain: "Related ",
    relatedTitleItalic: "Properties",
    soldBadge: "Sold",
    formDetailTitlePlain: "Ready to write ",
    formDetailTitleItalic: "your own",
    formDetailSubtitle: "Leave your details and our team will get in touch to discuss your goals, answer your questions, and help turn your plans into the next success story.",
    propertyTypeVilla: "Villa",
    propertyTypeApartment: "Apartment",
    propertyTypePenthouse: "Penthouse",
    propertyTypeTownhouse: "Townhouse",
    propertyTypePlot: "Plot",
    guideEyebrow: "The Guide",
    guideTitle: "Understanding Case Studies",
};

export const CASE_STUDIES_COPY: Record<Locale, CaseStudiesCopy> = {
  en: EN,
  de: {
    metaTitle: "Erfolgsgeschichten",
    metaDescription: "Echte Immobilienkäufe in Zypern — Umzug, Investition und Lifestyle-Käufer, und wie wir ihnen geholfen haben, das richtige Zuhause zu finden.",
    eyebrow: "Erfolgsgeschichten",
    heroTitlePlain: "Erfolgs",
    heroTitleItalic: "geschichten",
    heroLead: "Echte Immobilienkäufe in Zypern, von der ersten Beratung bis zur Schlüsselübergabe — wie Käufer mit Umzugs-, Investitions- und Lifestyle-Zielen mit uns das richtige Zuhause gefunden haben.",
    heroMetaOne: "Erfolgsgeschichte von Kunden",
    heroMetaMany: (n) => `${n} Erfolgsgeschichten von Kunden`,
    deviceKickerFallback: "Erfolgsgeschichte",
    deviceHeadlineFallback: "Eine Erfolgsgeschichte aus Zypern",
    deviceRead: "Geschichte lesen",
    statBudget: "Budget",
    statLocation: "Lage",
    statProperty: "Immobilie",
    statTimeline: "Zeitrahmen",
    ctaReadFull: "Ganze Geschichte lesen",
    formIndexTitlePlain: "Denken Sie über ",
    formIndexTitleItalic: "Ihren eigenen",
    formIndexSubtitle: "Hinterlassen Sie Ihre Daten und unser Team wird sich mit Ihnen in Verbindung setzen, um Ihre Bedürfnisse zu verstehen, Ihre Fragen zu beantworten und Ihnen den richtigen Weg zu zeigen.",
    backLink: "Erfolgsgeschichten",
    privacyNote: "Die Privatsphäre unserer Kunden hat Priorität — sensible geschäftliche Informationen und identifizierende Details werden in dieser Fallstudie nicht offengelegt.",
    stageClientSituation: "Ausgangssituation",
    stageClientRequirements: "Anforderungen des Kunden",
    stageOurSolution: "Unsere Lösung",
    stageSelectedProperty: "Ausgewählte Immobilie",
    stageResult: "Ergebnis",
    journeyLabel: "Der Weg",
    relatedTitlePlain: "Ähnliche ",
    relatedTitleItalic: "Immobilien",
    soldBadge: "Verkauft",
    formDetailTitlePlain: "Bereit für ",
    formDetailTitleItalic: "Ihre eigene",
    formDetailSubtitle: "Hinterlassen Sie Ihre Daten und unser Team wird sich mit Ihnen in Verbindung setzen, um Ihre Ziele zu besprechen, Ihre Fragen zu beantworten und Ihre Pläne in die nächste Erfolgsgeschichte zu verwandeln.",
    propertyTypeVilla: "Villa",
    propertyTypeApartment: "Wohnung",
    propertyTypePenthouse: "Penthouse",
    propertyTypeTownhouse: "Stadthaus",
    propertyTypePlot: "Grundstück",
    guideEyebrow: "Der Ratgeber",
    guideTitle: "Fallstudien verstehen",
  },
  pl: {
    metaTitle: "Historie sukcesu",
    metaDescription: "Prawdziwe transakcje zakupu nieruchomości na Cyprze — klienci przeprowadzający się, inwestujący i szukający stylu życia oraz jak pomogliśmy znaleźć odpowiedni dom.",
    eyebrow: "Historie sukcesu",
    heroTitlePlain: "Historie ",
    heroTitleItalic: "sukcesu",
    heroLead: "Prawdziwe transakcje zakupu nieruchomości na Cyprze, od pierwszej konsultacji po odbiór kluczy — jak klienci przeprowadzający się, inwestujący i szukający stylu życia znaleźli z nami odpowiedni dom.",
    heroMetaOne: "historia sukcesu klienta",
    heroMetaMany: (n) => `${n} historii sukcesu klientów`,
    deviceKickerFallback: "Historia sukcesu",
    deviceHeadlineFallback: "Historia sukcesu na Cyprze",
    deviceRead: "Czytaj historię",
    statBudget: "Budżet",
    statLocation: "Lokalizacja",
    statProperty: "Nieruchomość",
    statTimeline: "Ramy czasowe",
    ctaReadFull: "Przeczytaj całą historię",
    formIndexTitlePlain: "Rozważasz ",
    formIndexTitleItalic: "swój własny",
    formIndexSubtitle: "Zostaw swoje dane, a nasz zespół skontaktuje się z Tobą, aby zrozumieć Twoje potrzeby, odpowiedzieć na pytania i pomóc znaleźć właściwą drogę.",
    backLink: "Historie sukcesu",
    privacyNote: "Prywatność klienta jest najważniejsza — wrażliwe informacje biznesowe i dane identyfikujące nie są ujawniane w tym studium przypadku.",
    stageClientSituation: "Sytuacja klienta",
    stageClientRequirements: "Wymagania klienta",
    stageOurSolution: "Nasze rozwiązanie",
    stageSelectedProperty: "Wybrana nieruchomość",
    stageResult: "Rezultat",
    journeyLabel: "Podróż",
    relatedTitlePlain: "Podobne ",
    relatedTitleItalic: "Nieruchomości",
    soldBadge: "Sprzedano",
    formDetailTitlePlain: "Gotów napisać ",
    formDetailTitleItalic: "swoją własną",
    formDetailSubtitle: "Zostaw swoje dane, a nasz zespół skontaktuje się z Tobą, aby omówić Twoje cele, odpowiedzieć na pytania i pomóc zamienić Twoje plany w kolejną historię sukcesu.",
    propertyTypeVilla: "Willa",
    propertyTypeApartment: "Apartament",
    propertyTypePenthouse: "Penthouse",
    propertyTypeTownhouse: "Dom szeregowy",
    propertyTypePlot: "Działka",
    guideEyebrow: "Przewodnik",
    guideTitle: "Zrozumieć studia przypadków",
  },
  ru: {
    metaTitle: "Истории успеха",
    metaDescription: "Реальные сделки по покупке недвижимости на Кипре — переезд, инвестиции и лайфстайл-покупатели, и как мы помогли им найти подходящий дом.",
    eyebrow: "Истории успеха",
    heroTitlePlain: "Истории ",
    heroTitleItalic: "успеха",
    heroLead: "Реальные сделки по покупке недвижимости на Кипре, от первой консультации до получения ключей — как покупатели, переезжающие, инвестирующие или ищущие новый образ жизни, нашли с нами подходящий дом.",
    heroMetaOne: "история успеха клиента",
    heroMetaMany: (n) => `${n} историй успеха клиентов`,
    deviceKickerFallback: "История успеха",
    deviceHeadlineFallback: "История успеха на Кипре",
    deviceRead: "Читать историю",
    statBudget: "Бюджет",
    statLocation: "Расположение",
    statProperty: "Недвижимость",
    statTimeline: "Сроки",
    ctaReadFull: "Читать полную историю",
    formIndexTitlePlain: "Рассматриваете ",
    formIndexTitleItalic: "свой переезд",
    formIndexSubtitle: "Оставьте свои данные, и наша команда свяжется с вами, чтобы понять ваши потребности, ответить на вопросы и помочь найти правильный путь.",
    backLink: "Истории успеха",
    privacyNote: "Конфиденциальность клиента превыше всего — конфиденциальная деловая информация и идентифицирующие данные не раскрываются в этом кейсе.",
    stageClientSituation: "Исходная ситуация",
    stageClientRequirements: "Требования клиента",
    stageOurSolution: "Наше решение",
    stageSelectedProperty: "Выбранная недвижимость",
    stageResult: "Результат",
    journeyLabel: "Путь клиента",
    relatedTitlePlain: "Похожая ",
    relatedTitleItalic: "недвижимость",
    soldBadge: "Продано",
    formDetailTitlePlain: "Готовы написать ",
    formDetailTitleItalic: "свою историю",
    formDetailSubtitle: "Оставьте свои данные, и наша команда свяжется с вами, чтобы обсудить ваши цели, ответить на вопросы и помочь превратить ваши планы в следующую историю успеха.",
    propertyTypeVilla: "Вилла",
    propertyTypeApartment: "Квартира",
    propertyTypePenthouse: "Пентхаус",
    propertyTypeTownhouse: "Таунхаус",
    propertyTypePlot: "Участок",
    guideEyebrow: "Гид",
    guideTitle: "Понимание кейсов",
  },
  he: { // REVIEW(he)
    metaTitle: "סיפורי לקוחות שקנו נכס בקפריסין | Cyprus VIP Estates",
    metaDescription: "סיפורים אמיתיים של רוכשי נדל\"ן בקפריסין: רילוקיישן, השקעה ובית שני. בכל סיפור מופיעים התקציב, המיקום, סוג הנכס ולוח הזמנים של העסקה.",
    eyebrow: "מהשטח",
    heroTitlePlain: "סיפורי ",
    heroTitleItalic: "לקוחות",
    heroLead: "עסקאות נדל\"ן אמיתיות בקפריסין, מהייעוץ הראשון ועד קבלת המפתחות. כך מצאו איתנו רוכשים שעשו רילוקיישן, משקיעים ומחפשי בית שני את הנכס שהתאים להם.",
    // Carries the numeral as a word, because page.tsx does NOT print a digit
    // in front of it for `he` (see the count-line branch there). LTR keeps the
    // bare noun phrase with the digit supplied by the JSX.
    heroMetaOne: "סיפור לקוח אחד",
    heroMetaMany: (n) => `${n} סיפורי לקוחות`,
    deviceKickerFallback: "סיפור לקוח",
    deviceHeadlineFallback: "סיפור הצלחה של רוכשים בקפריסין",
    deviceRead: "לקריאת הסיפור",
    statBudget: "תקציב",
    statLocation: "מיקום",
    statProperty: "סוג הנכס",
    statTimeline: "לוח זמנים",
    ctaReadFull: "לסיפור המלא",
    formIndexTitlePlain: "שוקלים ",
    formIndexTitleItalic: "מהלך דומה?",
    // Closing sentence = Entscheidung E (he-glossary.md §5), verbatim: this is
    // a lead form promising a call back, so it says which languages the
    // consultation runs in. Same sentence in formDetailSubtitle below.
    formIndexSubtitle: "השאירו פרטים והצוות שלנו יחזור אליכם כדי להבין מה אתם מחפשים, לענות על השאלות ולעזור לכם לבחור נכון. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.",
    backLink: "סיפורי לקוחות",
    privacyNote: "פרטיות הלקוחות קודמת לכל, ולכן מידע עסקי רגיש ונתונים מזהים אינם נחשפים בסיפור זה.",
    stageClientSituation: "רקע הלקוח",
    stageClientRequirements: "דרישות הלקוח",
    stageOurSolution: "הפתרון שלנו",
    stageSelectedProperty: "הנכס שנבחר",
    stageResult: "התוצאה",
    journeyLabel: "שלבי התהליך",
    // The cards are editorially linked projects (cs.relatedProjects), not a
    // similarity computation, so no "דומים"; gold accent sits on the noun, the
    // same rule WP4 fixed for "Related reading". Word-identical to
    // CASE_STUDY_PAGE_COPY.he.relatedProperties (§11.6).
    relatedTitlePlain: "עוד ",
    relatedTitleItalic: "נכסים",
    soldBadge: "נמכר",
    formDetailTitlePlain: "מוכנים לכתוב ",
    formDetailTitleItalic: "סיפור משלכם?",
    formDetailSubtitle: "השאירו פרטים והצוות שלנו יחזור אליכם כדי לדבר על המטרות שלכם, לענות על השאלות ולהפוך אותן לסיפור ההצלחה הבא. הייעוץ מתקיים באנגלית או ברוסית; פנייה בעברית מתקבלת בברכה.",
    propertyTypeVilla: "וילה",
    propertyTypeApartment: "דירה",
    propertyTypePenthouse: "פנטהאוז",
    propertyTypeTownhouse: "בית טורי",
    propertyTypePlot: "מגרש",
    guideEyebrow: "המדריך",
    guideTitle: "איך לקרוא סיפורי לקוחות",
  },
};

export function caseStudiesCopy(lang: string): CaseStudiesCopy {
  return CASE_STUDIES_COPY[lang as Locale] ?? CASE_STUDIES_COPY.en;
}
