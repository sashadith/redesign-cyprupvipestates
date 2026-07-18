// Structured mirror of docs/SITE-CHANGELOG.md, fed into the SEO Advisor's
// gather step — the doc is the human-readable record (update both when
// adding an entry); this array is what the Advisor's payload actually reads,
// since parsing markdown at runtime for a handful of entries isn't worth the
// fragility. Add an entry whenever a routing/content change could plausibly
// shift GSC metrics for reasons other than ranking quality.
export type ChangelogEntry = { date: string; summary: string };

export const SITE_CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-07-16",
    summary: "Unified /projects listing: merged legacy Sanity Project listing with the Development system, deduped superseded rows. Listing page only, no detail-page URL changes.",
  },
  {
    date: "2026-07-17",
    summary: "URL unification: /projects/[slug] became a single dispatcher (published Development first, legacy Project fallback); /preview-project/[slug] retired to a 301 stub; NEW_PROJECTS_INDEXABLE flipped on. 96 legacy project URLs archived same day, each 301-redirecting to its linked Development's URL (100 total archived to date) — expect their traffic migrating to the new URL for weeks after.",
  },
  {
    date: "2026-07-18",
    summary: "Two changes: (1) fixed shared card-building resolvers that were linking through an avoidable 308 hop to superseded pages instead of the current URL directly (~1/3 of crawled pages affected) — site-wide internal-link-equity shift, not any one page's content changing. (2) Title/meta sweep: 17 pages individually rewritten + 13-page developer-profile template reformula, each in a 42-day re-measurement window through 2026-08-29 — do not suggest touching any URL still in that window.",
  },
];

export function getRecentChangelogEntries(days: number, now = new Date()): ChangelogEntry[] {
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  return SITE_CHANGELOG.filter((e) => new Date(e.date) >= cutoff);
}
