/* Cyprus personal tax for the 2026 tax year: one person, a tax resident.
   Pure functions, no I/O, so the calculator component and the tests share the same arithmetic.

   Sources (read 2026-11-11, see the guides /guides/cyprus-tax-for-individuals-2026, /guides/cyprus-tax-reform-2026,
   /guides/cyprus-social-insurance, /guides/cyprus-dividend-interest-tax): the income tax scale and deductions of the
   2026 reform (Law 243(I)/2025 and related), Social Insurance Services rates and ceilings for 2026, GHS (Health
   Insurance Organisation) rates and the €180,000 annual maximum.

   What it does NOT model (the page says so): non-residents, the Special Defence Contribution on interest at the
   reduced 3% rate, the weekly categories of the self-employed (it uses actual income), provisional-tax timing, the
   Central Holiday Fund, the employer's side, capital gains and the reform's income ceilings beyond the ones named. */

export const TAX_YEAR = 2026;

/** Chargeable-income bands of the 2026 scale: `upTo` is the top of the band, Infinity for the last. */
export const BANDS: { from: number; upTo: number; rate: number }[] = [
  { from: 0, upTo: 22_000, rate: 0 },
  { from: 22_000, upTo: 32_000, rate: 0.2 },
  { from: 32_000, upTo: 42_000, rate: 0.25 },
  { from: 42_000, upTo: 72_000, rate: 0.3 },
  { from: 72_000, upTo: Infinity, rate: 0.35 },
];

export const SI_EMPLOYEE_RATE = 0.088;
export const SI_EMPLOYEE_CEILING = 68_904; // insurable earnings ceiling, 2026
export const SI_SELF_RATE = 0.166;
export const SI_SELF_CEILING = 68_900; // weekly ceiling €1,325 x 52, Social Insurance Services table 2026
export const HRDA_SELF_RATE = 0.005; // from 5 January 2026 (base assumed to be the same income)
export const GHS_EMPLOYEE_RATE = 0.0265;
export const GHS_SELF_RATE = 0.04;
export const GHS_OTHER_RATE = 0.0265; // pension, rent, dividends, interest
export const GHS_ANNUAL_MAX_BASE = 180_000; // one maximum per person across all income
export const FOREIGN_PENSION_EXEMPT = 5_000;
export const FOREIGN_PENSION_RATE = 0.05;
export const RENT_DEEMED_DEDUCTION = 0.2;
export const SDC_DIVIDEND_RATE = 0.05; // profits of 2026 onwards, domiciled residents
export const SDC_INTEREST_RATE = 0.17;
export const OTHER_DEDUCTIONS_LIMIT = 0.2; // one fifth of chargeable income

export type Exemption = "none" | "half" | "fifth" | "quarter";
export type Status = "single" | "singleParent" | "married";

export type TaxInput = {
  employment: number;
  selfEmployed: number;
  foreignPension: number;
  rent: number;
  dividends: number;
  interest: number;
  domiciled: boolean;
  pensionHasS1: boolean;
  exemption: Exemption;
  status: Status;
  spouseIncome: number;
  children: number;
  homeInterestOrRent: number;
  disasterInsurance: number;
  energyOrEv: number;
  otherDeductions: number;
};

export type BandLine = { from: number; upTo: number; rate: number; amount: number; tax: number };

export type TaxResult = {
  grossIncome: number;
  exemptAmount: number;
  socialInsurance: number;
  hrda: number;
  ghs: number;
  sdc: number;
  incomeTax: number;
  totalBurden: number;
  net: number;
  effectiveRate: number;
  chargeableBeforeDeductions: number;
  chargeable: number;
  deductions: { socialAndGhs: number; family: number; other: number; otherDisallowed: number };
  familyDeductionsApplied: boolean;
  familyIncome: number;
  familyCeiling: number;
  bands: BandLine[];
  topRate: number;
  pension: { elected: boolean; taxWithElection: number; taxNormalScale: number; pensionTax: number };
};

export const emptyInput = (): TaxInput => ({
  employment: 0, selfEmployed: 0, foreignPension: 0, rent: 0, dividends: 0, interest: 0,
  domiciled: false, pensionHasS1: false, exemption: "none", status: "single", spouseIncome: 0, children: 0,
  homeInterestOrRent: 0, disasterInsurance: 0, energyOrEv: 0, otherDeductions: 0,
});

const pos = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

/** Income tax on a chargeable income, band by band. */
export function scaleTax(chargeable: number): { tax: number; bands: BandLine[] } {
  const c = pos(chargeable);
  let tax = 0;
  const bands = BANDS.map((b) => {
    const amount = Math.max(0, Math.min(c, b.upTo) - b.from);
    const t = amount * b.rate;
    tax += t;
    return { from: b.from, upTo: b.upTo, rate: b.rate, amount, tax: t };
  });
  return { tax, bands };
}

