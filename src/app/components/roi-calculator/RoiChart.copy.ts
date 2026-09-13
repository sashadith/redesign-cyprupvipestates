// Sibling copy module for RoiChart.tsx — lifted from `lang === "pl" ? … : …`
// ternary chains (Hebrew Localization Phase 4, Task 3). `numberLocale` is the
// BCP-47 tag fed to Intl.NumberFormat here — kept exactly as it was (the
// English case stays "en-US", not the site-wide BCP47.en of "en-GB").
import type { Locale } from "@/lib/locale";
import { isLocale } from "@/lib/locale";

export const ROI_CHART_EN = {
  numberLocale: "en-US",
  chartTitleBuyHold: "Projected property value and rental income",
  chartTitleBuySell: "Projected property value and resale profit",
  xAxis: "Years",
  yAxis: "Amount (EUR)",
  year: "Year",
  estimatedValue: "Property value",
  cumulativeNetRent: "Cumulative rental income",
  cumulativeProfit: "Total profit",
};

export const ROI_CHART_COPY: Record<Locale, typeof ROI_CHART_EN> = {
  en: ROI_CHART_EN,
  de: {
    numberLocale: "de-DE",
    chartTitleBuyHold: "Prognose von Immobilienwert und Mieteinnahmen",
    chartTitleBuySell: "Prognose von Immobilienwert und Wiederverkaufsgewinn",
    xAxis: "Jahre",
    yAxis: "Betrag (EUR)",
    year: "Jahr",
    estimatedValue: "Immobilienwert",
    cumulativeNetRent: "Kumulierte Mieteinnahmen",
    cumulativeProfit: "Gesamtgewinn",
  },
  pl: {
    numberLocale: "pl-PL",
    chartTitleBuyHold: "Prognoza wartości inwestycji i dochodu z najmu",
    chartTitleBuySell: "Prognoza wartości inwestycji i zysku ze sprzedaży",
    xAxis: "Lata",
    yAxis: "Kwota (EUR)",
    year: "Rok",
    estimatedValue: "Wartość nieruchomości",
    cumulativeNetRent: "Skumulowany dochód z najmu",
    cumulativeProfit: "Łączny zysk",
  },
  ru: {
    numberLocale: "ru-RU",
    chartTitleBuyHold: "Прогноз стоимости объекта и дохода от аренды",
    chartTitleBuySell: "Прогноз стоимости объекта и прибыли от перепродажи",
    xAxis: "Годы",
    yAxis: "Сумма (EUR)",
    year: "Год",
    estimatedValue: "Стоимость недвижимости",
    cumulativeNetRent: "Накопленный доход от аренды",
    cumulativeProfit: "Общая прибыль",
  },
  he: ROI_CHART_EN, // TODO(he)
};

export const roiChartCopy = (lang: string) => ROI_CHART_COPY[isLocale(lang) ? lang : "en"];
