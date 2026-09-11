import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import { defaultLocale, locales } from "@/i18n.config";
import nestedPageRedirects from "@/lib/nestedPageRedirects.json";
import { CORPORATE_SLUGS } from "@/lib/corporatePageSlugs";
import { EN_REDIRECT_TITLE_SWEEP_EXCLUDE } from "@/lib/seo/enRedirectTitleSweepExclude";

// Reserved first segments that are their own route, not singlepages — never canonicalised here.
const RESERVED = new Set(["projects", "blog", "developers", "case-studies", "files", "partners"]);
const ALL_LOCALES = ["en", "de", "pl", "ru"];

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
// A merged page's nested children (e.g. villen-in-paphos, still merged
// below) also need their FLAT leaf slug in addition to the nested path:
// nestedPageRedirects.json already 308s the flat form to the nested
// "canonical" one for those exact leaves, and this check runs before that
// logic — without the flat entry, a flat hit would chain through the
// nested-canonicalisation 308 before ever reaching this 301, a two-hop
// redirect for anyone who reaches the page via its bare leaf slug.
// haeuser-in-limassol-kaufen is deliberately NOT here — held out, its
// untyped-Limassol duplication is a separate question (and its former
// sibling, the rest of the Häuser cluster, is no longer merged at all —
// see 2026-09-11 below).
//
// AFTER ADDING AN ENTRY, clear the links that still point at the merged page.
// Other singlepages keep it in relatedLandingPages, and those render as real
// links to a URL that now 301s — the site links through a redirect to a page
// that already links back. Nothing warns about it: the renderer filters on
// status: PUBLISHED, and a merged page is still published, so the entry stays
// valid-looking forever.
//
// Found on 2026-09-03, sweeping the rendered links of all 152 landing pages:
// ten such links had accumulated — six on /de/luxusvillen-in-zypern itself,
// pointing back at pages merged into it, and four spread over
// immobilien-in-limassol, meerblick-immobilien-limassol,
// haeuser-in-limassol-kaufen and haeuser-in-zypern. All removed; the sweep now
// reports 809 links across 136 targets, every one of them 200.
//
// The check is a sweep, not a query: read relatedLandingPages from the DB and
// you get the stored refs, which resolve to canonical paths only at render
// time — asking the database gives false positives in both directions. Fetch
// the pages and test the hrefs they actually emit.
const DE_LANDING_MERGES: Record<string, string> = {
  "grosse-villen-zypern": "/de/luxusvillen-in-zypern",

  // 2026-09-11: the "Häuser" cluster's 2026-07-28 merge into the villa
  // flagship (5 entries: haeuser-auf-zypern + 4 children) is REVERSED — see
  // docs/SITE-CHANGELOG.md, 2026-09-11. DataForSEO search volume shows "haus
  // zypern kaufen" (3600/mo) at 7.5x the flagship's own "villa zypern
  // kaufen" (480/mo); the merge rationale (identical filterPropertyType=
  // Villa/no-city live query, or a stale project-overlap percentage against
  // pages later found 0% live) is the same mechanical-identity mistake the
  // luxusimmobilien-auf-zypern reversal below already documents -- shared
  // inventory query isn't shared search intent. All 5 pages read with real,
  // differentiated content (general/investor/pool/Paphos-luxury/beach
  // angles). Un-redirected here, in ops/nginx/cyprusvipestates.conf (root-
  // level legacy twin), and nestedPageRedirects.json is unaffected (it only
  // canonicalizes the flat leaf -> nested path for these same children, not
  // a merge). haeuser-in-limassol-kaufen stays out of scope, as it always
  // was -- its own untyped-Limassol duplication is a separate question.

  // German villa-cluster consolidation (2026-09-01): four pages collapsed
  // into the flagship, confirmed duplicate by DIRECT INVENTORY SET
  // COMPARISON, not just similar copy -- villen-in-zypern-fuer-investoren,
  // villen-auf-zypern-fuer-auswanderer, and
  // villen-zypern-aufenthaltstitel-provisionsfrei all query nothing but
  // filterPropertyType:"Villa" (no city) and render the byte-identical
  // 130-listing set as luxusvillen-in-zypern's own live-query siblings did
  // before this merge -- three titles, one query. luxusvillen-in-zypern/
  // villen-in-paphos (a projectsSectionBlock fixed list) rendered a set
  // byte-identical to its own parent page, not a Paphos-filtered subset --
  // there was no independent page to preserve. Both the nested and flat
  // leaf forms of villen-in-paphos are included: without the flat entry, a
  // flat hit chains through nestedPageRedirects.json's 308 before ever
  // reaching this 301, a two-hop redirect for anyone who reaches the page
  // via its bare leaf slug (same reasoning the now-reversed Häuser-cluster
  // entries above used to document, before 2026-09-11).
  "villen-in-zypern-fuer-investoren": "/de/luxusvillen-in-zypern",
  "villen-auf-zypern-fuer-auswanderer": "/de/luxusvillen-in-zypern",
  "villen-zypern-aufenthaltstitel-provisionsfrei": "/de/luxusvillen-in-zypern",
  "luxusvillen-in-zypern/villen-in-paphos": "/de/luxusvillen-in-zypern",
  "villen-in-paphos": "/de/luxusvillen-in-zypern",
  // luxusimmobilien-auf-zypern was merged here 2026-09-03 (commit 714ce20) on
  // GSC query-overlap evidence -- reversed 2026-09-09: the query it actually
  // owned, "luxusimmobilien zypern", held position ~5 on the retired page
  // throughout, while this flagship's own position on that exact query went
  // 25 -> 74 -> 55 after absorbing it. The merge cost the cluster its best
  // German position on that term and gained nothing measurable in return. See
  // docs/SITE-CHANGELOG.md, 2026-09-09, for the position data.
  /* Same evidence as luxusimmobilien-auf-zypern's case above (see that page's
     own history): 555 of its 560 impressions came from queries
     /de/luxusvillen-in-zypern also served and ranked better for — 5 were its
     own. Position 45.5 against the target's 18.4.

     Its list looked like the stronger argument to keep it — 11 pins the target
     did not have, all genuinely above €1M. Only 3 of those render: Küünal
     Villas, El Pez and Zeus Villas. The other 8 point at archived projects, so
     the page has been showing 16 cards for 19 pins. The three are on the target
     now, and the target's own link to this page is gone (see the note above). */
  "luxusvillen-zypern-ueber-1-mio": "/de/luxusvillen-in-zypern",

  // German apartment-cluster consolidation (2026-09-08): same shape as the
  // villa cluster above, same test. /de/apartment-zypern was confirmed the
  // flagship — best URL, broadest GSC query footprint (18 distinct queries
  // over the period, vs. a handful or zero for the others), most inbound
  // links — after its own 15 pins turned out 15/15 archived and were replaced
  // with a live filterPropertyType:"Apartment" query.
  // wohnungen-fuer-junge-familien-zypern: zero filtering beyond
  // propertyType:"Apartment" (no bedroom/family-amenity signal despite the
  // slug), zero inbound links anywhere on the DE site, and its only ranking
  // queries were Paphos apartment-buying terms it shares with (and loses to)
  // apartment-zypern/wohnungen-in-paphos — not a distinct family-buyer
  // audience, just an unfiltered duplicate borrowing someone else's intent.
  // wohnungen-auf-zypern-fuer-investoren: same zero-filtering gap ("für
  // Investoren" promises nothing an investor-specific query would match), and
  // its own block heading even mislabeled itself "Die besten Villen" on an
  // apartments page. Zero GSC impressions in the period — invisible in
  // search, not just weak. relatedLandingPages entries pointing at either
  // page were swept from every live DE singlepage first (see the writeup);
  // no hardcoded hrefs to either page existed outside that one already-
  // ARCHIVED reference on renditeimmobilien-zypern, left as-is since that
  // page cannot render.
  "wohnungen-fuer-junge-familien-zypern": "/de/apartment-zypern",
  "wohnungen-auf-zypern-fuer-investoren": "/de/apartment-zypern",

  // Paphos investment cluster (2026-09-09): investment-immobilien-paphos
  // never filtered on propertyType despite its "investment" framing — it
  // was just every Paphos listing (198 matches, 60 rendered under the cap)
  // with investment-flavored copy, no per-listing investment data behind
  // it (investmentData is 0/407 populated site-wide, and the ROI
  // calculator runs on city+type market presets, not per-listing facts —
  // the promise this page made can't be backed now or later). Repointed
  // to villen-paphos-investoren-kaufen, DE's only live Paphos+Villa page —
  // narrower (98 matches) and the one page actually scoped to what an
  // investor-framed page should be selling. villen-in-paphos, the more
  // "general Paphos villas" alternative, was ruled out: already merged
  // into luxusvillen-in-zypern above, not a live option. The one hardcoded
  // link to the retiring page (from strandimmobilien-paphos) was
  // repointed directly to the new target first.
  "investment-immobilien-paphos": "/de/villen-paphos-investoren-kaufen",
};

