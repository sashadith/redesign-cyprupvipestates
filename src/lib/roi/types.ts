export type RoiStrategy = "buyHold" | "buySell";
export type RoiScenario = "conservative" | "realistic" | "optimistic";
export type RoiCity = "Paphos" | "Limassol" | "Larnaca";
export type RoiPropertyType =
  | "Apartment"
  | "Villa"
  | "Townhouse"
  | "Semi-detached villa"
  | "Office"
  | "Shop";

export type RoiMarketPreset = {
  grossYield: number;
  occupancy: number;
  annualAppreciation: number;
  offPlanGrowth: number;
  managementPercent: number;
  maintenancePercent: number;
  sellingCostsPercent: number;
  legalFeesPercent: number;
  annualRentGrowth: number;
};

export type RoiCalculatorInput = {
  strategy: RoiStrategy;
  scenario: RoiScenario;
  city: RoiCity;
  propertyType: RoiPropertyType;
  purchasePrice: number;
  furnishingCost: number;
  vatRate: number; // informational only for future detailed mode
  holdingYears: number; // legacy field, can remain
  buildPeriodYears: number;
  grossYield: number;
  occupancy: number;
  annualAppreciation: number;
  offPlanGrowth: number;
  managementPercent: number;
  maintenancePercent: number;
  sellingCostsPercent: number;
  legalFeesPercent: number;
  annualServiceCharge: number;
  expectedMonthlyRent?: number;

  netYieldYearOne: number; // 0.045 = 4.5%
  annualRentGrowth: number; // 0.03 = 3%
  rentalPeriodYears: number; // after completion
};

export type RoiYearPoint = {
  year: number;
  cumulativeNetRent?: number;
  estimatedValue: number;
  cumulativeProfit?: number;
};

export type RoiCalculationResult = {
  purchaseCostWithFees: number;
  totalEntryCost: number;
  vatAmount: number;
  legalFees: number;
  stampDuty: number;
  furnishingCost: number;
  annualGrossRent?: number;
  annualNetRent?: number;
  totalNetRent?: number;
  futureSalePrice: number;
  capitalGain?: number;
  sellingCosts: number;
  netProfit: number;
  roiPercent: number;
  annualizedRoiPercent: number;
  yearlyData: RoiYearPoint[];
};
