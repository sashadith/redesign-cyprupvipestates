import { Project } from "@/types/project";
import { getDefaultFurnishingCost, getMarketPreset } from "./presets";
import { RoiCalculatorInput, RoiScenario, RoiStrategy } from "./types";

function getBuildPeriodYearsFromCompletionDate(
  completionDate?: string,
): number {
  if (!completionDate) return 1;

  const normalized = /^\d{4}-\d{2}$/.test(completionDate)
    ? `${completionDate}-01`
    : completionDate;

  const now = new Date();
  const completion = new Date(normalized);

  const diffMs = completion.getTime() - now.getTime();
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);

  if (Number.isNaN(diffYears) || diffYears <= 0) return 1;

  return Math.max(1, Math.min(5, Number(diffYears.toFixed(1))));
}

function normalizePercent(value?: number, fallback = 0): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return value > 1 ? value / 100 : value;
}

export function mapProjectToCalculatorInput(
  project?: Project | null,
  strategy: RoiStrategy = "buyHold",
  scenario: RoiScenario = "realistic",
): RoiCalculatorInput {
  const city = project?.keyFeatures?.city ?? "Paphos";
  const propertyType = project?.keyFeatures?.propertyType ?? "Apartment";
  const preset = getMarketPreset(city, propertyType, scenario);

  const purchasePrice = project?.keyFeatures?.price ?? 300000;

  const furnishingCost =
    project?.investmentData?.furnishingEstimate ??
    getDefaultFurnishingCost(propertyType);

  const buildPeriodYears =
    project?.investmentData?.customBuildPeriodYears ??
    getBuildPeriodYearsFromCompletionDate(project?.keyFeatures?.completionDate);

  return {
    strategy,
    scenario,
    city,
    propertyType,
    purchasePrice,
    furnishingCost,
    vatRate: 0.19,
    holdingYears: 10,
    buildPeriodYears,
    grossYield: preset.grossYield,
    occupancy: preset.occupancy,
    annualAppreciation: preset.annualAppreciation,
    offPlanGrowth: preset.offPlanGrowth,
    managementPercent: normalizePercent(
      project?.investmentData?.managementPercent,
      preset.managementPercent,
    ),
    maintenancePercent: normalizePercent(
      project?.investmentData?.maintenancePercent,
      preset.maintenancePercent,
    ),
    sellingCostsPercent: normalizePercent(
      project?.investmentData?.sellingCostsPercent,
      preset.sellingCostsPercent,
    ),
    legalFeesPercent: preset.legalFeesPercent,
    annualServiceCharge: project?.investmentData?.annualServiceCharge ?? 0,
    expectedMonthlyRent: project?.investmentData?.expectedMonthlyRent,

    netYieldYearOne: preset.grossYield,
    annualRentGrowth: preset.annualRentGrowth,
    rentalPeriodYears: 10,
  };
}
