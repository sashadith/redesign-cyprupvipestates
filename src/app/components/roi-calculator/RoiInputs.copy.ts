// Sibling copy module for RoiInputs.tsx — lifted from `lang === "pl" ? … : …`
// ternary chains (Hebrew Localization Phase 4, Task 3).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const ROI_INPUTS_EN = {
  purchasePrice: "Property price",
  furnishing: "Furnishing cost",
  buildPeriod: "Build period",
  offPlanGrowth: "Annual off-plan growth",
  sellingCosts: "Selling costs",
  rentalSection: "Rental parameters",
  netYieldYearOne: "Net yield (year 1)",
  annualRentGrowth: "Annual rent growth",
  rentalPeriodYears: "Rental period after completion",
  annualAppreciation: "Annual appreciation",
  yearsUnit: "yrs",
};

export const ROI_INPUTS_COPY: Record<Locale, typeof ROI_INPUTS_EN> = {
  en: ROI_INPUTS_EN,
  de: {
    purchasePrice: "Kaufpreis",
    furnishing: "Ausstattungskosten",
    buildPeriod: "Bauzeit",
    offPlanGrowth: "Wachstum während der Bauphase",
    sellingCosts: "Verkaufskosten",
    rentalSection: "Mietparameter",
    netYieldYearOne: "Netto-Rendite (Jahr 1)",
    annualRentGrowth: "Jährliches Mietwachstum",
    rentalPeriodYears: "Mietdauer nach Fertigstellung",
    annualAppreciation: "Jährliche Wertsteigerung",
    yearsUnit: "J.",
  },
  pl: {
    purchasePrice: "Cena nieruchomości",
    furnishing: "Koszt wyposażenia",
    buildPeriod: "Czas budowy",
    offPlanGrowth: "Wzrost w budowie (rocznie)",
    sellingCosts: "Koszty sprzedaży",
    rentalSection: "Parametry najmu",
    netYieldYearOne: "Yield netto (rok 1)",
    annualRentGrowth: "Wzrost czynszu rocznie",
    rentalPeriodYears: "Okres najmu po oddaniu",
    annualAppreciation: "Aprecjacja roczna",
    yearsUnit: "lat",
  },
  ru: {
    purchasePrice: "Цена недвижимости",
    furnishing: "Стоимость меблировки",
    buildPeriod: "Срок строительства",
    offPlanGrowth: "Рост на этапе строительства",
    sellingCosts: "Расходы на продажу",
    rentalSection: "Параметры аренды",
    netYieldYearOne: "Чистая доходность (год 1)",
    annualRentGrowth: "Рост аренды в год",
    rentalPeriodYears: "Срок аренды после сдачи",
    annualAppreciation: "Годовой рост стоимости",
    yearsUnit: "лет",
  },
  he: {
    purchasePrice: "מחיר הנכס",
    furnishing: "עלות ריהוט",
    buildPeriod: "תקופת בנייה",
    offPlanGrowth: "עליית ערך שנתית בשלב הבנייה",
    sellingCosts: "עלויות מכירה",
    rentalSection: "נתוני השכרה",
    netYieldYearOne: "תשואה נטו (שנה 1)",
    annualRentGrowth: "עליית שכירות שנתית",
    rentalPeriodYears: "תקופת השכרה לאחר המסירה",
    annualAppreciation: "עליית ערך שנתית",
    yearsUnit: "שנים",
  }, // REVIEW(he)
};

export const roiInputsCopy = (lang: string) => ROI_INPUTS_COPY[isLocale(lang) ? lang : "en"];
