// UI strings for the Development detail page (/projects/[slug] when it's a
// published Development) and its component tree (HeroMedia, Lightbox, PlanGrid,
// UnitsView). Reuses wording already shipped elsewhere in the app rather than
// inventing a second translation for the same concept:
//   - priceFrom/priceOnRequest/badgeSoldOut/nearby/poi/* come from
//     src/app/[lang]/projects/projectsI18n.ts (the /projects listing + map).
//   - distance category labels come from DistancesStrip's own COPY.
// Only strings genuinely unique to this page's own chrome live here.
import { projectsStrings } from "@/app/[lang]/projects/projectsI18n";

export type Lang = "en" | "de" | "pl" | "ru";
const LANGS: Lang[] = ["en", "de", "pl", "ru"];
export const asDevLang = (l: string): Lang => (LANGS.includes(l as Lang) ? (l as Lang) : "en");

export type DevelopmentStrings = {
  // ---- hero ----
  galleryLabel: (n: number) => string;
  openGallery: string;
  heroFrom: string; // caption under the price figure
  heroType: string; // caption under the type value
  heroAvailable: string; // caption under the available-count value
  vatSuffix: string; // "+VAT" / "+MwSt." / "+VAT" / "+НДС"

  // ---- section headings ----
  aboutHeading: string;
  amenitiesHeading: string;
  plansHeading: string;
  distancesHeading: string;
  unitsHeading: string;
  unitsSubAvailable: (n: number) => string; // "{n} available"
  unitsSubSold: (n: number) => string; // " · {n} sold"

  // ---- facts panel labels ----
  factLocation: string;
  factPropertyType: string;
  factUnits: string;
  factUnitsAvailable: (n: number) => string; // "({n} available)"
  factStatus: string;
  factConstructionStage: string; // separate from factStatus — construction phase, never hidden by sold-out
  factPlot: string;
  factBuildArea: string;
  factCompletion: string;
  factEnergyRating: string;
  priceOnRequest: string;
  heroFromSoldOut: string; // replaces heroFrom's caption once sold out — a past price, not a live offer

  // ---- sold-out banner + off-market CTA (2026-07-31) ----
  soldOutBannerHeadline: string;
  soldOutBannerBody: string;
  offMarketCtaHeadline: string;
  offMarketCtaBody: string;
  unitsHeadingSoldOut: string; // replaces unitsHeading once sold out

  // ---- alternatives block ----
  alternativesHeading: string; // dezent placement on an available project's page

  // ---- neighbourhood tags ----
  tagDistrict: string;
  tagLocality: string;
  tagArea: string;

  // ---- availability / stage labels ----
  soldOut: string;
  stage: Record<"off-plan" | "under construction" | "completed" | "available" | "key-ready" | "sold", string>;
  unitStatus: Record<"available" | "sold" | "reserved", string>;

  // ---- units view ----
  viewCards: string;
  viewTable: string;
  unitDisplayAria: string;
  colUnit: string; colType: string; colFloor: string; colBeds: string; colBuilt: string; colPlot: string; colPrice: string; colStatus: string;
  factBeds: string; factBaths: string; factBuilt: string; factVeranda: string; factCovered: string; factFloor: string;
  unitM2: string; // area unit symbol — Cyrillic "м²" for ru, Latin "m²" elsewhere; never mix within a locale
  viewTour: string;
  watch: string;
  showLess: string;
  allDetails: string;
  showMoreUnits: (n: number) => string;
  factsheetPdf: string;
  soon: string;
  enlargePhotos: string;
  enlargePhotoN: (n: number) => string;
  showAllPhotos: (n: number) => string;
  enlargeImageN: (n: number) => string;
  visualisationN: (n: number) => string;

  // ---- lightbox ----
  close: string;
  previous: string;
  next: string;
  imageN: (n: number) => string;
};

