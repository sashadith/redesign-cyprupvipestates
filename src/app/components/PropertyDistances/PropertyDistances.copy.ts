// Sibling copy module for PropertyDistances.tsx — lifted from
// `lang === "en" ? … : …` ternary chains (Hebrew Localization Phase 4, Task 3).
// The " min" / " мин" suffix ternary was byte-identical across all eight
// distance categories, so it collapses to one shared `minSuffix` key.
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const PROPERTY_DISTANCES_EN = {
  minSuffix: " min",
  beach: { alt: "Distance from Cyprus villa to the beach", label: "Beach" },
  restaurants: {
    alt: "Distance from Cyprus villa to the restaurants",
    label: "Restaurants",
  },
  shops: { alt: "Distance from Cyprus villa to the shops", label: "Shops" },
  airport: { alt: "Distance from Cyprus villa to the airport", label: "Airport" },
  hospital: { alt: "Distance from Cyprus villa to the hospital", label: "Hospital" },
  school: { alt: "Distance from Cyprus villa to the school", label: "School" },
  cityCenter: {
    alt: "Distance from Cyprus villa to the city center",
    label: "City center",
  },
  golfCourt: {
    alt: "Distance from Cyprus villa to the golf court",
    label: "Golf court",
  },
};

export const PROPERTY_DISTANCES_COPY: Record<Locale, typeof PROPERTY_DISTANCES_EN> = {
  en: PROPERTY_DISTANCES_EN,
  de: {
    minSuffix: " min",
    beach: { alt: "Entfernung von der Zypern Villa zum Strand", label: "Strand" },
    restaurants: {
      alt: "Entfernung von der Zypern Villa zu den Restaurants",
      label: "Restaurants",
    },
    shops: {
      alt: "Entfernung von der Zypern Villa zu den Geschäften",
      label: "Supermarket",
    },
    airport: {
      alt: "Entfernung von der Zypern Villa zum Flughafen",
      label: "Flughafen",
    },
    hospital: {
      alt: "Entfernung von der Zypern Villa zum Krankenhaus",
      label: "Klinik",
    },
    school: { alt: "Entfernung von der Zypern Villa zur Schule", label: "Schule" },
    cityCenter: {
      alt: "Entfernung von der Zypern Villa zum Stadtzentrum",
      label: "Zentrum",
    },
    golfCourt: {
      alt: "Entfernung von der Zypern Villa zum Golfplatz",
      label: "Golfplatz",
    },
  },
  pl: {
    minSuffix: " min",
    beach: { alt: "Odległość od willi na Cyprze do plaży", label: "Plaż" },
    restaurants: {
      alt: "Odległość od willi na Cyprze do restauracji",
      label: "Restauracje",
    },
    shops: { alt: "Odległość od willi na Cyprze do sklepów", label: "Sklepy" },
    airport: { alt: "Odległość od willi na Cyprze do lotniska", label: "Lotnisko" },
    hospital: { alt: "Odległość od willi na Cyprze do szpitala", label: "Szpital" },
    school: { alt: "Odległość od willi na Cyprze do szkoły", label: "Szkoła" },
    cityCenter: {
      alt: "Odległość od willi na Cyprze do centrum miasta",
      label: "Centrum miasta",
    },
    golfCourt: {
      alt: "Odległość od willi na Cyprze do pola golfowego",
      label: "Pole golfowe",
    },
  },
  ru: {
    minSuffix: " мин",
    beach: { alt: "Расстояние от виллы на Кипре до пляжа", label: "Пляж" },
    restaurants: {
      alt: "Расстояние от виллы на Кипре до ресторанов",
      label: "Рестораны",
    },
    shops: { alt: "Расстояние от виллы на Кипре до магазинов", label: "Супермаркет" },
    airport: { alt: "Расстояние от виллы на Кипре до аэропорта", label: "Аэропорт" },
    hospital: { alt: "Расстояние от виллы на Кипре до больницы", label: "Больница" },
    school: { alt: "Расстояние от виллы на Кипре до школы", label: "Школа" },
    cityCenter: {
      alt: "Расстояние от виллы на Кипре до центра города",
      label: " Центр города",
    },
    golfCourt: {
      alt: "Расстояние от виллы на Кипре до поля для гольфа",
      label: "Поле для гольфа",
    },
  },
  he: PROPERTY_DISTANCES_EN, // TODO(he)
};

export const propertyDistancesCopy = (lang: string) =>
  PROPERTY_DISTANCES_COPY[isLocale(lang) ? lang : "en"];
