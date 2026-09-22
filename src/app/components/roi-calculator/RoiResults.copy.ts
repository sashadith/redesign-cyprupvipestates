// Sibling copy module for RoiResults.tsx — lifted from `lang === "pl" ? … : …`
// ternary chains (Hebrew Localization Phase 4, Task 3). `numberLocale` is the
// BCP-47 tag fed to Intl.NumberFormat in both formatCurrency and
// formatPercent (identical ternary, one key).
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const ROI_RESULTS_EN = {
  numberLocale: "en-US",
  highlightLabelBuyHold: "Total net return",
  highlightLabelBuySell: "Net profit from resale",
  horizon: "Horizon",
  purchaseCostWithFees: "Purchase cost (with fees)",
  furnishing: "Furnishing",
  totalEntryCost: "Total entry cost",
  offPlanGain: "Off-plan value growth",
  valueAtCompletion: "Estimated value at completion",
  rentalCashFlow: "Rental cash flow",
  valueInFinalYear: "Estimated value in final year",
  capitalGain: "Capital gain",
  sellingCosts: "Selling costs",
  annualized: "Average annual ROI",
  disclaimer:
    "Important: values are indicative and may vary depending on the property, developer and market conditions.",
  yearsText: "years",
  /** The short "ROI" that used to be hard-coded English inside the highlight
   *  line, in the middle of an otherwise Hebrew block — the one acronym the
   *  glossary explicitly rejected for `he` (Pass B Must fix #10). */
  roiShort: "ROI",
};

export const ROI_RESULTS_COPY: Record<Locale, typeof ROI_RESULTS_EN> = {
  en: ROI_RESULTS_EN,
  de: {
    numberLocale: "de-DE",
    highlightLabelBuyHold: "Gesamte Netto-Rendite",
    highlightLabelBuySell: "Netto-Gewinn aus dem Wiederverkauf",
    horizon: "Horizont",
    purchaseCostWithFees: "Kaufkosten (inkl. Gebühren)",
    furnishing: "Ausstattung",
    totalEntryCost: "Gesamter Einstiegspreis",
    offPlanGain: "Gewinn während der Bauphase",
    valueAtCompletion: "Wert bei Fertigstellung",
    rentalCashFlow: "Miet-Cashflow",
    valueInFinalYear: "Wert im letzten Jahr",
    capitalGain: "Kapitalgewinn",
    sellingCosts: "Verkaufskosten",
    annualized: "Durchschnittlicher ROI pro Jahr",
    disclaimer:
      "Hinweis: Die Werte sind indikativ und können je nach Immobilie, Bauträger und Marktbedingungen abweichen.",
    yearsText: "J.",
    roiShort: "ROI",
  },
  pl: {
    numberLocale: "pl-PL",
    highlightLabelBuyHold: "Łączny zwrot netto",
    highlightLabelBuySell: "Zysk netto ze sprzedaży",
    horizon: "Horyzont",
    purchaseCostWithFees: "Koszt zakupu (z opłatami)",
    furnishing: "Wyposażenie",
    totalEntryCost: "Łączny koszt wejścia",
    offPlanGain: "Zysk na budowie (off-plan)",
    valueAtCompletion: "Wartość przy odbiorze",
    rentalCashFlow: "Cash flow z najmu",
    valueInFinalYear: "Wartość w roku końcowym",
    capitalGain: "Zysk kapitałowy",
    sellingCosts: "Koszty sprzedaży",
    annualized: "Średni ROI rocznie",
    disclaimer:
      "Uwaga: Wartości mają charakter orientacyjny i mogą się różnić w zależności od konkretnej nieruchomości, dewelopera i warunków rynkowych.",
    yearsText: "lat",
    roiShort: "ROI",
  },
  ru: {
    numberLocale: "ru-RU",
    highlightLabelBuyHold: "Общий чистый доход",
    highlightLabelBuySell: "Чистая прибыль от перепродажи",
    horizon: "Горизонт",
    purchaseCostWithFees: "Стоимость покупки (с расходами)",
    furnishing: "Меблировка",
    totalEntryCost: "Общий входной бюджет",
    offPlanGain: "Рост стоимости на этапе строительства",
    valueAtCompletion: "Стоимость к завершению",
    rentalCashFlow: "Денежный поток от аренды",
    valueInFinalYear: "Стоимость в последний год",
    capitalGain: "Капитальный прирост",
    sellingCosts: "Расходы на продажу",
    annualized: "Средний ROI в год",
    disclaimer:
      "Важно: значения являются ориентировочными и могут отличаться в зависимости от объекта, застройщика и рыночных условий.",
    yearsText: "лет",
    roiShort: "ROI",
  },
  // `totalEntryCost`, `annualized` and `sellingCosts` are word-identical with
  // the ROI result e-mail and RoiInputs (styleguide §11.6). `numberLocale`
  // stays "en-US" — Western digits, `€` before the amount (§5).
  he: {
    numberLocale: "en-US",
    highlightLabelBuyHold: "תשואה נטו כוללת",
    highlightLabelBuySell: "רווח נטו ממכירה",
    horizon: "אופק ההשקעה",
    purchaseCostWithFees: "עלות הרכישה (כולל עמלות)",
    furnishing: "ריהוט",
    totalEntryCost: "עלות כניסה כוללת",
    offPlanGain: "עליית ערך בשלב הבנייה",
    valueAtCompletion: "שווי משוער במסירה",
    rentalCashFlow: "תזרים משכירות",
    valueInFinalYear: "שווי משוער בשנה האחרונה",
    capitalGain: "רווח הון",
    sellingCosts: "עלויות מכירה",
    annualized: "תשואה שנתית ממוצעת",
    disclaimer:
      "חשוב לדעת: הנתונים משוערים ועשויים להשתנות בהתאם לנכס, ליזם ולתנאי השוק.",
    yearsText: "שנים",
    roiShort: "תשואה",
  }, // REVIEW(he)
};

export const roiResultsCopy = (lang: string) =>
  ROI_RESULTS_COPY[isLocale(lang) ? lang : "en"];

/**
 * "N years" in Hebrew, which is not count-invariant: one is `שנה אחת`, two is
 * the dual `שנתיים` (never `2 שנים`), three and up take the plural with the
 * numeral. `1 שנים` / `2 שנים` — what `${n} ${yearsText}` produced — are
 * simply ungrammatical (Pass B Must fix #11). Same shape as heBedrooms() in
 * heFeedVocab.ts. `he`-only; every LTR locale keeps `${n} ${yearsText}`.
 */
export function heYears(n: number): string {
  const v = Math.round(n);
  if (v === 1) return "שנה אחת";
  if (v === 2) return "שנתיים";
  return `${v} שנים`;
}
