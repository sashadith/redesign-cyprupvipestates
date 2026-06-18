"use client";

import React from "react";
import styles from "./roi-calculator.module.scss";
import { RoiCalculationResult, RoiStrategy } from "@/lib/roi";
import { ButtonModal } from "../ButtonModal/ButtonModal";

type Props = {
  result: RoiCalculationResult;
  strategy: RoiStrategy;
  lang: string;
  ctaLabel: string;
  inputBuildPeriodYears?: number;
  inputRentalPeriodYears?: number;
};

function formatCurrency(value: number, lang: string) {
  const locale =
    lang === "pl"
      ? "pl-PL"
      : lang === "de"
        ? "de-DE"
        : lang === "ru"
          ? "ru-RU"
          : "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number, lang: string) {
  const locale =
    lang === "pl"
      ? "pl-PL"
      : lang === "de"
        ? "de-DE"
        : lang === "ru"
          ? "ru-RU"
          : "en-US";

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

const RoiResults: React.FC<Props> = ({
  result,
  strategy,
  lang,
  ctaLabel,
  inputBuildPeriodYears,
  inputRentalPeriodYears,
}) => {
  const isBuyHold = strategy === "buyHold";

  const totalYears = isBuyHold
    ? (inputBuildPeriodYears ?? 1) + (inputRentalPeriodYears ?? 10)
    : (inputBuildPeriodYears ?? result.yearlyData.length);

  const t = {
    highlightLabel: isBuyHold
      ? lang === "pl"
        ? "Łączny zwrot netto"
        : lang === "de"
          ? "Gesamte Netto-Rendite"
          : lang === "ru"
            ? "Общий чистый доход"
            : "Total net return"
      : lang === "pl"
        ? "Zysk netto ze sprzedaży"
        : lang === "de"
          ? "Netto-Gewinn aus dem Wiederverkauf"
          : lang === "ru"
            ? "Чистая прибыль от перепродажи"
            : "Net profit from resale",

    horizon:
      lang === "pl"
        ? "Horyzont"
        : lang === "de"
          ? "Horizont"
          : lang === "ru"
            ? "Горизонт"
            : "Horizon",

    purchaseCostWithFees:
      lang === "pl"
        ? "Koszt zakupu (z opłatami)"
        : lang === "de"
          ? "Kaufkosten (inkl. Gebühren)"
          : lang === "ru"
            ? "Стоимость покупки (с расходами)"
            : "Purchase cost (with fees)",

    furnishing:
      lang === "pl"
        ? "Wyposażenie"
        : lang === "de"
          ? "Ausstattung"
          : lang === "ru"
            ? "Меблировка"
            : "Furnishing",

    totalEntryCost:
      lang === "pl"
        ? "Łączny koszt wejścia"
        : lang === "de"
          ? "Gesamter Einstiegspreis"
          : lang === "ru"
            ? "Общий входной бюджет"
            : "Total entry cost",

    offPlanGain:
      lang === "pl"
        ? "Zysk na budowie (off-plan)"
        : lang === "de"
          ? "Gewinn während der Bauphase"
          : lang === "ru"
            ? "Рост стоимости на этапе строительства"
            : "Off-plan value growth",

    valueAtCompletion:
      lang === "pl"
        ? "Wartość przy odbiorze"
        : lang === "de"
          ? "Wert bei Fertigstellung"
          : lang === "ru"
            ? "Стоимость к завершению"
            : "Estimated value at completion",

    rentalCashFlow:
      lang === "pl"
        ? "Cash flow z najmu"
        : lang === "de"
          ? "Miet-Cashflow"
          : lang === "ru"
            ? "Денежный поток от аренды"
            : "Rental cash flow",

    valueInFinalYear:
      lang === "pl"
        ? "Wartość w roku końcowym"
        : lang === "de"
          ? "Wert im letzten Jahr"
          : lang === "ru"
            ? "Стоимость в последний год"
            : "Estimated value in final year",

    capitalGain:
      lang === "pl"
        ? "Zysk kapitałowy"
        : lang === "de"
          ? "Kapitalgewinn"
          : lang === "ru"
            ? "Капитальный прирост"
            : "Capital gain",

    sellingCosts:
      lang === "pl"
        ? "Koszty sprzedaży"
        : lang === "de"
          ? "Verkaufskosten"
          : lang === "ru"
            ? "Расходы на продажу"
            : "Selling costs",

    annualized:
      lang === "pl"
        ? "Średni ROI rocznie"
        : lang === "de"
          ? "Durchschnittlicher ROI pro Jahr"
          : lang === "ru"
            ? "Средний ROI в год"
            : "Average annual ROI",

    disclaimer:
      lang === "pl"
        ? "Uwaga: Wartości mają charakter orientacyjny i mogą się różnić w zależności od konkretnej nieruchomości, dewelopera i warunków rynkowych."
        : lang === "de"
          ? "Hinweis: Die Werte sind indikativ und können je nach Immobilie, Bauträger und Marktbedingungen abweichen."
          : lang === "ru"
            ? "Важно: значения являются ориентировочными и могут отличаться в зависимости от объекта, застройщика и рыночных условий."
            : "Important: values are indicative and may vary depending on the property, developer and market conditions.",
  };

  const yearsText =
    lang === "pl"
      ? "lat"
      : lang === "de"
        ? "J."
        : lang === "ru"
          ? "лет"
          : "years";

  const yearsLabel = `${t.horizon}: ${Math.round(totalYears)} ${yearsText} · ROI: ${formatPercent(result.roiPercent, lang)}%`;

  return (
    <div className={styles.results}>
      <div className={styles.highlight}>
        <div className={styles.highlightLabel}>{t.highlightLabel}</div>
        <div className={styles.highlightValue}>
          {formatCurrency(result.netProfit, lang)}
        </div>
        <div className={styles.highlightMeta}>{yearsLabel}</div>
      </div>

      <div className={styles.rows}>
        <div className={styles.row}>
          <span>{t.purchaseCostWithFees}</span>
          <strong>{formatCurrency(result.purchaseCostWithFees, lang)}</strong>
        </div>

        <div className={styles.row}>
          <span>{t.furnishing}</span>
          <strong>{formatCurrency(result.furnishingCost, lang)}</strong>
        </div>

        <div className={styles.row}>
          <span>{t.totalEntryCost}</span>
          <strong>{formatCurrency(result.totalEntryCost, lang)}</strong>
        </div>

        {isBuyHold ? (
          <>
            <div className={styles.row}>
              <span>{t.offPlanGain}</span>
              <strong>
                {formatCurrency(
                  (result.capitalGain ?? 0) -
                    (result.futureSalePrice -
                      (result.capitalGain ?? 0) -
                      result.futureSalePrice /
                        Math.pow(1 + 0.05, inputRentalPeriodYears ?? 10)),
                  lang,
                )}
              </strong>
            </div>

            <div className={styles.row}>
              <span>{t.valueAtCompletion}</span>
              <strong>
                {formatCurrency(
                  result.futureSalePrice /
                    Math.pow(1 + 0.05, inputRentalPeriodYears ?? 10),
                  lang,
                )}
              </strong>
            </div>

            <div className={styles.row}>
              <span>
                {t.rentalCashFlow} ({inputRentalPeriodYears ?? 10} {yearsText})
              </span>
              <strong>{formatCurrency(result.totalNetRent ?? 0, lang)}</strong>
            </div>

            <div className={styles.row}>
              <span>{t.valueInFinalYear}</span>
              <strong>{formatCurrency(result.futureSalePrice, lang)}</strong>
            </div>

            <div className={styles.row}>
              <span>{t.capitalGain}</span>
              <strong>{formatCurrency(result.capitalGain ?? 0, lang)}</strong>
            </div>
          </>
        ) : (
          <>
            <div className={styles.row}>
              <span>{t.offPlanGain}</span>
              <strong>{formatCurrency(result.capitalGain ?? 0, lang)}</strong>
            </div>

            <div className={styles.row}>
              <span>{t.valueAtCompletion}</span>
              <strong>{formatCurrency(result.futureSalePrice, lang)}</strong>
            </div>
          </>
        )}

        <div className={styles.row}>
          <span>{t.sellingCosts}</span>
          <strong>{formatCurrency(-result.sellingCosts, lang)}</strong>
        </div>

        <div className={styles.row}>
          <span>{t.annualized}</span>
          <strong>{formatPercent(result.annualizedRoiPercent, lang)}%</strong>
        </div>
      </div>

      <div className={styles.disclaimer}>{t.disclaimer}</div>

      <div className={styles.ctaBox}>
        {/* <button type="button" className={styles.ctaButton}>
          {ctaLabel}
        </button> */}
        <ButtonModal className={styles.ctaButton} modalType="roi">
          {ctaLabel}
        </ButtonModal>
      </div>
    </div>
  );
};

export default RoiResults;
