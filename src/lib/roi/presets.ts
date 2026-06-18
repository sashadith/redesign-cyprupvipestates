import {
  RoiCity,
  RoiMarketPreset,
  RoiPropertyType,
  RoiScenario,
} from "./types";

type PresetMap = Record<RoiCity, RoiMarketPreset>;

const basePresets: PresetMap = {
  Paphos: {
    grossYield: 0.045,
    occupancy: 0.95,
    annualAppreciation: 0.05,
    offPlanGrowth: 0.085,
    managementPercent: 0.08,
    maintenancePercent: 0.005,
    sellingCostsPercent: 0.03,
    legalFeesPercent: 0.015,
    annualRentGrowth: 0.03,
  },
  Limassol: {
    grossYield: 0.046,
    occupancy: 0.95,
    annualAppreciation: 0.052,
    offPlanGrowth: 0.09,
    managementPercent: 0.08,
    maintenancePercent: 0.005,
    sellingCostsPercent: 0.03,
    legalFeesPercent: 0.015,
    annualRentGrowth: 0.03,
  },
  Larnaca: {
    grossYield: 0.044,
    occupancy: 0.94,
    annualAppreciation: 0.048,
    offPlanGrowth: 0.082,
    managementPercent: 0.08,
    maintenancePercent: 0.005,
    sellingCostsPercent: 0.03,
    legalFeesPercent: 0.015,
    annualRentGrowth: 0.03,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function applyPropertyTypeAdjustment(
  preset: RoiMarketPreset,
  propertyType: RoiPropertyType,
): RoiMarketPreset {
  if (propertyType === "Villa") {
    return {
      ...preset,
      grossYield: clamp(preset.grossYield - 0.008, 0.03, 0.08),
      occupancy: clamp(preset.occupancy - 0.03, 0.85, 0.98),
      maintenancePercent: 0.007,
    };
  }

  if (propertyType === "Townhouse" || propertyType === "Semi-detached villa") {
    return {
      ...preset,
      grossYield: clamp(preset.grossYield - 0.005, 0.03, 0.08),
      occupancy: clamp(preset.occupancy - 0.02, 0.86, 0.98),
      maintenancePercent: 0.0065,
    };
  }

  if (propertyType === "Office" || propertyType === "Shop") {
    return {
      ...preset,
      grossYield: clamp(preset.grossYield + 0.005, 0.04, 0.09),
      occupancy: clamp(preset.occupancy - 0.03, 0.82, 0.98),
      maintenancePercent: 0.006,
    };
  }

  return preset;
}

function applyScenarioAdjustment(
  preset: RoiMarketPreset,
  scenario: RoiScenario,
): RoiMarketPreset {
  if (scenario === "conservative") {
    return {
      ...preset,
      grossYield: clamp(preset.grossYield * 0.92, 0.03, 0.09),
      occupancy: clamp(preset.occupancy - 0.03, 0.8, 0.98),
      annualAppreciation: clamp(preset.annualAppreciation * 0.8, 0.02, 0.12),
      offPlanGrowth: clamp(preset.offPlanGrowth * 0.85, 0.03, 0.14),
      annualRentGrowth: clamp(preset.annualRentGrowth * 0.8, 0.01, 0.08),
    };
  }

  if (scenario === "optimistic") {
    return {
      ...preset,
      grossYield: clamp(preset.grossYield * 1.08, 0.03, 0.09),
      occupancy: clamp(preset.occupancy + 0.01, 0.8, 0.98),
      annualAppreciation: clamp(preset.annualAppreciation * 1.15, 0.02, 0.12),
      offPlanGrowth: clamp(preset.offPlanGrowth * 1.12, 0.03, 0.14),
      annualRentGrowth: clamp(preset.annualRentGrowth * 1.1, 0.01, 0.08),
    };
  }

  return preset;
}

export function getMarketPreset(
  city: RoiCity,
  propertyType: RoiPropertyType,
  scenario: RoiScenario = "realistic",
): RoiMarketPreset {
  const base = basePresets[city] ?? basePresets.Paphos;
  const byType = applyPropertyTypeAdjustment(base, propertyType);
  return applyScenarioAdjustment(byType, scenario);
}

export function getDefaultFurnishingCost(
  propertyType: RoiPropertyType,
): number {
  switch (propertyType) {
    case "Apartment":
      return 15000;
    case "Villa":
      return 35000;
    case "Townhouse":
      return 22000;
    case "Semi-detached villa":
      return 25000;
    case "Office":
      return 12000;
    case "Shop":
      return 10000;
    default:
      return 15000;
  }
}
