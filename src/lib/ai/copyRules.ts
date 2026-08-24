import { SEO_PLACEHOLDERS } from "@/lib/seoPlaceholders";

// The digit/placeholder rule as ONE function, because it now has two consumers
// and a rule with two copies drifts. Extracted 2026-08-24 from seoMeta.ts's
// badFields() (where it was written against the stored-figure incident: the
// 2026-08-20 audit found 26 of 128 published developments advertising stale
// figures, one a price €30,000 BELOW the real one). The Page Improver applies
// the same rule to blog/singlepage/developer/caseStudy meta — with two
// deliberate differences expressed through the options, never through a fork
// of the logic:
//
//  - `allowYears`: a bare year from ALLOWED_YEARS is stripped before the digit
//    test. The site's own healthy pages carry years in their titles ("Cyprus
//    Property Taxes: Full Guide 2026") and banning them would reject the exact
//    pattern the site's best performers use. The development generator does NOT
//    pass this option — its figures drift with every feed sync and the full ban
//    stands.
//
//    Be precise about what this costs, because the first draft of this comment
//    was wrong about it: stripping years does NOT keep "sizes and street
//    numbers banned". Any figure that happens to BE an allowed year passes —
//    "2026 Griva Digeni Avenue" and "2024 units left" both slip through, and
//    "2050 m²" did too while the band was the full 20\d\d. The band is
//    therefore kept to the years this copy could plausibly carry rather than a
//    century of them, which is the difference between ~7 values of
//    false-negative surface and 100. Widen it when the calendar demands, not
//    for convenience. Note also that "2000 m2" is caught only by the "2" in
//    "m2" — write the site's own "m²" and that accident disappears.
//
//  - `placeholders: "none"`: {priceFrom} & co. resolve ONLY on the Development
//    render path (developmentSeo.ts). A blog page's generateMetadata reads
//    seo.metaTitle raw, so a placeholder written there would appear verbatim
//    in a Google snippet. For those kinds any {token} is a violation, not just
//    an unknown one.
//
// `allowedName` is not one of those differences — both consumers pass it, and it
// predates the extraction: a digit in the SUBJECT'S OWN NAME is not a figure.
// Several developments are numbered — Glow 2, Abiete 2, Avalon Gardens 2,
// Roseland Villas 1 — and a bare /\d/ check rejects every possible sentence
// about them, making "Generate with Claude" permanently impossible for those
// projects. The name is stripped before the digit test, never from the text that
// gets stored.
const KNOWN_PLACEHOLDERS = new Set<string>(SEO_PLACEHOLDERS);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The years `allowYears` tolerates. Deliberately narrow: every value here is
 *  a figure the digit ban stops seeing, so the band is the exception's real
 *  cost. 2024-2030 covers "Guide 2026" and a forward-looking outlook piece;
 *  it does not cover a 2050 m² plot. Revisit when the calendar reaches the
 *  upper bound (set 2026-08-24). */
const ALLOWED_YEARS = /\b20(?:2[4-9]|30)\b/g;

export type CopyViolation = "digit" | "placeholder";

export function copyViolation(
  raw: string,
  opts?: { allowedName?: string; allowYears?: boolean; placeholders?: "known" | "none" },
): CopyViolation | null {
  const name = opts?.allowedName?.trim();
  let v = name ? raw.replace(new RegExp(escapeRe(name), "gi"), "") : raw;
  if (opts?.allowYears) v = v.replace(ALLOWED_YEARS, "");
  if (/\d/.test(v)) return "digit";
  // Two different questions, so two different patterns.
  //
  // "none" asks "is there anything brace-shaped here at all", so it tests for a
  // BRACE, not for a well-formed token. Both narrower spellings were tried and
  // both were wrong: the \w class below matches neither `{price-from}` nor
  // `{price from}` nor `{a.b}`, and `/\{[^}]*\}/` still missed an UNCLOSED
  // one — which is the malformation this repo has actually seen, Golden Hills
  // generating "… From {priceF…" (recorded in seoMeta.ts's clamp comment).
  // On the development path a half-token is caught downstream, because
  // developmentSeo.ts treats a stray `{` or `}` as unresolved and falls back to
  // auto text. On the blog/singlepage path nothing does — generateMetadata
  // reads seo.metaTitle raw — which is the whole premise of this mode.
  if (opts?.placeholders === "none") return /[{}]/.test(v) ? "placeholder" : null;
  // Ordering note, latent today: year-stripping happens BEFORE this scan and
  // rewrites `v`, so `allowYears` WITHOUT `placeholders: "none"` lets
  // "{priceFrom 2026}" through — the strip breaks the token apart. No consumer
  // passes that combination (Task 5's kinds pair the two), and pairing them is
  // the intended use; a future caller that wants years but not the brace ban
  // must scan the raw string instead.
  //
  // "known" (the default, and the development generator's path) asks the
  // narrower question "is this one of OUR tokens", and keeps \w deliberately:
  // widening it here would change what seoMeta.ts rejects, and that generator's
  // behaviour is calibrated. A malformed token there is caught downstream
  // anyway — resolveMetaDescription discards copy carrying one.
  let m: RegExpExecArray | null;
  const re = /\{(\w*)\}/g;
  while ((m = re.exec(v)) !== null) {
    if (!KNOWN_PLACEHOLDERS.has(m[1])) return "placeholder";
  }
  return null;
}
