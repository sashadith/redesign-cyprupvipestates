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
//  - `allowYears`: a bare year (\b20\d{2}\b) is stripped before the digit
//    test. The site's own healthy pages carry years in their titles ("Cyprus
//    Property Taxes: Full Guide 2026") and banning them would reject the exact
//    pattern the site's best performers use. Prices, unit counts, quarters
//    ("Q4" still trips on the 4), sizes and street numbers stay banned. The
//    development generator does NOT pass this option — its figures drift with
//    every feed sync and the full ban stands.
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

export type CopyViolation = "digit" | "placeholder";

export function copyViolation(
  raw: string,
  opts?: { allowedName?: string; allowYears?: boolean; placeholders?: "known" | "none" },
): CopyViolation | null {
  const name = opts?.allowedName?.trim();
  let v = name ? raw.replace(new RegExp(escapeRe(name), "gi"), "") : raw;
  if (opts?.allowYears) v = v.replace(/\b20\d{2}\b/g, "");
  if (/\d/.test(v)) return "digit";
  // Two different questions, so two different patterns.
  //
  // "none" asks "is there a brace token at all", and must therefore accept any
  // contents: measured 2026-08-24, the \w class below matches neither
  // `{price-from}` nor `{price from}` nor `{a.b}`, so a near-miss spelling
  // would have passed silently and then appeared verbatim in a Google snippet
  // — the one outcome this mode exists to prevent.
  if (opts?.placeholders === "none") return /\{[^}]*\}/.test(v) ? "placeholder" : null;
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