/** The 2026 employment exemptions for people who start work in Cyprus (conditions are the user's to confirm). */
export function employmentExemption(employment: number, kind: Exemption): number {
  const e = pos(employment);
  if (kind === "half") return e > 55_000 ? e * 0.5 : 0;
  if (kind === "fifth") return Math.min(e * 0.2, 8_550);
  if (kind === "quarter") return e > 30_000 ? Math.min(e * 0.25, 25_000) : 0;
  return 0;
}

/** Family income ceiling for the new 2026 deductions, by number of children. */
export function familyCeiling(children: number): number {
  if (children >= 5) return 200_000;
  if (children >= 3) return 150_000;
  return 100_000;
}

export function childrenDeduction(children: number, singleParent: boolean): number {
  const per = [1_000, 1_250, 1_500];
  let sum = 0;
  for (let i = 0; i < Math.max(0, Math.floor(children)); i++) sum += per[Math.min(i, 2)];
  return singleParent ? sum * 2 : sum;
}

export function computeTax(raw: Partial<TaxInput>): TaxResult {
  const i: TaxInput = { ...emptyInput(), ...raw };
  const employment = pos(i.employment);
  const selfEmployed = pos(i.selfEmployed);
  const pension = pos(i.foreignPension);
  const rent = pos(i.rent);
  const dividends = pos(i.dividends);
  const interest = pos(i.interest);

  const grossIncome = employment + selfEmployed + pension + rent + dividends + interest;
  const exemptAmount = employmentExemption(employment, i.exemption);

  // Social insurance: on pay before any exemption, up to the ceiling.
  const socialInsurance =
    SI_EMPLOYEE_RATE * Math.min(employment, SI_EMPLOYEE_CEILING) + SI_SELF_RATE * Math.min(selfEmployed, SI_SELF_CEILING);
  const hrda = HRDA_SELF_RATE * Math.min(selfEmployed, SI_SELF_CEILING);

  // GHS: one annual maximum per person, filled in the order the Tax Department lists the income types.
  // Only the GHS paid on income that is itself taxable (pay, profit, a pension on the normal scale, rent) is deducted
  // from chargeable income; GHS on dividends and interest, which are exempt from income tax, is not.
  let room = GHS_ANNUAL_MAX_BASE;
  const ghsPart = (base: number, rate: number) => {
    const used = Math.min(base, room);
    room -= used;
    return used * rate;
  };
  const ghsEmployment = ghsPart(employment, GHS_EMPLOYEE_RATE);
  const ghsSelf = ghsPart(selfEmployed, GHS_SELF_RATE);
  const ghsPension = ghsPart(i.pensionHasS1 ? 0 : pension, GHS_OTHER_RATE);
  const ghsRent = ghsPart(rent, GHS_OTHER_RATE);
  const ghsDividends = ghsPart(dividends, GHS_OTHER_RATE);
  const ghsInterest = ghsPart(interest, GHS_OTHER_RATE);
  const ghs = ghsEmployment + ghsSelf + ghsPension + ghsRent + ghsDividends + ghsInterest;

  const sdc = i.domiciled ? SDC_DIVIDEND_RATE * dividends + SDC_INTEREST_RATE * interest : 0;

  // New 2026 deductions: only below family income ceilings.
  const spouse = i.status === "married" ? pos(i.spouseIncome) : 0;
  const familyIncome = grossIncome + spouse;
  const kids = Math.max(0, Math.floor(pos(i.children)));
  const ceiling = familyCeiling(kids);
  const familyOk = familyIncome <= ceiling;
  const soloNoKids = i.status !== "married" && kids === 0;
  const soloOk = !soloNoKids || grossIncome <= 40_000; // single person without children: €40,000 for the home/energy items
  let family = 0;
  if (familyOk) {
    family += childrenDeduction(kids, i.status === "singleParent" && kids > 0);
    family += Math.min(pos(i.disasterInsurance), 500);
    if (soloOk) {
      family += Math.min(pos(i.homeInterestOrRent), 2_000);
      family += Math.min(pos(i.energyOrEv), 1_000);
    }
  }

  const rentTaxable = rent * (1 - RENT_DEEMED_DEDUCTION);
  const baseNoPension = Math.max(0, employment - exemptAmount) + selfEmployed + rentTaxable;

  const chargeableFor = (withPension: boolean) => {
    const before = baseNoPension + (withPension ? pension : 0);
    const sg = socialInsurance + ghsEmployment + ghsSelf + ghsRent + (withPension ? ghsPension : 0);
    const afterSg = Math.max(0, before - sg);
    const otherAllowed = Math.min(pos(i.otherDeductions), afterSg * OTHER_DEDUCTIONS_LIMIT);
    const afterOther = afterSg - otherAllowed;
    const chargeable = Math.max(0, afterOther - family);
    return { before, sg, otherAllowed, chargeable };
  };

  const normal = chargeableFor(true);
  const election = chargeableFor(false);
  const taxNormal = scaleTax(normal.chargeable);
  const taxElection = scaleTax(election.chargeable);
  const pensionFive = Math.max(0, pension - FOREIGN_PENSION_EXEMPT) * FOREIGN_PENSION_RATE;
  const totalNormal = taxNormal.tax;
  const totalElection = taxElection.tax + pensionFive;
  const elected = pension > 0 && totalElection < totalNormal;
  const chosen = elected ? election : normal;
  const chosenScale = elected ? taxElection : taxNormal;
  const incomeTax = elected ? totalElection : totalNormal;

  const totalBurden = incomeTax + socialInsurance + hrda + ghs + sdc;
  const net = grossIncome - totalBurden;

  let topRate = 0;
  for (const b of chosenScale.bands) if (b.amount > 0) topRate = b.rate;

  return {
    grossIncome,
    exemptAmount,
    socialInsurance,
    hrda,
    ghs,
    sdc,
    incomeTax,
    totalBurden,
    net,
    effectiveRate: grossIncome > 0 ? totalBurden / grossIncome : 0,
    chargeableBeforeDeductions: chosen.before,
    chargeable: chosen.chargeable,
    deductions: {
      socialAndGhs: chosen.sg,
      family,
      other: chosen.otherAllowed,
      otherDisallowed: Math.max(0, pos(i.otherDeductions) - chosen.otherAllowed),
    },
    familyDeductionsApplied: family > 0,
    familyIncome,
    familyCeiling: ceiling,
    bands: chosenScale.bands,
    topRate,
    pension: { elected, taxWithElection: totalElection, taxNormalScale: totalNormal, pensionTax: elected ? pensionFive : 0 },
  };
}

