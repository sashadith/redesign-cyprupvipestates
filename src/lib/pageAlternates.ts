/* The hreflang URL of a landing page's sibling in another language.

   languageAlternates-style code only knows the sibling's LEAF slug. Two ways that went wrong (both seen as a
   redirecting hreflang target, 2026-10-23):
   - a top-level page assumed its siblings were top-level too: /pl/wille-rodzinne-cypr advertised "/family-villas"
     for English, but that page lives at /villas-in-cyprus/family-villas;
   - a sibling that was merged into another page (still PUBLISHED, its URL 301s) was advertised anyway:
     /beachfront-villas-cyprus pointed at /pl/wille-przy-plazy-cypr.
   The path therefore comes from the full path tree of the sibling's language, and a merged page yields none. */

/** `paths` is getAllPathsForLang(lang): every PUBLISHED page as its full segment list. `merged` is that language's
 *  flat merge map (middleware's *_LANDING_MERGES): only a flat, single-segment path is ever a merge key. */
export function siblingAlternatePath(paths: string[][], leaf: string, merged?: Record<string, string>): string[] | null {
  const match = paths.find((p) => p[p.length - 1] === leaf);
  if (!match) return null;
  if (match.length === 1 && merged?.[match[0]]) return null;
  return match;
}
