// Budget input parsing for the partner Submit form. Pure and dependency-free so the client
// component (estimate line) and the server action share one rule.

/**
 * Whole-euro amount typed by a partner. Spaces, dots, commas, apostrophes and "€" are
 * thousands decoration and are stripped ("250.000 €" → 250000). Anything else is invalid,
 * including a trailing 1–2 digit decimal part ("250,000.50"), which would otherwise turn
 * into a hundred times the amount. Empty → null (field absent).
 */
export function parseBudgetField(raw: string | null | undefined): number | null | "invalid" {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (s.length > 24) return "invalid";
  if (/[.,]\d{1,2}\s*€?$/.test(s)) return "invalid";
  const digits = s.replace(/[\s  .,'’€]/g, "");
  if (!digits) return null;
  if (!/^\d{1,12}$/.test(digits)) return "invalid";
  return Number(digits);
}
