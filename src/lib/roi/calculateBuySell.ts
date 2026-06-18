import {
  calculateAnnualizedReturn,
  calculateStampDuty,
  roundCurrency,
  roundPercent,
} from "./helpers";
import { RoiCalculationResult, RoiCalculatorInput } from "./types";

export function calculateBuySell(
  input: RoiCalculatorInput,
): RoiCalculationResult {
  const vatAmount = input.purchasePrice * input.vatRate; // informational only
  const legalFees = input.purchasePrice * input.legalFeesPercent;
  const stampDuty = calculateStampDuty(input.purchasePrice);

  const purchaseCostWithFees = input.purchasePrice + legalFees + stampDuty;

  const totalEntryCost = purchaseCostWithFees + input.furnishingCost;

  const futureSalePrice =
    input.purchasePrice *
    Math.pow(1 + input.offPlanGrowth, input.buildPeriodYears);

  const sellingCosts = futureSalePrice * input.sellingCostsPercent;
  const capitalGain = futureSalePrice - input.purchasePrice;

  const netProfit = futureSalePrice - sellingCosts - totalEntryCost;

  const roiPercent =
    totalEntryCost > 0 ? (netProfit / totalEntryCost) * 100 : 0;

  const finalValue = totalEntryCost + netProfit;
  const annualizedRoiPercent =
    calculateAnnualizedReturn(
      totalEntryCost,
      finalValue,
      input.buildPeriodYears,
    ) * 100;

  const maxYears = Math.max(1, Math.ceil(input.buildPeriodYears));

  const yearlyData = Array.from({ length: maxYears }, (_, index) => {
    const year = index + 1;
    const cappedYear = Math.min(year, input.buildPeriodYears);

    const estimatedValue =
      input.purchasePrice * Math.pow(1 + input.offPlanGrowth, cappedYear);

    const estimatedSellingCosts = estimatedValue * input.sellingCostsPercent;

    const cumulativeProfit =
      estimatedValue - estimatedSellingCosts - totalEntryCost;

    return {
      year,
      estimatedValue: roundCurrency(estimatedValue),
      cumulativeProfit: roundCurrency(cumulativeProfit),
    };
  });

  return {
    purchaseCostWithFees: roundCurrency(purchaseCostWithFees),
    totalEntryCost: roundCurrency(totalEntryCost),
    vatAmount: roundCurrency(vatAmount),
    legalFees: roundCurrency(legalFees),
    stampDuty: roundCurrency(stampDuty),
    furnishingCost: roundCurrency(input.furnishingCost),
    futureSalePrice: roundCurrency(futureSalePrice),
    capitalGain: roundCurrency(capitalGain),
    sellingCosts: roundCurrency(sellingCosts),
    netProfit: roundCurrency(netProfit),
    roiPercent: roundPercent(roiPercent),
    annualizedRoiPercent: roundPercent(annualizedRoiPercent),
    yearlyData,
  };
}
