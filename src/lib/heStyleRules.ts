/* The Hebrew copy style rules, as machine-checkable regexes.
 *
 * ONE list, TWO consumers:
 *   - this file, used by the AI translation pipeline (src/lib/ai/translateHe.ts)
 *     to reject a generated Hebrew string before it is ever written to a row;
 *   - `scripts/he-content/lib.mjs` (`STYLE_RULES` + `styleCheck`), used by the
 *     content-pack gate `scripts/qa/he-content-check.mjs` on authored JSON.
 *
 * The two copies must stay identical — same ids, same regex sources, same order.
 * `src/lib/__tests__/translateHe.test.ts` reads BOTH files and fails if they
 * drift. A rule added here without the same line in `lib.mjs` (or the other
 * way round) means a violation the queue rejects but the gate waves through, or
 * the reverse. The .mjs copy is deliberately duplicated rather than imported:
 * those scripts are self-contained plain JS with no `src/` imports and no tsx.
 *
 * Sources: docs/i18n/he-styleguide.md §4 (spelling and characters), §7 (banned
 * AI patterns) and §11 (Pass B learnings), plus the glossary's fixed spellings.
 */

export type HeStyleRule = {
  /** Stable id — used in violation strings and in the parity test. */
  id: string;
  /** Matches a VIOLATION (a hit means the text breaks the rule). */
  test: RegExp;
  /** English, one line: what is wrong and what to write instead. */
  message: string;
};

export const STYLE_RULES: HeStyleRule[] = [
  {
    id: "em-dash",
    test: /—/,
    message: "em dash is not used in Hebrew copy; use a comma, a period or a new sentence",
  },
  {
    id: "en-dash",
    test: /–/,
    message: "en dash is not used in Hebrew copy; use a comma, a period or a new sentence",
  },
  {
    id: "exclamation-mark",
    test: /!/,
    message: "no exclamation marks (styleguide §11.7)",
  },
  {
    id: "curly-quotes",
    test: /[“”‘’]/,
    message: "no curly quotes; Hebrew copy uses the straight double quote",
  },
  {
    id: "slash-gender-form",
    test: /\/[תה](?![֐-׿])/,
    message: "slash gender form is a last resort (styleguide §11.1); use the nominal or plural-participle register",
  },
  {
    id: "hakol-spelling",
    test: /הכול/,
    message: "spelling: write the short form, not the plene one",
  },
  {
    id: "loading-gerund",
    test: /בטעינה/,
    message: "gerund evasion (styleguide §11.2); use a plural participle or an impersonal construction",
  },
  {
    id: "sending-gerund",
    test: /בשליחה/,
    message: "gerund evasion (styleguide §11.2); use a plural participle or an impersonal construction",
  },
  {
    id: "notary",
    test: /נוטריון/,
    message: "Cyprus has no notary in a property purchase (styleguide §7); the lawyer signs",
  },
  {
    id: "safe-room",
    test: /ממ"ד/,
    message: "Israeli safe-room term does not exist in Cyprus property copy",
  },
  {
    id: "construction-companies",
    test: /חברות בנייה/,
    message: "glossary term: use the developer wording, not the Israeli construction-company one",
  },
  {
    id: "nadlan-gershayim",
    test: /נדל[^"]?ן/,
    message: 'the real-estate noun is spelled with a straight double quote (נדל"ן), never with a gershayim or bare',
  },
];

/** Every rule the string breaks, as `"<id>: <message>"`. Empty = clean. */
export function styleViolations(str: string): string[] {
  const text = String(str ?? "");
  if (!text) return [];
  return STYLE_RULES.filter((r) => r.test.test(text)).map((r) => `${r.id}: ${r.message}`);
}