// Retired DE blog articles — same shape/mechanism as DE_LANDING_MERGES above
// (a plain map, checked first, single-hop 301), kept as its own block because
// it's a different content type/retirement reason, not landing-page
// consolidation. Unconditional on the article's DB publish status: once this
// ships, the old URL redirects immediately, even while the row is still
// PUBLISHED — that's intentional, so the redirect can go out ahead of the
// unpublish with no 404 gap.
const RETIRED_BLOG_REDIRECTS: Record<string, string> = {
  "blog/mieteinnahmen-aus-deutschland-in-zypern-versteuern": "/de/blog/immobilien-zypern-mit-garantierten-mieteinnahmen",
};

// English (unprefixed) landing-page merges — same shape/mechanism as
// DE_LANDING_MERGES above, kept separate because DE_LANDING_MERGES is only
// ever checked under the /de/ prefix. First entry (2026-08-12):
// villas-limassol merged into houses-in-limassol — confirmed duplicate via
// the landing-page type-filter investigation: both resolve to the identical
// Limassol+Villa filtered inventory once each is correctly configured, and
// villas-limassol has no locale siblings of its own (EN-only page, separate
// translationGroupId from the houses-in-limassol group). Same unconditional-
// on-DB-status behavior as RETIRED_BLOG_REDIRECTS — ships ahead of the
// unpublish so there's no 404 gap.
// Second entry (2026-08-27): west-coast-properties-cyprus merged into
// west-coast-properties-paphos -- confirmed cannibalization via GSC query
// data (Paphos cluster investigation): both pages target identical
// filterCity:"Paphos" criteria under different slugs, and paphos wins all
// 9/9 shared "west coast" queries on position (paphos pos 6.6-18.6 vs
// cyprus pos 8-65 on the same terms). Unlike villas-limassol above, this
// merge ALSO archives the losing Singlepage's status (see
// scripts/tmp-westcoast-cyprus-redirect.mjs) so it drops out of the
// sitemap -- villas-limassol was left PUBLISHED after its merge (confirmed
// still status:"PUBLISHED"), so it's still sitemap-listed despite
// redirecting (see src/app/sitemaps/[type]/route.ts, PUBLISHED-only
// filter); not replicated here.
const EN_LANDING_MERGES: Record<string, string> = {
  "villas-limassol": "/houses-in-cyprus/houses-in-limassol",
  "west-coast-properties-cyprus": "/west-coast-properties-paphos",
};

