// Live "does this Development already have a legacy counterpart?" heuristic
// for the Publishing Queue — normalized-token Jaccard similarity between
// display names, the same style of match the 2026-07-15 merge audit used to
// build the frozen OVERLAP_CANDIDATES list (see the overlaps review page),
// but computed fresh here against whatever is currently published rather
// than a one-time snapshot. Purely advisory: a hint for the admin to go
// check, never used to auto-link or auto-suppress anything.
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const inter = Array.from(A).filter((t) => B.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
}

const MATCH_THRESHOLD = 0.34;

export type LegacyCounterpartMatch = { title: string; score: number } | null;

/** Best-scoring published legacy title for one Development name, or null if nothing clears the threshold. */
export function findLegacyCounterpart(devName: string, legacyTitles: string[]): LegacyCounterpartMatch {
  const devTokens = tokenize(devName);
  let best: LegacyCounterpartMatch = null;
  for (const title of legacyTitles) {
    const score = jaccard(devTokens, tokenize(title));
    if (score > 0 && (!best || score > best.score)) best = { title, score };
  }
  return best && best.score >= MATCH_THRESHOLD ? best : null;
}