// Polish 3-way plural: 1 / 2-4 (not 12-14) / else
const plCount = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10, mod100 = n % 100;
  if (n === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
};
// Russian 3-way plural: 1 (not 11) / 2-4 (not 12-14) / else
const ruCount = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
};

const EN: DevelopmentStrings = {
  galleryLabel: (n) => `View ${n} ${n === 1 ? "photo" : "photos"}`,
  openGallery: "Open gallery",
  heroFrom: "from",
  heroType: "type",
  heroAvailable: "available",
  vatSuffix: "+VAT",
  aboutHeading: "About this development",
  amenitiesHeading: "Features & amenities",
  plansHeading: "Development Plans",
  distancesHeading: "Distances",
  unitsHeading: "Available units",
  unitsSubAvailable: (n) => `${n} available`,
  unitsSubSold: (n) => ` · ${n} sold`,
  factLocation: "Location",
  factPropertyType: "Property type",
  factUnits: "Units",
  factUnitsAvailable: (n) => `(${n} available)`,
  factStatus: "Status",
  factConstructionStage: "Construction stage",
  factPlot: "Plot",
  factBuildArea: "Build area",
  factCompletion: "Completion",
  factEnergyRating: "Energy rating",
  priceOnRequest: "Price on request",
  heroFromSoldOut: "sold from",
  soldOutBannerHeadline: "Sold out — take it as confirmation of your taste.",
  soldOutBannerBody: "Homes like these move quickly, and fortunately Cyprus isn't done building beautiful ones. These projects come closest to what brought you here — and are still open:",
  offMarketCtaHeadline: "Get there before the listing does.",
  offMarketCtaBody: "Describe your ideal home in one message — we often know about units before they go public, and when we do, we'll think of you first.",
  unitsHeadingSoldOut: "The Properties",
  alternativesHeading: "Similar projects",
  tagDistrict: "District",
  tagLocality: "Locality",
  tagArea: "Area",
  soldOut: "Sold out",
  stage: { "off-plan": "Off-plan", "under construction": "Under construction", completed: "Completed", available: "Available", "key-ready": "Key-Ready", sold: "Sold" },
  unitStatus: { available: "Available", sold: "Sold", reserved: "Reserved" },
  viewCards: "Cards",
  viewTable: "Table",
  unitDisplayAria: "Unit display",
  colUnit: "Unit", colType: "Type", colFloor: "Floor", colBeds: "Beds", colBuilt: "Built", colPlot: "Plot", colPrice: "Price", colStatus: "Status",
  factBeds: "Beds", factBaths: "Baths", factBuilt: "Built", factVeranda: "Veranda", factCovered: "Covered", factFloor: "Floor",
  unitM2: "m²",
  viewTour: "View tour ↗",
  watch: "Watch ↗",
  showLess: "Show less",
  allDetails: "All details",
  showMoreUnits: (n) => `Show ${n} more ${n === 1 ? "unit" : "units"}`,
  factsheetPdf: "Factsheet PDF",
  soon: "soon",
  enlargePhotos: "Enlarge photos",
  enlargePhotoN: (n) => `Enlarge photo ${n}`,
  showAllPhotos: (n) => `Show all ${n} photos`,
  enlargeImageN: (n) => `Enlarge image ${n}`,
  visualisationN: (n) => `Visualisation ${n}`,
  close: "Close",
  previous: "Previous",
  next: "Next",
  imageN: (n) => `Image ${n}`,
};