// Paphos investment cluster, PL leg (2026-09-09) — same investigation and
// same reasoning as the DE entry above: inwestycje-w-nieruchomosci-pafos
// never filtered on propertyType despite its "investment" framing (198
// Paphos-wide matches, 60 rendered under the cap), and no per-listing
// investment data exists to back that promise (investmentData is 0/407
// populated site-wide). Redirects to wille-na-sprzedaz-pafos-dla-inwestorow,
// PL's one live Paphos+Villa page. First PL entry in this family of maps —
// same shape/mechanism as DE_LANDING_MERGES, kept separate because that one
// is only ever checked under the /de/ prefix.
const PL_LANDING_MERGES: Record<string, string> = {
  "inwestycje-w-nieruchomosci-pafos": "/pl/wille-na-sprzedaz-pafos-dla-inwestorow",

  // PL villa cluster consolidation (2026-09-10): 9 separate villa landing
  // pages were collectively pulling ~46 impressions / 2 clicks over 60 days
  // (GSC), vs. DE's single consolidated flagship pulling hundreds of
  // impressions per query for the equivalent cluster. Two of these six had a
  // worse defect than plain fragmentation: 0-of-21 pinned project refs were
  // PUBLISHED (same render-vs-status bug documented for the DE flagship
  // above), rendering only because an implicit fallback query happened to
  // paper over it. The other four had a live filterPropertyType:"Villa" query
  // but zero real differentiation beyond marketing copy (investor/large/
  // emigration/residency angles, no actual filter behind any of them) — the
  // same "unfiltered duplicate" pattern as DE's wohnungen-fuer-junge-
  // rodzin-zypern precedent. wille-na-cyprze was picked as the flagship (best
  // URL, Cyprus-wide "villas" framing) and its own dead pins were fixed to a
  // live filterPropertyType:"Villa" query in the same pass. NOT merged here,
  // kept as distinct pages because each has a real, live-query differentiator:
  // luksusowe-wille-na-cyprze-powyzej-1-mln-euro (priceMin 1M),
  // wille-na-sprzedaz-pafos-dla-inwestorow (filterCity Paphos, already the
  // established PL Paphos+Villa target above), wille-w-limassol-na-inwestycje
  // (filterCity Limassol). relatedLandingPages refs and the 3 known hardcoded
  // body-text links across the PL site were repointed to the flagship in the
  // same pass, not left to rely solely on this redirect.
  "wille-w-pafos": "/pl/wille-na-cyprze",
  "wille-przy-plazy-cypr": "/pl/wille-na-cyprze",
  "wille-na-cyprze-dla-inwestorow": "/pl/wille-na-cyprze",
  "duze-wille-na-cyprze": "/pl/wille-na-cyprze",
  "wille-na-cyprze-dla-emigracji": "/pl/wille-na-cyprze",
  "wille-na-cyprze-na-pobyt-staly-bez-prowizji": "/pl/wille-na-cyprze",

  // PL "dom" cluster consolidation (2026-09-11): domy-na-cyprze had the same
  // 0-of-21-pinned-refs-PUBLISHED defect as the villa flagship, and was
  // already the single highest-impression PL property page (285/60d) despite
  // it -- position ~33, the biggest single opportunity found in the whole PL
  // audit. Fixed to the same live filterPropertyType:"Villa" query as
  // wille-na-cyprze. Deliberately the SAME query, not a code change to also
  // pull Townhouse inventory (excludePropertyTypes isn't wired into this
  // render path's live-query trigger -- would need resolveBlocks/usingFiltered/
  // MIN_LIVE_RESULTS changes in sanity.utils.ts and [...slug]/page.tsx for
  // one page's benefit, out of scope here). Kept as a separate page from
  // wille-na-cyprze anyway: "dom" (260 vol) and "willa" (30-50 vol) are
  // confirmed-distinct search vocabularies in DataForSEO data, not a
  // duplicate audience -- same relationship as DE's Haus/Villa pillars,
  // which also serve overlapping inventory under different query terms.
  // domy-na-cyprze-dla-inwestorow and sprzedaz-domow-na-cyprze carried the
  // identical unfiltered filterPropertyType:"Villa" query with no real
  // differentiation behind the marketing angle -- same pattern as the villa
  // cluster's own investor/emigration/residency duplicates. domy-z-basenem-
  // na-cyprze ("houses with a pool") promised a pool filter the schema has
  // no field for, so it was running the same unfiltered query too. Kept
  // separate: domy-w-limassol (filterCity Limassol, real differentiator) --
  // it's a CHILD page nested under sprzedaz-domow-na-cyprze's slug
  // (/pl/sprzedaz-domow-na-cyprze/domy-w-limassol); this redirect only
  // matches the exact flat parent path, so the child's own nested URL is
  // unaffected and keeps resolving normally.
  "domy-na-cyprze-dla-inwestorow": "/pl/domy-na-cyprze",
  "sprzedaz-domow-na-cyprze": "/pl/domy-na-cyprze",
  "domy-z-basenem-na-cyprze": "/pl/domy-na-cyprze",

  // PL apartment/mieszkanie cluster consolidation (2026-09-11): same shape as
  // the villa and dom clusters above. apartamenty-na-cyprze had 15/15 pinned
  // refs with 0 PUBLISHED -- fixed to a live filterPropertyType:"Apartment"
  // query. mieszkania-w-pafos-na-sprzedaz (its own child page, filterCity
  // Paphos) had the identical dead-pin defect on an otherwise-correct live
  // filter -- fixed in place, not merged, kept as its own page.
  // apartamenty-na-cyprze-dla-inwestorow, apartamenty-na-cyprze-do-
  // przeprowadzki, and mieszkania-dla-mlodych-rodzin-cypr all ran the
  // identical unfiltered filterPropertyType:"Apartment" query with no real
  // criteria behind the investor/moving/young-family framing -- the second
  // and third are near-verbatim matches of the exact DE precedent that
  // justified merging wohnungen-auf-zypern-fuer-investoren and wohnungen-
  // fuer-junge-familien-zypern into apartment-zypern. Kept separate:
  // mieszkania-w-limassol (filterCity Limassol, real differentiator, and PL's
  // 2nd-highest-impression property page at 96/60d -- weak position, not a
  // fragmentation problem, left alone here).
  "apartamenty-na-cyprze-dla-inwestorow": "/pl/apartamenty-na-cyprze",
  "apartamenty-na-cyprze-do-przeprowadzki": "/pl/apartamenty-na-cyprze",
  "mieszkania-dla-mlodych-rodzin-cypr": "/pl/apartamenty-na-cyprze",
};

