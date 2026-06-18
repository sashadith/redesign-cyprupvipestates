export function roundCurrency(value: number): number {
  return Math.round(value);
}

export function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateStampDuty(price: number): number {
  if (price <= 5000) return 0;

  const firstBandLimit = 170000;
  const firstBandRate = 0.0015;
  const secondBandRate = 0.002;

  const taxable = price - 5000;
  const firstBandTaxable = Math.min(taxable, firstBandLimit - 5000);
  const secondBandTaxable = Math.max(0, taxable - firstBandTaxable);

  const total =
    firstBandTaxable * firstBandRate + secondBandTaxable * secondBandRate;

  return Math.min(total, 20000);
}

export function calculateAnnualizedReturn(
  initialInvestment: number,
  finalValue: number,
  years: number,
): number {
  if (initialInvestment <= 0 || finalValue <= 0 || years <= 0) return 0;
  return Math.pow(finalValue / initialInvestment, 1 / years) - 1;
}
