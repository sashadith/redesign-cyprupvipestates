import { resolveRate, type RateRow } from "./commission";

// Pure half of the commission-rate lookup (2026-10-24) — safe in client
// components. The DB half is ./rateLookup.ts.

export type EffectiveRate = { ratePercent: number | null; source: "PROJECT" | "DEVELOPER" | "MISSING" };

export const RATE_SOURCE_SHORT: Record<EffectiveRate["source"], string> = { PROJECT: "project", DEVELOPER: "developer", MISSING: "not set" };

/** Projects + the rate rows of their accounts → the rate that applies per project id
    (project rate wins over the developer default — resolveRate()). */
export function effectiveRates(devs: { id: string; developerAccountId: string }[], rows: RateRow[]): Map<string, EffectiveRate> {
  return new Map(devs.map((d) => [d.id, resolveRate(rows, d.developerAccountId, d.id)]));
}

export const toRateRows = (rows: { developerAccountId: string; developmentId: string | null; ratePercent: { toNumber(): number } }[]): RateRow[] =>
  rows.map((r) => ({ developerAccountId: r.developerAccountId, developmentId: r.developmentId, ratePercent: r.ratePercent.toNumber() }));

/** "10 %" / "5.5 %" / "7.25 %"; "—" when no rate is set. */
export function fmtRate(r: number | null): string {
  if (r == null) return "—";
  return `${String(Math.round(r * 100) / 100)} %`;
}