// Paphos investment cluster, RU leg (2026-09-09) — completes the DE/PL work
// above. investitsii-v-nedvizhimost-pafos never filtered on propertyType,
// same defect, same fix: redirect to villy-v-pafose-dlya-investorov, RU's
// one live Paphos+Villa page. That target is itself a live Track 1
// internal-link target — nothing about the target page changes here, it
// only gains one more inbound redirect.
const RU_LANDING_MERGES: Record<string, string> = {
  "investitsii-v-nedvizhimost-pafos": "/ru/villy-v-pafose-dlya-investorov",

  // RU "dom" cluster consolidation (2026-09-11): unlike the RU villa cluster
  // audited the same day (where every candidate page turned out to carry
  // real, distinct content -- see docs/SITE-CHANGELOG.md -- and none were
  // merged), doma-na-kipre and prodazha-domov-na-kipre are a genuine
  // near-duplicate pair: both target the same generic "buy a house in
  // Cyprus" intent with no real distinct audience or angle behind either
  // title, unlike the villa cluster's investor/emigration/VNZH/size/beach
  // pages, which each had real differentiating content (yields, legal
  // specifics, dimensions, proximity). doma-na-kipre-dlya-investorov's own
  // differentiation was thin in a different way: not a real investor-
  // specific case (no yield data, unlike the villa investment page), just a
  // named list of 3 partner developers (AGG Luxury Homes, Korantina Homes,
  // Mito Developers) -- content that duplicates what /developers already
  // does. The city-by-city breakdown from prodazha-domov-na-kipre and the
  // 3 developer links from doma-na-kipre-dlya-investorov were both merged
  // into doma-na-kipre's own content before this redirect went in, not
  // simply discarded. Kept separate: doma-na-kipre-s-basseinom (its own
  // real "houses with a pool" angle, already the site's best-performing
  // "dom" page at 326 impressions/60d) and doma-v-limassole (real filterCity
  // Limassol differentiator) -- both children nested under doma-na-kipre,
  // unaffected by this flat-path-only redirect.
  "prodazha-domov-na-kipre": "/ru/doma-na-kipre",
  "doma-na-kipre-dlya-investorov": "/ru/doma-na-kipre",
};

