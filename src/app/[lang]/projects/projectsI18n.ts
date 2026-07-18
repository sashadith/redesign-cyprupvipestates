// UI strings for the Projects listing (map-centric explorer, migrated from the
// /preview-projects staging design). The staging preview hardcoded these in
// English; here they are localized for en/de/pl/ru. City / property-type / sort
// option LABELS reuse the wording already shipped in the old production
// StyledProjectFilters so nothing regresses linguistically. The filter VALUES
// (Paphos, Apartment, priceAsc, …) are unchanged — they still drive the same
// production query/search/sort logic.

export type Opt = { value: string; label: string };

export type ProjectsStrings = {
  numLocale: string; // Intl locale used for the €-price grouping + counts

  // ---- filter bar ----
  cityLabel: string;
  cityPlaceholder: string;
  cities: Opt[]; // value must match the stored keyFeatures.city

  typeLabel: string;
  typePlaceholder: string;
  types: Opt[];

  bedsLabel: string;
  bedsPlaceholder: string;
  beds: Opt[]; // "1+".."5+"

  priceMin: string; // input placeholder
  priceMax: string;
  priceMinAria: string;
  priceMaxAria: string;

  searchPlaceholder: string;
  searchAria: string;

  mapBtn: string;
  reset: string;

  moreFilters: string;
  hideFilters: string;

  // ---- results head ----
  sortAria: string;
  sorts: Opt[];
  projectOne: string;
  projectMany: string;
  inThisMapArea: string; // after the count in the results header
  inThisArea: string; // after the count in the overlay bar
  empty: string;

  // ---- project card ----
  badgeNew: string;
  badgeFeatured: string;
  badgeSoldOut: string;
  bedUnit: string; // "{n} bed"
  areaUnit: string; // "{n} m²"
  energyPrefix: string; // "Energy {grade}"
  priceFrom: string; // "from "
  priceOnRequest: string;
  minShort: string; // distance minutes suffix

  // distance labels (card: Beach/School/Golf/Airport; popup adds the rest)
  distBeach: string;
  distSchool: string;
  distGolf: string;
  distAirport: string;
  distCenter: string;
  distHospital: string;
  distShops: string;
  distDining: string;

  // ---- map teaser tile ----
  exploreOnMap: string;
  mapTileSub: (n: string) => string; // "{n} projects · live filters & nearby places"

  // ---- map overlay ----
  mapFab: string;
  close: string;

  // ---- map: POI control ----
  nearby: string;
  zoomToLoad: string;
  loading: string; // POI "Loading…"
  loadingMap: string; // dynamic-import fallback (full map)
  mapShort: string; // dynamic-import fallback (mini map)
  poi: {
    school_private: string;
    school_public: string;
    clinic: string;
    supermarket: string;
    pharmacy: string;
    beach: string;
    restaurant: string;
    golf: string;
    airport: string;
  };
};

