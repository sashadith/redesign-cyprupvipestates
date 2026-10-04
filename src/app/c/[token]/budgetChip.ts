// The "your preferences" budget chip of /c/[token], lifted out of page.tsx so
// it can be tested without the page's Prisma/Next imports.
//
// It must stay lazy about formatting: a one-sided budget ("Over €2,000,000",
// "Up to €200,000" — both offered by qualifierFields.ts) leaves the other
// bound `null`, and eagerly building the two-sided range crashed the whole
// page in every locale (final review C1).
import { ltrIsolate } from "@/lib/locale";
import type { PLocale } from "./copy";

const fmt = (n: number) => `€${n.toLocaleString("en-US")}`;

export type BudgetChipLabels = { budgetFrom: string; budgetUpTo: string };

/**
 * Returns the chip text for a criteria budget, or `null` when neither bound is
 * set (no chip). `he`: the en dash is banned (styleguide §3) and the range
 * renders without spaces inside one LRI run so the RTL paragraph can't swap
 * its ends (Pass B Should fix #19). The lower-bound chip uses `budgetFrom`,
 * NOT the card's `priceFrom` — it is the client's budget floor, not an asking
 * price (Must fix #14); the two are byte-identical in en/de/pl/ru.
 */
export function budgetChip(
  locale: PLocale,
  budgetMin: number | null | undefined,
  budgetMax: number | null | undefined,
  labels: BudgetChipLabels,
): string | null {
  if (budgetMin != null && budgetMax != null) {
    return locale === "he"
      ? ltrIsolate(`${fmt(budgetMin)}-${fmt(budgetMax)}`)
      : `${fmt(budgetMin)} – ${fmt(budgetMax)}`;
  }
  if (budgetMin != null) return `${labels.budgetFrom} ${fmt(budgetMin)}`;
  if (budgetMax != null) return `${labels.budgetUpTo} ${fmt(budgetMax)}`;
  return null;
}
