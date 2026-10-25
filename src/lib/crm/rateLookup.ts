import { prisma } from "@/lib/prisma";
import { effectiveRates, toRateRows, type EffectiveRate } from "./rateFormat";

// The commission rate that applies to each project (2026-10-24): the project's
// own rate if one is set, else its developer's default — the same rule the deal
// form and the partner portal use. One query for the rates of all the accounts
// involved, so a list of projects costs one extra query in total.
export async function effectiveRatesFor(devs: { id: string; developerAccountId: string }[]): Promise<Map<string, EffectiveRate>> {
  const accountIds = Array.from(new Set(devs.map((d) => d.developerAccountId)));
  if (!accountIds.length) return new Map();
  const rows = await prisma.commissionRate.findMany({
    where: { developerAccountId: { in: accountIds } },
    select: { developerAccountId: true, developmentId: true, ratePercent: true },
  });
  return effectiveRates(devs, toRateRows(rows));
}
