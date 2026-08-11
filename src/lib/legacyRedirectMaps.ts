// Shared with src/middleware.ts (which applies these 301s) and
// src/app/sitemaps/[type]/route.ts's blog/pages generators (which must skip
// emitting a URL that immediately redirects away — GSC audit 2026-08-11:
// both retired-article and merged-landing-page URLs were still listed in
// blog.xml/pages.xml despite 301ing, since the sitemap generators only ever
// checked DB `status` and had no way to know about a redirect that isn't
// reflected there at all. Moved here from middleware.ts so there's exactly
// one list each side reads — a generator with its own copy could drift from
// what middleware.ts actually redirects, silently reintroducing this bug in
// the opposite direction (a URL the generator thinks is retired but
// middleware no longer redirects).
//
// Both maps are keyed by the DE leaf path (no /de/ prefix, no leading
// slash) — every entry here is DE-only content (see each map's own history);
// a nested page's key is its full parent/child segment path joined by "/",
// matching how src/app/sitemaps/[type]/route.ts's generatePagesSitemap joins
// getAllPathsForLang's segments.

// German landing-page cluster consolidation (2026-07-28): thin-wrapper
// landing pages merged into their canonical target, confirmed by identical
// live-query config (filterCity/filterPropertyType) or a direct (city,
// propertyType) collision with an existing hub child — not just similar
// copy — see docs/SITE-CHANGELOG.md. Keyed by the DE leaf path (no /de/
// prefix); this covers anyone hitting the /de/ URL directly (already
// indexed/bookmarked/linked). The root-level legacy twin for each of these
// is handled by the nginx cvp_de_only map/exact-match locations
// (ops/nginx/cyprusvipestates.conf) — kept in sync so no path ever chains
// through both hops.
//
// haeuser-auf-zypern's merged children also need their FLAT leaf slug
// (in addition to the nested path): nestedPageRedirects.json already 308s
// the flat form to the nested "canonical" one for those exact leaves, and
// this check runs before that logic — without the flat entry, a flat hit
// would chain through the nested-canonicalisation 308 before ever reaching
// this 301, a two-hop redirect for anyone who reaches the page via its bare
// leaf slug. haeuser-in-limassol-kaufen is deliberately NOT here — held out,
// its untyped-Limassol duplication is a separate question.
export const DE_LANDING_MERGES: Record<string, string> = {
  "grosse-villen-zypern": "/de/luxusvillen-in-zypern",
  "haeuser-auf-zypern": "/de/luxusvillen-in-zypern",
  "haeuser-auf-zypern/haeuser-in-zypern-fuer-investoren": "/de/luxusvillen-in-zypern",
  "haeuser-in-zypern-fuer-investoren": "/de/luxusvillen-in-zypern",
  "haeuser-auf-zypern/haus-mit-pool-auf-zypern": "/de/luxusvillen-in-zypern",
  "haus-mit-pool-auf-zypern": "/de/luxusvillen-in-zypern",
  "haeuser-auf-zypern/luxus-haeuser-zum-verkauf-in-paphos": "/de/luxusvillen-in-zypern",
  "luxus-haeuser-zum-verkauf-in-paphos": "/de/luxusvillen-in-zypern",
  "haeuser-auf-zypern/strandhaus-auf-zypern": "/de/strandvillen-zypern",
  "strandhaus-auf-zypern": "/de/strandvillen-zypern",
};

// Retired DE blog articles — same shape/mechanism as DE_LANDING_MERGES above
// (a plain map, checked first, single-hop 301), kept as its own map because
// it's a different content type/retirement reason, not landing-page
// consolidation. Unconditional on the article's DB publish status: once this
// ships, the old URL redirects immediately, even while the row is still
// PUBLISHED — that's intentional, so the redirect can go out ahead of the
// unpublish with no 404 gap. Keyed the same way: "blog/<slug>", no /de/
// prefix.
export const RETIRED_BLOG_REDIRECTS: Record<string, string> = {
  "blog/mieteinnahmen-aus-deutschland-in-zypern-versteuern": "/de/blog/immobilien-zypern-mit-garantierten-mieteinnahmen",
};
