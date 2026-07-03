// Localized UI strings for the homepage redesign sections. The staging preview
// hardcoded these in English; they're localized here for en/de/pl/ru so the live
// home has no untranslated UI. CMS-authored copy (section titles, descriptions,
// bullets, project/case data) still comes from the content DB — these are only
// the small marketing labels the preview baked in.

export type HomeStrings = {
  heroLine1: string; heroAccent: string; heroLine2: string; // "Cyprus [Property] Experts"
  getConsultation: string;
  viewAllProjects: string;
  citiesLead: string;
  newLead2: string; newAccent: string; newLead: string; showAllProjects: string; // New Listings
  priceFrom: string; priceOnRequest: string; onRequest: string; sold: string;
  contentTitle: string; contentLead: string;
  faqLead: string;
  readCaseStudy: string; exploreAllCases: string;
};

const EN: HomeStrings = {
  heroLine1: "Cyprus ", heroAccent: "Property", heroLine2: " Experts",
  getConsultation: "Get Consultation",
  viewAllProjects: "View All Projects",
  citiesLead:
    "From lively marinas to quiet old towns, each Cypriot city offers a different way to live by the sea. Whether you are drawn to the cosmopolitan energy of Limassol, the historic charm of Paphos, or the relaxed coastal pace of Larnaca — Cyprus rewards every lifestyle with world-class infrastructure, a stable legal framework, and over 340 days of sunshine each year.",
  newLead2: "New ", newAccent: "Listings",
  newLead: "The newest additions to our real estate collection.",
  showAllProjects: "Show all projects",
  priceFrom: "from", priceOnRequest: "Price on request", onRequest: "On request", sold: "Sold",
  contentTitle: "Your Guide to Property in Cyprus",
  contentLead:
    "What to know before you buy — the regions, the property types, the process for international clients, and where the long-term value lies.",
  faqLead: "Everything buyers ask us about property in Cyprus, in one place.",
  readCaseStudy: "Read case study", exploreAllCases: "Explore all cases",
};