export default async function middleware(request: NextRequest) {
  const deMergeMatch = request.nextUrl.pathname.match(/^\/de\/(.+)$/);
  if (deMergeMatch && DE_LANDING_MERGES[deMergeMatch[1]]) {
    const url = request.nextUrl.clone();
    url.pathname = DE_LANDING_MERGES[deMergeMatch[1]];
    url.search = "";
    return NextResponse.redirect(url, 301);
  }
  if (deMergeMatch && RETIRED_BLOG_REDIRECTS[deMergeMatch[1]]) {
    const url = request.nextUrl.clone();
    url.pathname = RETIRED_BLOG_REDIRECTS[deMergeMatch[1]];
    url.search = "";
    return NextResponse.redirect(url, 301);
  }
  const plMergeMatch = request.nextUrl.pathname.match(/^\/pl\/(.+)$/);
  if (plMergeMatch && PL_LANDING_MERGES[plMergeMatch[1]]) {
    const url = request.nextUrl.clone();
    url.pathname = PL_LANDING_MERGES[plMergeMatch[1]];
    url.search = "";
    return NextResponse.redirect(url, 301);
  }
  const ruMergeMatch = request.nextUrl.pathname.match(/^\/ru\/(.+)$/);
  if (ruMergeMatch && RU_LANDING_MERGES[ruMergeMatch[1]]) {
    const url = request.nextUrl.clone();
    url.pathname = RU_LANDING_MERGES[ruMergeMatch[1]];
    url.search = "";
    return NextResponse.redirect(url, 301);
  }
  const enMergeMatch = request.nextUrl.pathname.match(/^\/([^/]+)$/);
  if (enMergeMatch && EN_LANDING_MERGES[enMergeMatch[1]]) {
    const url = request.nextUrl.clone();
    url.pathname = EN_LANDING_MERGES[enMergeMatch[1]];
    url.search = "";
    return NextResponse.redirect(url, 301);
  }

  // The "Properties" section is hidden pre-launch — the live inventory is under
  // "Projects" (audit H3). Redirect any /properties[/...] to the localized projects
  // listing with a real HTTP redirect (page-level redirect() is swallowed by the i18n rewrite).
  const propMatch = request.nextUrl.pathname.match(/^\/(?:(de|pl|ru)\/)?properties(?:\/.*)?$/);
  if (propMatch) {
    const url = request.nextUrl.clone();
    url.pathname = propMatch[1] ? `/${propMatch[1]}/projects` : "/projects";
    url.search = "";
    return NextResponse.redirect(url, 308);
  }

  // FAQ redesign — now locale-aware for all 4 languages, same shape as the
  // Case Studies block below (both were English/prefixless-only until their
  // respective translation work). /faq, /de/faq, /pl/faq, /ru/faq all rewrite
  // to preview-faq/[lang] — the visible URL never changes. Content per
  // language lives in the faqPage SiteDocument; a language with no row yet
  // would 404 via the page's own notFound() rather than silently falling
  // back, so this only ships once every language actually has content (see
  // scripts/seed-faq-translations.mjs).
  const faqMatch = request.nextUrl.pathname.match(/^\/(?:(de|pl|ru)\/)?faq$/);
  if (faqMatch) {
    const lang = faqMatch[1] || "en";
    const url = request.nextUrl.clone();
    url.pathname = `/preview-faq/${lang}`;
    return NextResponse.rewrite(url);
  }

  // Case Studies redesign — locale-aware for all 4 languages. /case-studies,
  // /de/case-studies, /pl/case-studies, /ru/case-studies (and their /slug
  // children) all rewrite to preview-case-studies/[lang]/... — the visible
  // URL never changes, only what's rendered behind it.
  const caseStudiesMatch = request.nextUrl.pathname.match(/^\/(?:(de|pl|ru)\/)?case-studies(?:\/([^/]+))?$/);
  if (caseStudiesMatch) {
    const [, localeSeg, slug] = caseStudiesMatch;
    const lang = localeSeg || "en";
    const url = request.nextUrl.clone();
    url.pathname = slug ? `/preview-case-studies/${lang}/${slug}` : `/preview-case-studies/${lang}`;
    return NextResponse.rewrite(url);
  }

  // Partners redesign — now the permanent live implementation (cutover
  // decided during the canonical/hreflang audit; see docs/SITE-CHANGELOG.md).
  // Rewrites the real /partners, /de/partners, /pl/partners, /ru/partners to
  // preview-partners/[lang] (indexable — see that tree's layout.tsx), whose
  // lead-capture form is still gated by /api/email's PARTNERS_PATH_RE on the
  // exact /partners path. The old hardcoded /[lang]/partners/page.tsx this
  // used to sit alongside has been deleted — this rewrite is no longer
  // provisional, it's the only implementation left.
  const partnersMatch = request.nextUrl.pathname.match(/^\/(?:(de|pl|ru)\/)?partners$/);
  if (partnersMatch) {
    const lang = partnersMatch[1] || "en";
    const url = request.nextUrl.clone();
    url.pathname = `/preview-partners/${lang}`;
    return NextResponse.rewrite(url);
  }

  // Corporate pages redesign (About / Contacts / Privacy / Terms) — these
  // four differ from every rewrite above in one important way: their slug is
  // TRANSLATED per locale (about-us / ueber-uns / o-nas / o-nas, …), so the
  // match is driven by the shared CORPORATE_SLUGS map rather than a literal
  // path regex. Both this rewrite and each page's canonical/hreflang read
  // that same map, so they cannot drift apart.
  //
  // Fails soft by design: if an editor renames one of these slugs in the
  // admin, the match simply stops firing and the URL falls through to the old
  // block-rendered singlepage route below — the previous design, not a 404.
  {
    const segs = request.nextUrl.pathname.split("/").filter(Boolean);
    const maybeLocale = segs[0];
    const hasLocalePrefix = maybeLocale === "de" || maybeLocale === "pl" || maybeLocale === "ru";
    const lang = hasLocalePrefix ? maybeLocale : "en";
    const rest = hasLocalePrefix ? segs.slice(1) : segs;
    if (rest.length === 1) {
      const slug = rest[0];
      for (const [page, byLocale] of Object.entries(CORPORATE_SLUGS)) {
        if ((byLocale as Record<string, string>)[lang] !== slug) continue;
        const tree =
          page === "about" ? "preview-about"
          : page === "contacts" ? "preview-contacts"
          : "preview-legal";
        const url = request.nextUrl.clone();
        url.pathname = tree === "preview-legal" ? `/preview-legal/${lang}/${page}` : `/${tree}/${lang}`;
        return NextResponse.rewrite(url);
      }
    }
  }

  // Singlepage canonicalisation. The catch-all singlepage route matches a page by its leaf slug
  // alone, so a nested page (parent/child) also resolves at a flat "/leaf" or wrong-parent URL —
  // duplicate content. Map each nested leaf to its canonical path and 308-redirect anything else.
  // (Same reason as above: this must be a middleware redirect, not a page-level one.)
  const segs = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segs.length) {
    const lang = ALL_LOCALES.includes(segs[0]) ? segs[0] : "en";
    const rest = ALL_LOCALES.includes(segs[0]) ? segs.slice(1) : segs;
    if (rest.length && !RESERVED.has(rest[0])) {
      const canonical = (nestedPageRedirects as Record<string, Record<string, string>>)[lang]?.[rest[rest.length - 1]];
      if (canonical && canonical !== rest.join("/")) {
        const url = request.nextUrl.clone();
        url.pathname = lang === "en" ? `/${canonical}` : `/${lang}/${canonical}`;
        url.search = "";
        return NextResponse.redirect(url, 308);
      }
    }
  }

  // EN migration equity (SEO Growth Roadmap P1 #1/#38) — /en/{path} duplicate-
  // URL consolidation. next-intl's own default-locale handling below already
  // strips a literal /en prefix, but only with a 307 (temporary) redirect,
  // which doesn't reliably tell Google to consolidate ranking signals/drop
  // the old URL from the index.
  //
  // IMPORTANT: in PRODUCTION this block never runs. nginx has its own
  // blanket "/en/" rule (see ops/nginx/cyprusvipestates.conf, documented in
  // DEPLOYMENT.md's "The nginx layer" section) that intercepts every /en/
  // request before it reaches this middleware at all — discovered
  // 2026-07-19 when this block was deployed and had zero observable effect
  // in production despite testing correctly in local dev (no nginx there).
  // This block is kept because it's the only /en/ handling local dev has,
  // and as a fallback if nginx's rule is ever simplified/removed — but
  // nginx, not this file, is the actual production authority on /en/
  // routing. Don't trust this comment block alone when reasoning about
  // production behavior; check the nginx config too.
  //
  // This block resolves the FINAL destination in one hop — never a chain:
  //   - /en/properties(/*) collapses straight to /projects, matching what a
  //     bare /properties(/*) request already collapses to (via the propMatch
  //     block above) two hops later. Redirecting to /properties first and
  //     letting IT redirect again would be a real, visible two-hop chain —
  //     confirmed live before this fix: /en/properties → 307 → /properties
  //     → 308 → /projects.
  //   - Every other /en/{path} resolves directly to /{path}: the singlepage
  //     canonicalization block above already handles the handful of nested-
  //     leaf conflicts (nestedPageRedirects.json) for lang="en" exactly like
  //     any other locale and returns before execution ever reaches here, so
  //     a plain strip is safe for whatever's left.
  // Pages still inside their title-sweep 42-day re-measurement window (see
  // docs/SEO-TITLE-SWEEP-LOG.md) are excluded here for LOCAL DEV consistency
  // only — production's real behavior for them is unaffected either way
  // (nginx already permanently redirects them and always has; see the
  // 2026-07-19 diagnosis note in SEO-TITLE-SWEEP-LOG.md).
  const enMatch = request.nextUrl.pathname.match(/^\/en(\/.*)?$/);
  if (enMatch) {
    const rest = (enMatch[1] || "").replace(/^\//, "");
    const target = /^properties(\/|$)/.test(rest) ? "/projects" : rest ? `/${rest}` : "/";
    if (!EN_REDIRECT_TITLE_SWEEP_EXCLUDE.has(target)) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      return NextResponse.redirect(url, 301);
    }
  }

  const handleI18nRouting = createIntlMiddleware({
    locales,
    defaultLocale,
    // Default locale (English) is served without a URL prefix; de/pl/ru keep
    // their prefix. next-intl also redirects `/en/...` → `/...` automatically
    // (307) — the block above intercepts most cases with a 301 first; this
    // remains the fallback for excluded (title-sweep) paths.
    localePrefix: "as-needed",
    localeDetection: false,
  });

  return handleI18nRouting(request);
}

