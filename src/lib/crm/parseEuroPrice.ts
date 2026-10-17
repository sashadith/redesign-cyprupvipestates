// Whole-euro price typed into the deal dialog (2026-10-18). Accepts plain digits
// or digit groups of three separated by a space, dot or comma ("412 000",
// "412.000", "412,000"); anything else (cents, letters, ragged groups) is null.
export function parseEuroPrice(raw: string): number | null {
  const s = raw.trim().replace(/^€\s*/, "");
  if (!/^\d+$/.test(s) && !/^\d{1,3}(?:[ .,  ]\d{3})+$/.test(s)) return null;
  const n = Number(s.replace(/\D/g, ""));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