const EN: ProjectsStrings = {
  numLocale: "en-US",
  cityLabel: "City",
  cityPlaceholder: "Any location",
  cities: [
    { value: "Paphos", label: "Paphos" },
    { value: "Limassol", label: "Limassol" },
    { value: "Larnaca", label: "Larnaca" },
  ],
  typeLabel: "Property type",
  typePlaceholder: "Any type",
  types: [
    { value: "Apartment", label: "Apartment" },
    { value: "Villa", label: "Villa" },
    { value: "Townhouse", label: "Townhouse" },
  ],
  bedsLabel: "Bedrooms",
  bedsPlaceholder: "Any beds",
  beds: [
    { value: "1", label: "1+" },
    { value: "2", label: "2+" },
    { value: "3", label: "3+" },
    { value: "4", label: "4+" },
    { value: "5", label: "5+" },
  ],
  priceMin: "Min €",
  priceMax: "Max €",
  priceMinAria: "Min price",
  priceMaxAria: "Max price",
  searchPlaceholder: "Search projects…",
  searchAria: "Search projects",
  mapBtn: "Map",
  reset: "Reset",
  moreFilters: "More filters",
  hideFilters: "Hide filters",
  sortAria: "Sort by",
  sorts: [
    { value: "recommended", label: "Recommended" },
    { value: "priceAsc", label: "Price · low to high" },
    { value: "priceDesc", label: "Price · high to low" },
    { value: "completionSoon", label: "Completion · soonest" },
  ],
  projectOne: "project",
  projectMany: "projects",
  inThisMapArea: "in this map area",
  inThisArea: "in this area",
  empty: "No projects match your search. Try widening the filters.",
  badgeNew: "New",
  badgeFeatured: "Featured",
  badgeSoldOut: "Sold out",
  bedUnit: "bed",
  areaUnit: "m²",
  energyPrefix: "Energy",
  priceFrom: "from ",
  priceOnRequest: "Price on request",
  minShort: "min",
  distBeach: "Beach",
  distSchool: "School",
  distGolf: "Golf",
  distAirport: "Airport",
  distCenter: "Center",
  distHospital: "Hospital",
  distShops: "Shops",
  distDining: "Dining",
  exploreOnMap: "Explore on the map",
  mapTileSub: (n) => `${n} projects · live filters & nearby places`,
  mapFab: "Map",
  close: "Close",
  nearby: "Nearby",
  zoomToLoad: "Zoom in to load places",
  loading: "Loading…",
  loadingMap: "Loading map…",
  mapShort: "Map…",
  poi: {
    school_private: "Private School",
    school_public: "Public School",
    clinic: "Clinics",
    supermarket: "Supermarkets",
    pharmacy: "Pharmacies",
    beach: "Beaches",
    restaurant: "Restaurants",
    golf: "Golf",
    airport: "Airport",
  },
};

const DE: ProjectsStrings = {
  numLocale: "en-US",
  cityLabel: "Stadt",
  cityPlaceholder: "Beliebiger Ort",
  cities: [
    { value: "Paphos", label: "Paphos" },
    { value: "Limassol", label: "Limassol" },
    { value: "Larnaca", label: "Larnaka" },
  ],
  typeLabel: "Immobilientyp",
  typePlaceholder: "Beliebiger Typ",
  types: [
    { value: "Apartment", label: "Apartment" },
    { value: "Villa", label: "Villa" },
    { value: "Townhouse", label: "Reihenhaus" },
  ],
  bedsLabel: "Schlafzimmer",
  bedsPlaceholder: "Beliebig",
  beds: [
    { value: "1", label: "1+" },
    { value: "2", label: "2+" },
    { value: "3", label: "3+" },
    { value: "4", label: "4+" },
    { value: "5", label: "5+" },
  ],
  priceMin: "Min €",
  priceMax: "Max €",
  priceMinAria: "Mindestpreis",
  priceMaxAria: "Höchstpreis",
  searchPlaceholder: "Projekte suchen…",
  searchAria: "Projekte suchen",
  mapBtn: "Karte",
  reset: "Zurücksetzen",
  moreFilters: "Weitere Filter",
  hideFilters: "Filter ausblenden",
  sortAria: "Sortieren nach",
  sorts: [
    { value: "recommended", label: "Empfohlen" },
    { value: "priceAsc", label: "Preis · aufsteigend" },
    { value: "priceDesc", label: "Preis · absteigend" },
    { value: "completionSoon", label: "Fertigstellung · am frühesten" },
  ],
  projectOne: "Projekt",
  projectMany: "Projekte",
  inThisMapArea: "in diesem Kartenbereich",
  inThisArea: "in diesem Bereich",
  empty: "Keine Projekte entsprechen Ihrer Suche. Erweitern Sie die Filter.",
  badgeNew: "Neu",
  badgeFeatured: "Hervorgehoben",
  badgeSoldOut: "Ausverkauft",
  bedUnit: "Schlafz.",
  areaUnit: "m²",
  energyPrefix: "Energie",
  priceFrom: "ab ",
  priceOnRequest: "Preis auf Anfrage",
  minShort: "Min",
  distBeach: "Strand",
  distSchool: "Schule",
  distGolf: "Golf",
  distAirport: "Flughafen",
  distCenter: "Zentrum",
  distHospital: "Klinik",
  distShops: "Geschäfte",
  distDining: "Restaurants",
  exploreOnMap: "Auf der Karte erkunden",
  mapTileSub: (n) => `${n} Projekte · Live-Filter & Orte in der Nähe`,
  mapFab: "Karte",
  close: "Schließen",
  nearby: "In der Nähe",
  zoomToLoad: "Heranzoomen, um Orte zu laden",
  loading: "Lädt…",
  loadingMap: "Karte wird geladen…",
  mapShort: "Karte…",
  poi: {
    school_private: "Privatschule",
    school_public: "Öffentliche Schule",
    clinic: "Kliniken",
    supermarket: "Supermärkte",
    pharmacy: "Apotheken",
    beach: "Strände",
    restaurant: "Restaurants",
    golf: "Golf",
    airport: "Flughafen",
  },
};

