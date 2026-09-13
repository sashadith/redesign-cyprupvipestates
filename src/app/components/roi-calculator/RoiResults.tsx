"use client";

import React from "react";
import styles from "./roi-calculator.module.scss";
import { RoiCalculationResult, RoiStrategy } from "@/lib/roi";
import { ButtonModal } from "../ButtonModal/ButtonModal";
import { roiResultsCopy } from "./RoiResults.copy";

type Props = {
  result: RoiCalculationResult;
  strategy: RoiStrategy;
  lang: string;
  ctaLabel: string;
  inputBuildPeriodYears?: number;
  inputRentalPeriodYears?: number;
};

function formatCurrency(value: number, lang: string) {
  const locale = roiResultsCopy(lang).numberLocale;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number, lang: string) {
  const locale = roiResultsCopy(lang).numberLocale;

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

  const c = roiResultsCopy(lang);

  const t = {
    highlightLabel: isBuyHold ? c.highlightLabelBuyHold : c.highlightLabelBuySell,
    horizon: c.horizon,
    purchaseCostWithFees: c.purchaseCostWithFees,
    furnishing: c.furnishing,
    totalEntryCost: c.totalEntryCost,
    offPlanGain: c.offPlanGain,
    valueAtCompletion: c.valueAtCompletion,
    rentalCashFlow: c.rentalCashFlow,
    valueInFinalYear: c.valueInFinalYear,
    capitalGain: c.capitalGain,
    sellingCosts: c.sellingCosts,
    annualized: c.annualized,
    disclaimer: c.disclaimer,
  };

  const yearsText = c.yearsText;

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