/* ---------------------------------------------------------------------------------------------------------------
   Owner and investor view: a Cyprus company that pays its owner a salary and a dividend, plus personal investment
   income and one-off gains. Built on computeTax() for the personal side. */

export const CORPORATE_TAX_RATE = 0.15; // from 2026
export const CGT_RATE = 0.2;
export const CGT_EXEMPT_MAIN_HOME = 150_000;
export const CGT_EXEMPT_OTHER = 30_000;
export const CRYPTO_RATE = 0.08;

// Employer-side charges on the owner's salary, deductible for the company (see /guides/cyprus-social-insurance).
export const EMPLOYER_SI_RATE = 0.088;
export const EMPLOYER_GHS_RATE = 0.029;
export const EMPLOYER_REDUNDANCY_RATE = 0.012;
export const EMPLOYER_HRDA_RATE = 0.005;
export const EMPLOYER_COHESION_RATE = 0.02;

export type InvestorInput = {
  domiciled: boolean;
  // Your Cyprus company
  companyProfit: number; // before the owner's salary, employer charges and tax
  companySalary: number;
  companyDividend: number;
  // Personal income
  dividends: number; // other companies and investments
  interest: number;
  foreignPension: number;
  pensionHasS1: boolean;
  selfEmployed: number;
  employment: number;
  exemption: Exemption;
  // One-off gains
  propertyGain: number; // taxable gain on a Cyprus property
  propertyMainHome: boolean;
  cryptoGain: number;
  // Family and deductions
  status: Status;
  spouseIncome: number;
  children: number;
  homeInterestOrRent: number;
  disasterInsurance: number;
  energyOrEv: number;
  otherDeductions: number;
};

export const emptyInvestorInput = (): InvestorInput => ({
  domiciled: false,
  companyProfit: 0, companySalary: 0, companyDividend: 0,
  dividends: 0, interest: 0, foreignPension: 0, pensionHasS1: false, selfEmployed: 0, employment: 0, exemption: "none",
  propertyGain: 0, propertyMainHome: false, cryptoGain: 0,
  status: "single", spouseIncome: 0, children: 0, homeInterestOrRent: 0, disasterInsurance: 0, energyOrEv: 0, otherDeductions: 0,
});