const PL: ProjectsStrings = {
  numLocale: "en-US",
  cityLabel: "Miasto",
  cityPlaceholder: "Dowolna lokalizacja",
  cities: [
    { value: "Paphos", label: "Pafos" },
    { value: "Limassol", label: "Limasol" },
    { value: "Larnaca", label: "Larnaka" },
  ],
  typeLabel: "Typ nieruchomości",
  typePlaceholder: "Dowolny typ",
  types: [
    { value: "Apartment", label: "Mieszkanie" },
    { value: "Villa", label: "Willa" },
    { value: "Townhouse", label: "Dom szeregowy" },
  ],
  bedsLabel: "Sypialnie",
  bedsPlaceholder: "Dowolnie",
  beds: [
    { value: "1", label: "1+" },
    { value: "2", label: "2+" },
    { value: "3", label: "3+" },
    { value: "4", label: "4+" },
    { value: "5", label: "5+" },
  ],
  priceMin: "Min €",
  priceMax: "Max €",
  priceMinAria: "Cena min.",
  priceMaxAria: "Cena maks.",
  searchPlaceholder: "Szukaj projektów…",
  searchAria: "Szukaj projektów",
  mapBtn: "Mapa",
  reset: "Resetuj",
  moreFilters: "Więcej filtrów",
  hideFilters: "Ukryj filtry",
  sortAria: "Sortuj według",
  sorts: [
    { value: "recommended", label: "Polecane" },
    { value: "priceAsc", label: "Cena · rosnąco" },
    { value: "priceDesc", label: "Cena · malejąco" },
    { value: "completionSoon", label: "Oddanie · najszybciej" },
  ],
  projectOne: "projekt",
  projectMany: "projekty",
  inThisMapArea: "w tym obszarze mapy",
  inThisArea: "w tym obszarze",
  empty: "Brak projektów pasujących do wyszukiwania. Rozszerz filtry.",
  badgeNew: "Nowość",
  badgeFeatured: "Wyróżnione",
  badgeSoldOut: "Wyprzedane",
  bedUnit: "syp.",
  areaUnit: "m²",
  energyPrefix: "Energia",
  priceFrom: "od ",
  priceOnRequest: "Cena na zapytanie",
  minShort: "min",
  distBeach: "Plaża",
  distSchool: "Szkoła",
  distGolf: "Golf",
  distAirport: "Lotnisko",
  distCenter: "Centrum",
  distHospital: "Szpital",
  distShops: "Sklepy",
  distDining: "Restauracje",
  exploreOnMap: "Odkryj na mapie",
  mapTileSub: (n) => `${n} projektów · filtry na żywo i pobliskie miejsca`,
  mapFab: "Mapa",
  close: "Zamknij",
  nearby: "W pobliżu",
  zoomToLoad: "Przybliż, aby wczytać miejsca",
  loading: "Ładowanie…",
  loadingMap: "Ładowanie mapy…",
  mapShort: "Mapa…",
  poi: {
    school_private: "Szkoła prywatna",
    school_public: "Szkoła publiczna",
    clinic: "Kliniki",
    supermarket: "Supermarkety",
    pharmacy: "Apteki",
    beach: "Plaże",
    restaurant: "Restauracje",
    golf: "Golf",
    airport: "Lotnisko",
  },
};