const DE: DevelopmentStrings = {
  galleryLabel: (n) => `${n} ${n === 1 ? "Foto" : "Fotos"} ansehen`,
  openGallery: "Galerie öffnen",
  heroFrom: "ab",
  heroType: "Typ",
  heroAvailable: "verfügbar",
  vatSuffix: "+MwSt.",
  aboutHeading: "Über dieses Projekt",
  amenitiesHeading: "Ausstattung & Annehmlichkeiten",
  plansHeading: "Baupläne",
  distancesHeading: "Entfernungen",
  unitsHeading: "Verfügbare Einheiten",
  unitsSubAvailable: (n) => `${n} verfügbar`,
  unitsSubSold: (n) => ` · ${n} verkauft`,
  factLocation: "Standort",
  factPropertyType: "Immobilientyp",
  factUnits: "Einheiten",
  factUnitsAvailable: (n) => `(${n} verfügbar)`,
  factStatus: "Status",
  factConstructionStage: "Bauphase",
  factPlot: "Grundstück",
  factBuildArea: "Wohnfläche",
  factCompletion: "Fertigstellung",
  factEnergyRating: "Energieeffizienz",
  priceOnRequest: "Preis auf Anfrage",
  heroFromSoldOut: "verkauft ab",
  soldOutBannerHeadline: "Ausverkauft — nehmen Sie es als Bestätigung Ihres Geschmacks.",
  soldOutBannerBody: "Solche Objekte bleiben nicht lange, und zum Glück ist Zypern mit dem Bauen schöner Projekte noch nicht fertig. Diese kommen dem, was Sie hierhergeführt hat, am nächsten — und sind noch zu haben:",
  offMarketCtaHeadline: "Seien Sie schneller als das Inserat.",
  offMarketCtaBody: "Beschreiben Sie uns Ihr Wunschobjekt in einer Nachricht — wir wissen oft von Einheiten, bevor sie öffentlich werden, und denken dann zuerst an Sie.",
  unitsHeadingSoldOut: "Die Objekte",
  alternativesHeading: "Ähnliche Projekte",
  tagDistrict: "Bezirk",
  tagLocality: "Ort",
  tagArea: "Gebiet",
  soldOut: "Ausverkauft",
  stage: { "off-plan": "Off-Plan", "under construction": "Im Bau", completed: "Fertiggestellt", available: "Verfügbar", "key-ready": "Bezugsfertig", sold: "Verkauft" },
  unitStatus: { available: "Verfügbar", sold: "Verkauft", reserved: "Reserviert" },
  viewCards: "Karten",
  viewTable: "Tabelle",
  unitDisplayAria: "Einheiten-Ansicht",
  colUnit: "Einheit", colType: "Typ", colFloor: "Etage", colBeds: "Schlafz.", colBuilt: "Wohnfl.", colPlot: "Grundst.", colPrice: "Preis", colStatus: "Status",
  factBeds: "Schlafz.", factBaths: "Bäder", factBuilt: "Wohnfl.", factVeranda: "Veranda", factCovered: "Gesamtfl.", factFloor: "Etage",
  unitM2: "m²",
  viewTour: "Tour ansehen ↗",
  watch: "Ansehen ↗",
  showLess: "Weniger anzeigen",
  allDetails: "Alle Details",
  showMoreUnits: (n) => `${n} weitere ${n === 1 ? "Einheit" : "Einheiten"} anzeigen`,
  factsheetPdf: "Factsheet PDF",
  soon: "bald",
  enlargePhotos: "Fotos vergrößern",
  enlargePhotoN: (n) => `Foto ${n} vergrößern`,
  showAllPhotos: (n) => `Alle ${n} Fotos anzeigen`,
  enlargeImageN: (n) => `Bild ${n} vergrößern`,
  visualisationN: (n) => `Visualisierung ${n}`,
  close: "Schließen",
  previous: "Zurück",
  next: "Weiter",
  imageN: (n) => `Bild ${n}`,
};