export type InvestorResult = {
  personal: TaxResult; // income tax, social insurance, GHS and SDC on the annual income
  company: {
    on: boolean;
    profit: number;
    salary: number;
    employerCharges: number;
    taxableProfit: number;
    corporateTax: number;
    afterTax: number;
    dividendRequested: number;
    dividendPaid: number;
    dividendCapped: boolean;
    retained: number;
  };
  propertyTax: number;
  propertyExemption: number;
  cryptoTax: number;
  /** Everything that reaches you personally in the year, before nothing else is taken: net of all personal taxes. */
  keptPersonally: number;
  /** Money left inside the company. */
  retained: number;
  /** Personal taxes and contributions, corporate tax, employer charges, capital gains tax and crypto tax. */
  totalBurden: number;
  /** Profit of the company before the owner's pay, plus personal income and gains: the base of every percentage. */
  pool: number;
  effectiveRate: number;
  gainsTotal: number;
  /** Tax and contributions that disappear if the person is not domiciled (SDC), shown when domiciled; else what domicile would cost. */
  domicileDelta: number;
};

export function employerCharges(salary: number): number {
  const s = pos(salary);
  const capped = Math.min(s, SI_EMPLOYEE_CEILING);
  return (
    EMPLOYER_SI_RATE * capped +
    EMPLOYER_REDUNDANCY_RATE * capped +
    EMPLOYER_HRDA_RATE * capped +
    EMPLOYER_GHS_RATE * s +
    EMPLOYER_COHESION_RATE * s
  );
}

function computeCore(i: InvestorInput): Omit<InvestorResult, "domicileDelta"> {
  const profit = pos(i.companyProfit);
  const salary = pos(i.companySalary);
  const on = profit > 0 || salary > 0 || pos(i.companyDividend) > 0;
  const charges = on ? employerCharges(salary) : 0;
  const taxableProfit = Math.max(0, profit - salary - charges);
  const corporateTax = taxableProfit * CORPORATE_TAX_RATE;
  const afterTax = taxableProfit - corporateTax;
  const dividendRequested = pos(i.companyDividend);
  const dividendPaid = on ? Math.min(dividendRequested, afterTax) : 0;
  const retained = on ? afterTax - dividendPaid : 0;

  const personal = computeTax({
    employment: pos(i.employment) + (on ? salary : 0),
    selfEmployed: i.selfEmployed,
    foreignPension: i.foreignPension,
    rent: 0,
    dividends: pos(i.dividends) + dividendPaid,
    interest: i.interest,
    domiciled: i.domiciled,
    pensionHasS1: i.pensionHasS1,
    exemption: i.exemption,
    status: i.status,
    spouseIncome: i.spouseIncome,
    children: i.children,
    homeInterestOrRent: i.homeInterestOrRent,
    disasterInsurance: i.disasterInsurance,
    energyOrEv: i.energyOrEv,
    otherDeductions: i.otherDeductions,
  });

  const gain = pos(i.propertyGain);
  const propertyExemption = i.propertyMainHome ? CGT_EXEMPT_MAIN_HOME : CGT_EXEMPT_OTHER;
  const propertyTax = CGT_RATE * Math.max(0, gain - propertyExemption);
  const cryptoTax = CRYPTO_RATE * pos(i.cryptoGain);
  const gainsTotal = gain + pos(i.cryptoGain);

  // The owner's own pay is part of `personal.grossIncome`; the company's profit before that pay is the pool's company part.
  const otherPersonal = personal.grossIncome - (on ? salary + dividendPaid : 0);
  const pool = (on ? profit : 0) + otherPersonal + gainsTotal;
  const totalBurden = personal.totalBurden + corporateTax + charges + propertyTax + cryptoTax;
  const keptPersonally = personal.grossIncome + gainsTotal - personal.totalBurden - propertyTax - cryptoTax;

  return {
    personal,
    company: {
      on, profit, salary, employerCharges: charges, taxableProfit, corporateTax, afterTax,
      dividendRequested, dividendPaid, dividendCapped: on && dividendRequested > afterTax + 0.5, retained,
    },
    propertyTax,
    propertyExemption,
    cryptoTax,
    keptPersonally,
    retained,
    totalBurden,
    pool,
    effectiveRate: pool > 0 ? totalBurden / pool : 0,
    gainsTotal,
  };
}

export function computeInvestorTax(raw: Partial<InvestorInput>): InvestorResult {
  const i: InvestorInput = { ...emptyInvestorInput(), ...raw };
  const core = computeCore(i);
  // What domicile changes: the Special Defence Contribution on dividends and interest.
  const other = computeCore({ ...i, domiciled: !i.domiciled });
  const domiciledResult = i.domiciled ? core : other;
  const nonDomResult = i.domiciled ? other : core;
  const delta = domiciledResult.totalBurden - nonDomResult.totalBurden;
  return { ...core, domicileDelta: delta };
}