const RU: ProjectsStrings = {
  numLocale: "en-US",
  cityLabel: "Город",
  cityPlaceholder: "Любая локация",
  cities: [
    { value: "Paphos", label: "Пафос" },
    { value: "Limassol", label: "Лимассол" },
    { value: "Larnaca", label: "Ларнака" },
  ],
  typeLabel: "Тип недвижимости",
  typePlaceholder: "Любой тип",
  types: [
    { value: "Apartment", label: "Квартира" },
    { value: "Villa", label: "Вилла" },
    { value: "Townhouse", label: "Таунхаус" },
  ],
  bedsLabel: "Спальни",
  bedsPlaceholder: "Любое",
  beds: [
    { value: "1", label: "1+" },
    { value: "2", label: "2+" },
    { value: "3", label: "3+" },
    { value: "4", label: "4+" },
    { value: "5", label: "5+" },
  ],
  priceMin: "Мин €",
  priceMax: "Макс €",
  priceMinAria: "Мин. цена",
  priceMaxAria: "Макс. цена",
  searchPlaceholder: "Поиск проектов…",
  searchAria: "Поиск проектов",
  mapBtn: "Карта",
  reset: "Сбросить",
  moreFilters: "Ещё фильтры",
  hideFilters: "Скрыть фильтры",
  sortAria: "Сортировка",
  sorts: [
    { value: "recommended", label: "Рекомендуемые" },
    { value: "priceAsc", label: "Цена · по возрастанию" },
    { value: "priceDesc", label: "Цена · по убыванию" },
    { value: "completionSoon", label: "Сдача · ближайшая" },
  ],
  projectOne: "проект",
  projectMany: "проектов",
  inThisMapArea: "в этой области карты",
  inThisArea: "в этой области",
  empty: "Нет проектов по вашему запросу. Расширьте фильтры.",
  badgeNew: "Новинка",
  badgeFeatured: "Избранное",
  badgeSoldOut: "Продано",
  bedUnit: "спал.",
  areaUnit: "m²",
  energyPrefix: "Энергия",
  priceFrom: "от ",
  priceOnRequest: "Цена по запросу",
  minShort: "мин",
  distBeach: "Пляж",
  distSchool: "Школа",
  distGolf: "Гольф",
  distAirport: "Аэропорт",
  distCenter: "Центр",
  distHospital: "Больница",
  distShops: "Магазины",
  distDining: "Рестораны",
  exploreOnMap: "Смотреть на карте",
  mapTileSub: (n) => `${n} проектов · живые фильтры и места рядом`,
  mapFab: "Карта",
  close: "Закрыть",
  nearby: "Рядом",
  zoomToLoad: "Приблизьте, чтобы загрузить места",
  loading: "Загрузка…",
  loadingMap: "Загрузка карты…",
  mapShort: "Карта…",
  poi: {
    school_private: "Частная школа",
    school_public: "Гос. школа",
    clinic: "Клиники",
    supermarket: "Супермаркеты",
    pharmacy: "Аптеки",
    beach: "Пляжи",
    restaurant: "Рестораны",
    golf: "Гольф",
    airport: "Аэропорт",
  },
};

export const PROJECTS_STRINGS: Record<string, ProjectsStrings> = { en: EN, de: DE, pl: PL, ru: RU };

export const projectsStrings = (lang: string): ProjectsStrings => PROJECTS_STRINGS[lang] ?? EN;