const PL: DevelopmentStrings = {
  galleryLabel: (n) => `Zobacz ${n} ${plCount(n, "zdjęcie", "zdjęcia", "zdjęć")}`,
  openGallery: "Otwórz galerię",
  heroFrom: "od",
  heroType: "typ",
  heroAvailable: "dostępne",
  vatSuffix: "+VAT",
  aboutHeading: "O tej inwestycji",
  amenitiesHeading: "Udogodnienia",
  plansHeading: "Plany inwestycji",
  distancesHeading: "Odległości",
  unitsHeading: "Dostępne lokale",
  unitsSubAvailable: (n) => `${n} dostępnych`,
  unitsSubSold: (n) => ` · ${n} sprzedanych`,
  factLocation: "Lokalizacja",
  factPropertyType: "Typ nieruchomości",
  factUnits: "Lokale",
  factUnitsAvailable: (n) => `(${n} dostępnych)`,
  factStatus: "Status",
  factConstructionStage: "Etap budowy",
  factPlot: "Działka",
  factBuildArea: "Powierzchnia użytkowa",
  factCompletion: "Zakończenie",
  factEnergyRating: "Klasa energetyczna",
  priceOnRequest: "Cena na zapytanie",
  heroFromSoldOut: "sprzedano od",
  soldOutBannerHeadline: "Wyprzedane — potraktuj to jako potwierdzenie swojego gustu.",
  soldOutBannerBody: "Takie rezydencje nie czekają długo, ale na szczęście Cypr nie skończył jeszcze budować pięknych projektów. Te są najbliżej tego, co Cię tu przyciągnęło — i wciąż dostępne:",
  offMarketCtaHeadline: "Bądź szybszy niż ogłoszenie.",
  offMarketCtaBody: "Opisz nam swoją idealną nieruchomość w jednej wiadomości — często wiemy o rezydencjach, zanim staną się publiczne, i wtedy pomyślimy najpierw o Tobie.",
  unitsHeadingSoldOut: "Obiekty",
  alternativesHeading: "Podobne projekty",
  tagDistrict: "Okręg",
  tagLocality: "Miejscowość",
  tagArea: "Obszar",
  soldOut: "Wyprzedane",
  stage: { "off-plan": "W przygotowaniu", "under construction": "W budowie", completed: "Ukończone", available: "Dostępne", "key-ready": "Gotowe do odbioru", sold: "Sprzedane" },
  unitStatus: { available: "Dostępne", sold: "Sprzedane", reserved: "Zarezerwowane" },
  viewCards: "Karty",
  viewTable: "Tabela",
  unitDisplayAria: "Widok lokali",
  colUnit: "Lokal", colType: "Typ", colFloor: "Piętro", colBeds: "Sypialnie", colBuilt: "Pow. użytk.", colPlot: "Działka", colPrice: "Cena", colStatus: "Status",
  factBeds: "Sypialnie", factBaths: "Łazienki", factBuilt: "Pow. użytk.", factVeranda: "Weranda", factCovered: "Łącznie", factFloor: "Piętro",
  unitM2: "m²",
  viewTour: "Zobacz wirtualny spacer ↗",
  watch: "Obejrzyj ↗",
  showLess: "Pokaż mniej",
  allDetails: "Wszystkie szczegóły",
  showMoreUnits: (n) => `Pokaż ${n} więcej ${plCount(n, "lokal", "lokale", "lokali")}`,
  factsheetPdf: "Factsheet PDF",
  soon: "wkrótce",
  enlargePhotos: "Powiększ zdjęcia",
  enlargePhotoN: (n) => `Powiększ zdjęcie ${n}`,
  showAllPhotos: (n) => `Pokaż wszystkie ${n} zdjęć`,
  enlargeImageN: (n) => `Powiększ zdjęcie ${n}`,
  visualisationN: (n) => `Wizualizacja ${n}`,
  close: "Zamknij",
  previous: "Poprzednie",
  next: "Następne",
  imageN: (n) => `Zdjęcie ${n}`,
};

