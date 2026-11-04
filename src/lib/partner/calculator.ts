// Commission calculator (partner portal phase 3d). Pure: the page passes only effective rates (same props
// rule as /projects), this multiplies them by a price. Whole euros, basis-point rounding like computeDealAmounts.
import type { MyProject } from "./scope";

export const MAX_PRICE = 100_000_000;

export type PayoutRow = {
  id: string;
  name: string;
  town: string | null;
  handover: number | null;
  fix: number | null;
  /** Our rate in % — only for trust-mode partners, null otherwise or when missing. */
  ourRate: number | null;
};

// price × percent / 100 in integer basis points (floats turn exact halves into x.4999…).
const percentOf = (price: number, percent: number) => Math.round((price * Math.round(percent * 100)) / 10000);

export function calculatePayouts(
  price: number,
  projects: Pick<MyProject, "id" | "name" | "town" | "handoverRate" | "fixRate" | "ourRate">[],
  opts: { trust: boolean },
): PayoutRow[] {
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    town: p.town,
    handover: p.handoverRate == null ? null : percentOf(price, p.handoverRate),
    fix: p.fixRate == null ? null : percentOf(price, p.fixRate),
    ourRate: opts.trust ? p.ourRate ?? null : null,
  }));
}

/** "1.250.000 €", "1,250,000", "€ 900 000" → whole euros; null when empty, not a number, 0 or above 100,000,000. */
export function parsePriceInput(s: string): number | null {
  const digits = String(s ?? "").replace(/[\s.,  '€]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const n = Number(digits);
  return n >= 1 && n <= MAX_PRICE ? n : null;
}
