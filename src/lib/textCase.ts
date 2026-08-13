// Every project/development name gets Title Case, regardless of how the
// source delivers it — Dropbox/Drive folder names, XML feeds, PDF headers,
// AI extraction (2026-08-13, GROSSER AUFTRAG / Kuutio decision, a standing
// rule for every adapter, not just Dropbox). Apply this at the point each
// adapter first derives a name from raw source text, BEFORE any OVERRIDES
// lookup — an admin-set override name is a deliberate choice and is never
// re-cased.
//
// Capitalizes the first letter following any non-letter character (string
// start, space, digit, punctuation) — deliberately NOT a plain \b\w regex,
// which fails on alphanumeric unit-style labels: digits and letters share a
// \w word boundary, so \b\w only capitalizes the leading digit and silently
// leaves "1A" as "1a". No exception list for connector words ("of"/"and"/
// "the") — every word capitalizes, matching the rule literally as specified.
export function toTitleCaseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[^a-zà-öø-ÿ])([a-zà-öø-ÿ])/gi, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}