export const HOME_STRINGS: Record<string, HomeStrings> = {
  en: EN,
  de: {
    heroLine1: "Zyperns ", heroAccent: "Immobilien", heroLine2: "experten",
    getConsultation: "Beratung anfragen",
    viewAllProjects: "Alle Projekte ansehen",
    citiesLead:
      "Von lebhaften Yachthäfen bis zu ruhigen Altstädten – jede zypriotische Stadt bietet eine eigene Art, am Meer zu leben. Ob die kosmopolitische Energie von Limassol, der historische Charme von Paphos oder das entspannte Küstentempo von Larnaca – Zypern belohnt jeden Lebensstil mit erstklassiger Infrastruktur, einem stabilen Rechtsrahmen und über 340 Sonnentagen im Jahr.",
    newLead2: "Neue ", newAccent: "Angebote",
    newLead: "Die neuesten Ergänzungen unserer Immobilienkollektion.",
    showAllProjects: "Alle Projekte anzeigen",
    priceFrom: "ab", priceOnRequest: "Preis auf Anfrage", onRequest: "Auf Anfrage", sold: "Verkauft",
    contentTitle: "Ihr Leitfaden für Immobilien auf Zypern",
    contentLead:
      "Was Sie vor dem Kauf wissen sollten – die Regionen, die Immobilientypen, der Ablauf für internationale Kunden und wo der langfristige Wert liegt.",
    faqLead: "Alles, was Käufer uns über Immobilien auf Zypern fragen, an einem Ort.",
    readCaseStudy: "Fallstudie lesen", exploreAllCases: "Alle Fälle ansehen",
  },
  pl: {
    heroLine1: "Eksperci ", heroAccent: "nieruchomości", heroLine2: " na Cyprze",
    getConsultation: "Umów konsultację",
    viewAllProjects: "Zobacz wszystkie projekty",
    citiesLead:
      "Od tętniących życiem marin po ciche stare miasta – każde cypryjskie miasto oferuje inny sposób na życie nad morzem. Niezależnie od tego, czy pociąga Cię kosmopolityczna energia Limassol, historyczny urok Pafos, czy spokojne nadmorskie tempo Larnaki – Cypr nagradza każdy styl życia światowej klasy infrastrukturą, stabilnym systemem prawnym i ponad 340 słonecznymi dniami w roku.",
    newLead2: "Nowe ", newAccent: "oferty",
    newLead: "Najnowsze pozycje w naszej kolekcji nieruchomości.",
    showAllProjects: "Pokaż wszystkie projekty",
    priceFrom: "od", priceOnRequest: "Cena na życzenie", onRequest: "Na życzenie", sold: "Sprzedane",
    contentTitle: "Twój przewodnik po nieruchomościach na Cyprze",
    contentLead:
      "Co warto wiedzieć przed zakupem – regiony, typy nieruchomości, proces dla klientów międzynarodowych i gdzie leży długoterminowa wartość.",
    faqLead: "Wszystko, o co kupujący pytają nas o nieruchomości na Cyprze, w jednym miejscu.",
    readCaseStudy: "Przeczytaj case study", exploreAllCases: "Zobacz wszystkie przypadki",
  },
  ru: {
    heroLine1: "Эксперты по ", heroAccent: "недвижимости", heroLine2: " на Кипре",
    getConsultation: "Получить консультацию",
    viewAllProjects: "Все проекты",
    citiesLead:
      "От оживлённых марин до тихих старых городов — каждый город Кипра предлагает свой способ жить у моря. Космополитичная энергия Лимассола, историческое очарование Пафоса или спокойный прибрежный ритм Ларнаки — Кипр вознаграждает любой образ жизни первоклассной инфраструктурой, стабильной правовой системой и более чем 340 солнечными днями в году.",
    newLead2: "Новые ", newAccent: "объекты",
    newLead: "Самые свежие пополнения нашей коллекции недвижимости.",
    showAllProjects: "Показать все проекты",
    priceFrom: "от", priceOnRequest: "Цена по запросу", onRequest: "По запросу", sold: "Продано",
    contentTitle: "Ваш гид по недвижимости на Кипре",
    contentLead:
      "Что нужно знать перед покупкой — регионы, типы недвижимости, процесс для иностранных клиентов и где заключается долгосрочная ценность.",
    faqLead: "Всё, что покупатели спрашивают нас о недвижимости на Кипре, в одном месте.",
    readCaseStudy: "Читать кейс", exploreAllCases: "Все кейсы",
  },
};

export const homeStrings = (lang: string): HomeStrings => HOME_STRINGS[lang] ?? EN;

// Case-study category labels (reused from the production FeaturedCaseStudies).
export const CASE_CATEGORY_LABELS: Record<string, Record<string, string>> = {
  en: { "luxury-villa": "Luxury Villa Purchase", apartment: "Apartment Purchase", investment: "Investment Property", relocation: "Relocation to Cyprus", "permanent-residency": "Permanent Residency", "new-development": "New Development" },
  de: { "luxury-villa": "Kauf einer Luxusvilla", apartment: "Wohnungskauf", investment: "Investmentimmobilie", relocation: "Umzug nach Zypern", "permanent-residency": "Daueraufenthalt", "new-development": "Neubauimmobilie" },
  pl: { "luxury-villa": "Zakup luksusowej willi", apartment: "Zakup apartamentu", investment: "Nieruchomość inwestycyjna", relocation: "Przeprowadzka na Cypr", "permanent-residency": "Stały pobyt", "new-development": "Nowa inwestycja" },
  ru: { "luxury-villa": "Покупка роскошной виллы", apartment: "Покупка квартиры", investment: "Инвестиционная недвижимость", relocation: "Переезд на Кипр", "permanent-residency": "Постоянное проживание", "new-development": "Новостройка" },
};