export const config = {
  // Matcher ignoring `/_next/`, `/api/`, local uploads, and other non-localized paths.
  // "c/" = client presentations (src/app/c/[token]), a route outside the [lang]
  // tree; without this exclusion next-intl's i18n middleware rewrites
  // /c/<token> to /en/c/<token>, which doesn't exist → 404 on every
  // presentation link.
  //
  // "book/" = the booking page (src/app/book/[token], Phase 3, 2026-07-25),
  // outside the [lang] tree for the exact same reason as "c/" above —
  // confirmed live during staging verification: without this exclusion every
  // /book/<token> request was rewritten to /en/book/<token> (see
  // x-middleware-rewrite response header) and 404'd.
  //
  // The preview-* exclusions must be the exact top-level route names, NOT a
  // bare "preview" prefix: src/app/[lang]/preview-project/[slug] IS under the
  // [lang] tree and NEEDS the i18n middleware to inject the locale segment.
  // A bare "preview" also matches "preview-project" (prefix match), which
  // excluded that route from ever getting its [lang] segment injected — every
  // /preview-project/<slug> request then had only 2 URL segments where the
  // route needs 3 ([lang]/preview-project/[slug]), failed to match, and fell
  // through to the [lang]/[...slug] singlepage catch-all (which then 500'd
  // trying to use "preview-project" as a Prisma `language` value).
  //
  // preview-assets (public/preview-assets/*, e.g. sunset.mp4, faq-hero-2.webp)
  // was missing from this list — every request to it got rewritten to
  // /en/preview-assets/*, a path with no matching static file or route, 404ing
  // in production. Confirmed live (2026-07-17): both preview-home's hero video
  // and the FAQ hero illustration were silently broken by this gap.
  //
  // "og" (public/og/*, the branded OG/social-preview images) hit the identical
  // gap (2026-07-18): /og/home-1200x630.jpg rewritten to /en/og/home-1200x630.jpg
  // and 404ing, which would have made every og:image/twitter:image tag point at
  // a broken URL in production.
  //
  // Same gap again (2026-07-18), this time for the IndexNow protocol's key
  // file, which MUST be servable at the literal site root
  // (/<key>.txt — see src/lib/indexnow.ts) for search engines to verify
  // domain ownership. Root-level static files in general have this same
  // exposure (confirmed: /checkmark.png, /next.svg, /poi/cyprus.json all
  // 404 the same way) — flagged separately as a pre-existing gap broader
  // than this one file; not fixed wholesale here to avoid touching this
  // matcher's blast radius beyond what's actually needed right now.
  // `.well-known` (2026-09-07): OAuth discovery documents for the MCP connector
  // — same class of exclusion as /c/ and /book/ (see docs/BOOKING-PAGE.md).
  matcher: [
    "/((?!api|\\.well-known|_next/static|_next/image|admin|structure|robots|sitemap|uploads|img|favicon.ico|apple-icon.png|icon.png|icons/|manifest.webmanifest|sandbox|og|preview-about|preview-assets|preview-case-studies|preview-contacts|preview-faq|preview-home|preview-insights|preview-landing|preview-legal|preview-partners|preview-projects|style|c/|book/|3499d71f004393c8d27c96caccbf03d1\\.txt).*)",
  ],
};