const RU: DevelopmentStrings = {
  // "фото" is indeclinable — same word regardless of count.
  galleryLabel: (n) => `Смотреть ${n} фото`,
  openGallery: "Открыть галерею",
  heroFrom: "от",
  heroType: "тип",
  heroAvailable: "доступно",
  vatSuffix: "+НДС",
  aboutHeading: "Об этом проекте",
  amenitiesHeading: "Особенности и удобства",
  plansHeading: "Планы застройки",
  distancesHeading: "Расстояния",
  unitsHeading: "Доступные объекты",
  unitsSubAvailable: (n) => `${n} доступно`,
  unitsSubSold: (n) => ` · ${n} продано`,
  factLocation: "Расположение",
  factPropertyType: "Тип недвижимости",
  factUnits: "Объекты",
  factUnitsAvailable: (n) => `(${n} доступно)`,
  factStatus: "Статус",
  factConstructionStage: "Стадия строительства",
  factPlot: "Участок",
  factBuildArea: "Жилая площадь",
  factCompletion: "Завершение",
  factEnergyRating: "Энергокласс",
  priceOnRequest: "Цена по запросу",
  heroFromSoldOut: "продано от",
  soldOutBannerHeadline: "Продано — считайте это подтверждением вашего вкуса.",
  soldOutBannerBody: "Такие резиденции не задерживаются, но, к счастью, Кипр ещё не закончил строить красивое. Эти проекты ближе всего к тому, что привело вас сюда — и они ещё доступны:",
  offMarketCtaHeadline: "Опередите объявление.",
  offMarketCtaBody: "Опишите нам идеальный объект в одном сообщении — мы часто узнаём о резиденциях до их публикации, и тогда в первую очередь вспомним о вас.",
  unitsHeadingSoldOut: "Объекты",
  alternativesHeading: "Похожие проекты",
  tagDistrict: "Округ",
  tagLocality: "Населённый пункт",
  tagArea: "Район",
  soldOut: "Продано",
  stage: { "off-plan": "Off-plan", "under construction": "Строится", completed: "Завершено", available: "Доступно", "key-ready": "Сдан", sold: "Продано" },
  unitStatus: { available: "Доступно", sold: "Продано", reserved: "Забронировано" },
  viewCards: "Карточки",
  viewTable: "Таблица",
  unitDisplayAria: "Вид объектов",
  colUnit: "Объект", colType: "Тип", colFloor: "Этаж", colBeds: "Спальни", colBuilt: "Площадь", colPlot: "Участок", colPrice: "Цена", colStatus: "Статус",
  factBeds: "Спальни", factBaths: "Ванные", factBuilt: "Жилая", factVeranda: "Веранда", factCovered: "Итого", factFloor: "Этаж",
  unitM2: "м²",
  viewTour: "Смотреть тур ↗",
  watch: "Смотреть ↗",
  showLess: "Скрыть",
  allDetails: "Все детали",
  showMoreUnits: (n) => `Показать ещё ${n} ${ruCount(n, "объект", "объекта", "объектов")}`,
  factsheetPdf: "Factsheet PDF",
  soon: "скоро",
  enlargePhotos: "Увеличить фото",
  enlargePhotoN: (n) => `Увеличить фото ${n}`,
  showAllPhotos: (n) => `Показать все ${n} фото`,
  enlargeImageN: (n) => `Увеличить изображение ${n}`,
  visualisationN: (n) => `Визуализация ${n}`,
  close: "Закрыть",
  previous: "Назад",
  next: "Далее",
  imageN: (n) => `Изображение ${n}`,
};

export const DEVELOPMENT_STRINGS: Record<Lang, DevelopmentStrings> = { en: EN, de: DE, pl: PL, ru: RU };

// priceOnRequest/soldOut/heroFrom overlay the /projects listing's own wording
// (projectsI18n.ts) at call time rather than duplicating it in each locale
// block above — one source of truth, so the two surfaces can never drift.
export const developmentCopy = (lang: string): DevelopmentStrings => {
  const base = DEVELOPMENT_STRINGS[asDevLang(lang)];
  const ps = projectsStrings(lang);
  return { ...base, priceOnRequest: ps.priceOnRequest, soldOut: ps.badgeSoldOut, heroFrom: ps.priceFrom.trim() };
};
