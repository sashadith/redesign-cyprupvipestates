import {
  calculateAnnualizedReturn,
  calculateStampDuty,
  roundCurrency,
  roundPercent,
} from "./helpers";
import { RoiCalculationResult, RoiCalculatorInput } from "./types";

export function calculateBuyHold(
  input: RoiCalculatorInput,
): RoiCalculationResult {
  const vatAmount = input.purchasePrice * input.vatRate; // informational only
  const legalFees = input.purchasePrice * input.legalFeesPercent;
  const stampDuty = calculateStampDuty(input.purchasePrice);

  const purchaseCostWithFees = input.purchasePrice + legalFees + stampDuty;

  const totalEntryCost = purchaseCostWithFees + input.furnishingCost;

  const completionValue =
    input.purchasePrice *
    Math.pow(1 + input.offPlanGrowth, input.buildPeriodYears);

  const firstYearGrossRent =
    typeof input.expectedMonthlyRent === "number" &&
    input.expectedMonthlyRent > 0
      ? input.expectedMonthlyRent * 12
      : completionValue * input.netYieldYearOne;

  const firstYearEffectiveRent = firstYearGrossRent * input.occupancy;
  const firstYearManagementCost =
    firstYearEffectiveRent * input.managementPercent;
  const firstYearMaintenanceCost = completionValue * input.maintenancePercent;

  const firstYearNetRent =
    firstYearEffectiveRent -
    firstYearManagementCost -
    firstYearMaintenanceCost -
    input.annualServiceCharge;

  const yearlyNetRents = Array.from(
    { length: input.rentalPeriodYears },
    (_, i) => firstYearNetRent * Math.pow(1 + input.annualRentGrowth, i),
  );

  const totalNetRent = yearlyNetRents.reduce((sum, value) => sum + value, 0);

  const futureSalePrice =
    completionValue *
    Math.pow(1 + input.annualAppreciation, input.rentalPeriodYears);

  const sellingCosts = futureSalePrice * input.sellingCostsPercent;
  const capitalGain = futureSalePrice - input.purchasePrice;

  const totalYears = input.buildPeriodYears + input.rentalPeriodYears;

  const netProfit =
    totalNetRent + futureSalePrice - sellingCosts - totalEntryCost;

  const roiPercent =
    totalEntryCost > 0 ? (netProfit / totalEntryCost) * 100 : 0;

  const finalValue = totalEntryCost + netProfit;
  const annualizedRoiPercent =
    calculateAnnualizedReturn(totalEntryCost, finalValue, totalYears) * 100;

  const buildYearsRounded = Math.max(1, Math.ceil(input.buildPeriodYears));

  const buildPhaseData = Array.from(
    { length: buildYearsRounded },
    (_, index) => {
      const year = index + 1;
      const cappedYear = Math.min(year, input.buildPeriodYears);

      const estimatedValue =
        input.purchasePrice * Math.pow(1 + input.offPlanGrowth, cappedYear);

      const cumulativeProfit = estimatedValue - totalEntryCost;

      return {
        year,
        estimatedValue: roundCurrency(estimatedValue),
        cumulativeProfit: roundCurrency(cumulativeProfit),
      };
    },
  );

  const rentPhaseData = Array.from(
    { length: input.rentalPeriodYears },
    (_, index) => {
      const rentYear = index + 1;
      const totalYear = buildYearsRounded + rentYear;

      const estimatedValue =
        completionValue * Math.pow(1 + input.annualAppreciation, rentYear);

      const estimatedSellingCosts = estimatedValue * input.sellingCostsPercent;

      const cumulativeNetRent = yearlyNetRents
        .slice(0, rentYear)
        .reduce((sum, value) => sum + value, 0);

      const cumulativeProfit =
        cumulativeNetRent +
        estimatedValue -
        estimatedSellingCosts -
        totalEntryCost;

      return {
        year: totalYear,
        cumulativeNetRent: roundCurrency(cumulativeNetRent),
        estimatedValue: roundCurrency(estimatedValue),
        cumulativeProfit: roundCurrency(cumulativeProfit),
      };
    },
  );

  const yearlyData = [...buildPhaseData, ...rentPhaseData];

  return {
    purchaseCostWithFees: roundCurrency(purchaseCostWithFees),
    totalEntryCost: roundCurrency(totalEntryCost),
    vatAmount: roundCurrency(vatAmount),
    legalFees: roundCurrency(legalFees),
    stampDuty: roundCurrency(stampDuty),
    furnishingCost: roundCurrency(input.furnishingCost),
    annualGrossRent: roundCurrency(firstYearGrossRent),
    annualNetRent: roundCurrency(firstYearNetRent),
    totalNetRent: roundCurrency(totalNetRent),
    futureSalePrice: roundCurrency(futureSalePrice),
    capitalGain: roundCurrency(capitalGain),
    sellingCosts: roundCurrency(sellingCosts),
    netProfit: roundCurrency(netProfit),
    roiPercent: roundPercent(roiPercent),
    annualizedRoiPercent: roundPercent(annualizedRoiPercent),
    yearlyData,
  };
}
