import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { buildCanonicalMap, canonicalize, localeOfPath } from "@/lib/seo/urlCanonical";
import { templateClassOf, type TemplateClass } from "@/lib/seo/templateClass";
import {
  CLASS_RATE_FRACTION, COMPARISON_PROJECT_PAGES, MIN_COMPARISON_SESSIONS,
  MIN_ENTERING_SESSIONS, MIN_EXPECTED_ONWARD, WINDOW_DAYS, type ClassVerdict,
} from "./types";

// The two diagnoses that cannot work per page. Only 5 pages on this site clear
// 30 Google clicks in 90 days, so a per-page landing analysis would manufacture
// noise; these are measured on SESSIONS (3,824 in the same window) and reported
// per template class.
//
// EVERY production figure quoted in this file — 3,824 sessions, 276 comparison
// sessions, 37 page-attributable enquiries, 147 published Developments against
// 611 published legacy Projects — was measured on 2026-08-23 over the window
// this module now defines (2026-05-25 to 2026-08-22 inclusive), the same run as
// the thresholds in types.ts. See
// docs/superpowers/specs/2026-08-23-seo-page-power-design.md. Re-measure before
// leaning on one; they are not preferences and they are not eternal.

const DAY = 86_400_000;

/**
 * The `mute` bar: how many enquiries this class would have to be EXPECTED to
 * produce before observing none is evidence of anything.
 *
 * This is not a measured production threshold like the ones in types.ts — it is
 * a derivation, which is why it lives here and not there. Under a Poisson null
 * with mean λ, the chance of seeing zero is e^-λ: at λ = 0.8 that is 45%, at
 * λ = 0.2 it is 82%. So for a thin class "no enquiry came from here" is the
 * ORDINARY outcome even when nothing is wrong, and a `mute` verdict gated only
 * on a comparison-session count — the plan's original shape — would fire on
 * classes carrying no information at all. e^-3 ≈ 5%, so λ ≥ 3 is the point at
 * which silence is surprising rather than expected.
 *
 * What that actually requires. Since
 * `expectedLeads_c = onwardComparisonSessions_c × siteLeadsPerComparisonSession`
 * and `onwardComparisonSessions_c ≤ siteComparisonSessions`, the tight bound is
 * just `expectedLeads_c ≤ attributedLeads`. So the precondition for `mute` is
 * THREE PAGE-ATTRIBUTABLE ENQUIRIES SITE-WIDE in the window, plus concentration.
 *
 * THIS BRANCH IS REACHABLE, AND THAT IS NEW. The comment this one replaces
 * argued the opposite, on two figures that did not survive checking (both
 * corrected 2026-08-23):
 *
 *  - It read "148 of 179 leads were entered by hand" as "and therefore carry no
 *    page". They do carry one: measured all-time, 141 of the 179 leads have a
 *    non-null `pageSource` and 119 of those resolve to a path — the MANUAL rows
 *    are monday.com imports that kept the URL. Only 38 leads lack the field
 *    entirely. src/lib/crm/compose/generate.ts already recorded "79% of leads
 *    have a pageSource" before this branch existed.
 *  - It put "the realistic page-attributable count in a 90-day window" at nought
 *    to two. In this window it is 47 with a `pageSource`, 38 of them not
 *    soft-deleted, 37 of those resolving to a path.
 *
 * Against 276 site comparison sessions those 37 give λ ≈ 0.134 per comparison
 * session, so a class needs roughly 23 onward comparison sessions before its
 * expectation reaches 3 — and MIN_COMPARISON_SESSIONS already demands 50 of
 * them, which on this window's figures predicts about 6.7. Measured 2026-08-23,
 * `other-landing-page` clears both preconditions outright: 117 onward comparison
 * sessions, expectation 15.7. It reads `healthy` rather than `mute` only because
 * 27 enquiries actually were traced to it. Had those 27 been zero, this module
 * would have emitted `mute` — as it should.
 *
 * So the honest statement is no longer "it cannot fire at this site's volume".
 * It is that one class is already eligible for it, and the next-closest is
 * nine onward sessions short: `homepage` sits at 41 against
 * MIN_COMPARISON_SESSIONS' 50, while its expectation of 5.5 clears THIS bar
 * comfortably. The binding constraint is now that floor, not this one. The
 * fall-through below still exists for the classes that cannot support the
 * verdict, and still says so in words rather than emitting a finding it cannot
 * support.
 */
const MUTE_MIN_EXPECTED_LEADS = 3;

/** Same helper as pageVerdicts.ts, for a different reason. There it is because
 *  `SearchMetric.date` is `@db.Date`; here it is because `PageView.visitorHash`
 *  is salted with the UTC DAY (see src/lib/visitorHash.ts), so a session starts
 *  at UTC midnight. A window bound carrying `now`'s time-of-day would slice the
 *  oldest day in half and hand back sessions whose FIRST ROW IS NOT THEIR ENTRY
 *  PAGE — every entry-page-derived number below would be silently wrong for that
 *  day.
 *
 *  Carries the same warning as the copy in pageVerdicts.ts, because this module
 *  performs exactly the arithmetic that warning protects: DST is a non-issue and
 *  `DAY = 86_400_000` is exact here, since every bound produced by this function
 *  is a UTC-midnight instant and every comparison against it is absolute-ms — no
 *  local calendar is ever consulted. Do NOT "fix" the subtraction below into a
 *  timezone-aware one. Duplicated rather than shared only because the two
 *  modules justify it differently; keep the two copies identical in behaviour. */
const utcMidnight = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * The span every figure below covers: WINDOW_DAYS COMPLETE UTC days, the newest
 * of which is yesterday. `windowEnd` is EXCLUSIVE — the first instant the window
 * does not cover — matching `PageVerdictResult.windowEnd`, so display code must
 * subtract a day before printing a date a reader would recognise.
 *
 * Exported because the admin screen shows this module's table directly beneath
 * the page layer's, and until 2026-08-23 it printed the PAGE layer's dates over
 * both. The two windows genuinely differ and the card has to say so itself.
 *
 * Deliberately NOT lagged by GSC_LAG_DAYS the way `getPageVerdicts` is. That lag
 * exists because Google backfills Search Console for two to three days; PageView
 * and Lead are first-party rows written at the moment they happen, so there is
 * nothing to wait for, and holding back three days of them would discard real
 * sessions to match an unrelated source's latency. The consequence is that the
 * two spans END three days apart. They are never joined — but both modules write
 * "in WINDOW_DAYS days" into reason strings an admin reads side by side, so say
 * which source a number came from before comparing them.
 *
 * The newest day IS excluded, and that is not the GSC lag by another name. Today
 * is only partly elapsed, and a session captured mid-visit is counted as an
 * entering session whose onward browsing has not happened yet — it lands in
 * every rate's denominator and in no numerator. One partial day out of ninety
 * cannot move a verdict, but it makes the reason strings' "in 90 days" false and
 * the printed window a day wider than the data, for nothing.
 */
export function classWindow(now: Date = new Date()): { windowStart: Date; windowEnd: Date } {
  const windowEnd = utcMidnight(now);
  return { windowStart: new Date(windowEnd.getTime() - WINDOW_DAYS * DAY), windowEnd };
}

/** Strips query and hash, then a trailing slash, so `/de/`, `/de?x=1` and `/de`
 *  are one path. Without it `/de/` misses the homepage regex in `templateClassOf`
 *  and lands in `other-landing-page`, which is both a wrong class for the entry
 *  page and a wrong denominator for two others. `/` survives as `/`. */
function normalisePath(path: string): string {
  const bare = path.replace(/[?#].*$/, "").replace(/\/+$/, "");
  return bare === "" ? "/" : bare;
}

/**
 * `Lead.pageSource` is a FULL URL with origin and query string
 * (`https://cyprusvipestates.com/en/projects/x?utm_source=y`); GSC and PageView
 * carry paths. Null when nothing path-shaped can be recovered — such a lead is
 * counted nowhere rather than being silently attributed to the site root.
 *
 * Parsed with `URL` rather than by stripping one hard-coded origin: leads also
 * arrive from `www.`, from `http://`, and from preview deployments, and a
 * prefix check against a single origin would leave those whole URLs to be
 * treated as paths — classifying every one of them as `other-landing-page`,
 * invisibly. The host is deliberately not checked, because every host this
 * field can carry serves the same path structure.
 *
 * Not every non-null `pageSource` survives this: measured 2026-08-23, 141 leads
 * all-time carry the field and 119 resolve to a path, the rest holding free text
 * a monday.com import wrote there ("TikTok", "Friends"). In the 90-day window it
 * is 38 non-deleted with the field and 37 resolving.
 */
function pathFromLeadSource(pageSource: string): string | null {
  const raw = pageSource.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    try {
      return new URL(raw).pathname || "/";
    } catch {
      return null;
    }
  }
  return raw.startsWith("/") ? raw : null;
}

const fmt = (n: number): string => n.toLocaleString("en-GB");
const enquiries = (n: number): string => `${fmt(n)} ${n === 1 ? "enquiry" : "enquiries"}`;

/** Every URL shape that serves ONE property. Both a Development and a legacy
 *  Sanity Project live at `/projects/{slug}` in all four locales — the shape is
 *  shared, which is exactly why `templateClassOf` needs a slug set to tell the
 *  two apart and why this module needs one to tell a property from anything
 *  else. Kept beside `propertyOf` rather than reusing the copy inside
 *  `templateClassOf`, because the two answer different questions (see there). */
const PROPERTY_PATH = /^(?:\/(?:de|pl|ru))?\/projects\/([^/]+)$/;

/** Every class gets exactly one verdict, so this list must stay exhaustive.
 *  Declared as a `Record<TemplateClass, number>` and not an array literal: a
 *  sixth class added to the union would leave an array silently short — one
 *  class would vanish from the report with nothing to catch it — whereas the
 *  record fails to compile. The values fix the display order. */
const CLASS_ORDER: Record<TemplateClass, number> = {
  homepage: 1,
  "projects-listing": 2,
  "development-page": 3,
  "blog-post": 4,
  "other-landing-page": 5,
};
const ALL_CLASSES = (Object.keys(CLASS_ORDER) as TemplateClass[]).sort((a, b) => CLASS_ORDER[a] - CLASS_ORDER[b]);

/**
 * `entryClass` is non-nullable because a session cannot exist without one: a
 * Session is only ever constructed while processing a view, and
 * `templateClassOf` is total. The type carries that invariant so no reader has
 * to re-derive it, and so no dead null-branch has to be maintained.
 *
 * The two property sets are the SAME measurement at two scopes, and keeping them
 * apart is the point:
 *  - `properties` — every distinct property in the session, entry page included.
 *    This is the site-level comparison metric — the approved north-star figure,
 *    282 per quarter, 276 on the window this module now measures — and it is not
 *    redefined to suit anything here. See COMPARISON_PROJECT_PAGES in types.ts
 *    for what a property is and for what the Development-only reading cost.
 *  - `onwardProperties` — distinct properties OTHER THAN `entryProperty`, seen
 *    after the entry pageview. This is what a per-class rate must be built on,
 *    because counting the landing property measures a different funnel step for
 *    each class; see `onwardComparisonSessions` in types.ts for the full
 *    argument.
 *
 * `entryProperty` exists only to be excluded from `onwardProperties`, and is
 * null when the session did not land on a property at all — in which case there
 * is nothing to exclude and every property seen is onward.
 *
 * All three hold PROPERTY IDENTITIES, not paths — see `propertyOf`.
 */
type Session = {
  entryClass: TemplateClass;
  entryProperty: string | null;
  properties: Set<string>;
  onwardProperties: Set<string>;
};

export async function getClassVerdicts(now: Date = new Date()): Promise<ClassVerdict[]> {
  const { windowStart, windowEnd } = classWindow(now);

  const [map, developments, projects, views, leads] = await Promise.all([
    buildCanonicalMap(),
    // Deliberately NOT `getInventory()`, and deliberately NOT filtered by
    // `publishStatus`. This set exists to CLASSIFY 90 DAYS OF HISTORY, and the
    // published set is a snapshot of today: a Development unpublished, archived
    // or sold out mid-window would retroactively demote every pageview it ever
    // received to `other-landing-page`, deflating comparison sessions across
    // every class and inflating `other-landing-page`'s entering sessions — a
    // silent shift in `bestRate`, the bar all five classes are judged against,
    // for a reason that has nothing to do with any template. On a site where
    // properties routinely sell out and come down, that is not a corner case.
    // pageVerdicts.ts filtering to published IS correct there, because it only
    // ever classifies pages that are in today's inventory to begin with.
    prisma.development.findMany({ where: { slug: { not: null } }, select: { slug: true } }),
    // Legacy Sanity Projects, and the `status: "PUBLISHED"` filter here is NOT
    // an inconsistency with the unfiltered Development query above — it is the
    // same predicate `getInventory()` uses (inventory.ts), so the two modules
    // agree on which Projects are live, and the historical-classification
    // argument that forbids the filter for Developments does not bite here.
    // Measured 2026-08-23: including the 276 ARCHIVED rows as well changes the
    // site comparison-session count by nought (276 either way) and moves no
    // class figure at all, because archiving a legacy Project writes a
    // `legacy_project_redirects` row and `canonicalize` has already folded its
    // pageviews onto the Development that replaced it before this set is
    // consulted. A Development that comes down has no such successor to be
    // folded onto, which is the whole difference between the two queries.
    //
    // `translationGroupId` is selected because a Project is a PER-LOCALE ROW
    // with a per-locale slug, unlike a Development's one language-agnostic
    // slug — see `propertyOf` for what that costs and how it is paid.
    prisma.project.findMany({
      where: { status: "PUBLISHED", slug: { not: "" } },
      select: { slug: true, translationGroupId: true },
    }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: windowStart, lt: windowEnd }, isBot: false, isPrefetch: false, isTest: false },
      select: { visitorHash: true, path: true, createdAt: true },
      // `id` is the tie-break, and it is load-bearing: `createdAt` alone leaves
      // rows sharing a timestamp in an order Postgres may return either way, and
      // the FIRST row of each session is read below as its entry page. `id` is
      // an autoincrement written in insertion order, so it settles ties the same
      // way on every run.
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.lead.findMany({
      // Three filters, each excluding a different kind of non-evidence.
      //
      // `deletedAt: null` — the soft-delete flag set by the /admin/crm trash
      // flow, documented on the column itself (prisma/schema.prisma) as
      // "excluded from all normal queries", and excluded by every other lead
      // query in this codebase. It was missing here until 2026-08-23, and it
      // was not academic: 9 of the 47 leads carrying a `pageSource` in this
      // window are trashed. `healthy` is gated on nothing more than
      // `leadCount > 0`, so a class whose only traced enquiry was one the
      // operator had explicitly thrown away was certified healthy and printed
      // "1 enquiry came from pages of this class" to say so.
      //
      // `pageSource: { not: null }` — a lead with no page cannot be attributed
      // to a class and is excluded here rather than defaulted anywhere. It is a
      // smaller exclusion than this file used to claim: 141 of 179 leads
      // all-time DO carry the field, monday.com's MANUAL imports included.
      //
      // `Lead.status` is never read: the operator ruled it unusable as a
      // scoring basis.
      //
      // `...EXCLUDE_NEWSLETTER` — the newsletter sign-up route stamps
      // `pageSource` too, so a subscriber who joined while reading a project
      // page would otherwise count as proof that page generates enquiries. It
      // is the same false positive the `deletedAt` entry above describes —
      // evidence this module should not be trusting — arrived at from a
      // different direction: not a discarded lead, but one that was never a
      // sales enquiry to begin with.
      where: { createdAt: { gte: windowStart, lt: windowEnd }, deletedAt: null, pageSource: { not: null }, ...EXCLUDE_NEWSLETTER },
      select: { pageSource: true },
    }),
  ]);

  const devSlugs = new Set(developments.map((d) => d.slug).filter((slug): slug is string => slug !== null));

  /**
   * Slug → property identity, for legacy Projects only.
   *
   * A Development carries ONE language-agnostic slug and is reachable in all
   * four locales under it (developmentSeo.ts), so its slug IS its identity. A
   * Project is a per-locale row carrying a per-locale slug, so one property can
   * appear as up to four different slugs — measured 2026-08-23, 11 of the 154
   * published translation groups do:
   * `villas-cap-st-georges-resort` / `villen-…` / `wille-…` / `villy-…` are one
   * property in four languages. Keyed by slug, a visitor using the language
   * switcher on a single legacy property would register as having compared two,
   * which is precisely the buying signal this module exists to count.
   * `translationGroupId` is that property's identity across locales and every
   * published Project row has one.
   *
   * Namespaced with a `project:` prefix so the fallback for a row without a
   * group can never collide with a Development slug used as an identity.
   */
  const projectProperties = new Map<string, string>();
  for (const project of projects) {
    projectProperties.set(project.slug, `project:${project.translationGroupId ?? project.slug}`);
  }

  /**
   * "Is this path a property page, and if so WHICH property" — the question
   * this module needs, and it is NOT the question `templateClassOf` answers.
   *
   * `templateClassOf` returns `development-page` only for a slug that is a known
   * Development, and that is right for what it is for: a legacy Project at
   * `/projects/{slug}` renders through completely different components, so
   * grouping the two together would mix two unrelated templates' Core Web Vitals
   * into one number, and `development-page` as a CLASS LABEL honestly names
   * Development pages. This module reused that class to mean "this pageview is a
   * property", and it is not. Measured 2026-08-23: 147 published Developments
   * against 611 published legacy Projects, and in this window 1,296 pageviews on
   * Development property pages against 1,526 on legacy ones. Reading only the
   * Developments made more than half of all property browsing invisible to the
   * onward metric, put every session entering on a legacy property into
   * `other-landing-page`'s denominator with its property browsing in no
   * numerator, and scored a session comparing two legacy properties at nought
   * while the same journey among Developments scored two. It also failed to
   * reproduce the module's own approved north-star: this window holds 276
   * comparison sessions on the spec's definition and the Development-only
   * reading found 106.
   *
   * The two concepts are genuinely different and must stay separate. Do not
   * "simplify" this back into a call to `templateClassOf`, and do not widen
   * `templateClassOf` to match it — that would put legacy Projects into the
   * Development CWV bucket, which is the defect it was written to prevent.
   *
   * The Development wins a slug collision, which is the same rule and the same
   * reason as `KIND_PRIORITY` in inventory.ts: during a supersede window both
   * rows can hold one slug, and the Development is what the dispatcher actually
   * serves (src/app/[lang]/projects/[slug]/page.tsx). Because the identity IS
   * the slug on that branch, the collision collapses to one property rather than
   * being counted as two. A Project superseded by a Development under a
   * DIFFERENT slug is handled a step earlier — `canonicalize` folds the old path
   * onto the new one before this is called. (Measured 2026-08-23: 16 published Project rows
   * carry a slug that is also a Development slug, none of them inside a
   * multi-slug translation group.)
   */
  const propertyOf = (path: string): string | null => {
    const match = path.match(PROPERTY_PATH);
    if (match === null) return null;
    const slug = match[1];
    if (devSlugs.has(slug)) return slug;
    return projectProperties.get(slug) ?? null;
  };

  const classify = (rawPath: string): { path: string; cls: TemplateClass } => {
    const path = normalisePath(rawPath);
    // The locale here is INERT — `canonicalize` returns it untouched when
    // nothing matches and re-derives it from the final path when something
    // does, and this module reads only `target.page`. `localeOfPath` rather
    // than `deriveLocale` all the same: that is the join-key convention for
    // every source (see its doc comment in urlCanonical.ts), and a module that
    // quietly uses the other one is one edit away from being wrong.
    const target = canonicalize(map, localeOfPath(path), path);
    return { path: target.page, cls: templateClassOf(target.page, devSlugs) };
  };

  // `visitorHash` is sha256(salt | UTC-day | ip | userAgent) — see
  // src/lib/visitorHash.ts. It biases in BOTH directions and both belong on the
  // record, because everything below is built on it:
  //  - It DEFLATES. The hash rotates at UTC midnight, so a "session" is one
  //    visitor-DAY. Multi-day research counts more than once, and returning
  //    visitors — a return to the same property being one of the strongest
  //    buying signals there is — are invisible entirely.
  //  - It INFLATES. The identity is really one (IP, user-agent)-day, not one
  //    person. Two people behind a single NAT or CGNAT egress on the same
  //    user-agent — two iPhones on one carrier, an office, a household — merge
  //    into one pseudo-session that inherits the UNION of their property views
  //    and the entry class of whichever loaded first. That manufactures
  //    comparison sessions out of unrelated visitors and misattributes the
  //    grouping key, hitting the numerator and the denominator at once.
  // Both are ceilings of a deliberately cookieless, PII-free design, not defects
  // to route around here. The day sitting inside the preimage does make the hash
  // alone a safe key ACROSS days — that, and nothing more, is what it buys.
  const sessions = new Map<string, Session>();
  for (const view of views) {
    // A row with no hash cannot be grouped into a session at all. Treated as a
    // session of its own it would add a phantom entering session that can never
    // become a comparison one, deflating every rate; dropped, it costs only
    // itself. The current writer always sets the field
    // (src/app/api/analytics/track/route.ts computes it unconditionally on every
    // insert), so a null can only be historical, and the column is nullable for
    // that history alone.
    if (!view.visitorHash) continue;
    const { path, cls } = classify(view.path);
    // Keyed by PROPERTY, not path — see `propertyOf`. A property is one property
    // in all four locales, so `/projects/x` and `/de/projects/x` must not count
    // as two.
    const property = propertyOf(path);

    const session = sessions.get(view.visitorHash);
    if (session === undefined) {
      // Rows arrive oldest-first, so the first one seen for a hash is the entry
      // pageview. `templateClassOf` is total — anything it does not recognise
      // becomes `other-landing-page` — so no session is ever dropped for having
      // entered on an unknown page. The cost is that `other-landing-page` is a
      // catch-all that also absorbs utility pages (/book/<token>, thank-you
      // pages) and, because `templateClassOf` splits by RENDERING TEMPLATE, every
      // legacy `/projects/<slug>` page too. Those legacy entries are property
      // entries and are handled as such by `propertyOf` above — the class label
      // is about the template, not about whether a property was seen.
      // Filtering entries down to the CMS inventory instead would shrink the
      // session denominator invisibly, which is the worse trade.
      sessions.set(view.visitorHash, {
        entryClass: cls,
        entryProperty: property,
        properties: property === null ? new Set<string>() : new Set<string>([property]),
        // The entry pageview is by definition not onward, so this starts empty
        // even when the session landed ON a property.
        onwardProperties: new Set<string>(),
      });
      continue;
    }
    if (property !== null) {
      session.properties.add(property);
      // The landing property is excluded from the onward set for the whole
      // session, not just for its first pageview. `land on x → view y → back to
      // x` is ordinary browsing, and counting that return would let a session
      // entering on a property reach the threshold on ONE further property
      // while every other class still needs two — the same asymmetry, smaller,
      // and running the same direction.
      if (property !== session.entryProperty) session.onwardProperties.add(property);
    }
  }

  const entering = new Map<TemplateClass, number>();
  const onwardComparing = new Map<TemplateClass, number>();
  let siteComparisonSessions = 0;
  for (const session of Array.from(sessions.values())) {
    entering.set(session.entryClass, (entering.get(session.entryClass) ?? 0) + 1);
    // Two different counts on purpose — see the `Session` doc comment. A session
    // reaching COMPARISON_PROJECT_PAGES onward necessarily reaches it overall,
    // so the onward counts are a subset of the site total, never a rival to it.
    if (session.properties.size >= COMPARISON_PROJECT_PAGES) siteComparisonSessions++;
    if (session.onwardProperties.size >= COMPARISON_PROJECT_PAGES) {
      onwardComparing.set(session.entryClass, (onwardComparing.get(session.entryClass) ?? 0) + 1);
    }
  }

  // A lead is attributed to the class of the page its FORM sat on, because that
  // is the only link the data supports — PageView and Lead share no session key,
  // so a lead can never be traced back to the journey that produced it. The
  // limitation is real and worth stating: a comparison session spans several
  // classes, and this credits the last one. A blog post that started the
  // research and a development page that closed it both count as the
  // development page. Read the count as "enquiries sent FROM this class", never
  // as "enquiries this class earned".
  //
  // A second mismatch follows from it and matters to `mute` below: the lead
  // count is scoped by the page the FORM sat on, while the expectation it is
  // judged against is built from sessions that ENTERED on the class. A class
  // that hosts most of the site's enquiry forms but receives few entries is
  // therefore measured against an expectation built from someone else's traffic,
  // in both directions. The two cannot be reconciled without a session-to-lead
  // key, which the data does not have — so the bar is set where a mismatch of
  // this size cannot manufacture a verdict on its own.
  const leadsByClass = new Map<TemplateClass, number>();
  let attributedLeads = 0;
  for (const lead of leads) {
    // The `where` clause already excludes nulls; checked again rather than cast
    // away, because a cast is a claim the compiler cannot check and this one
    // would fail as an empty-string path if the filter were ever loosened.
    if (lead.pageSource === null) continue;
    const path = pathFromLeadSource(lead.pageSource);
    if (path === null) continue;
    const { cls } = classify(path);
    leadsByClass.set(cls, (leadsByClass.get(cls) ?? 0) + 1);
    attributedLeads++;
  }

  /**
   * The null model behind `mute`: page-attributable enquiries spread across the
   * classes in proportion to onward-comparison volume. A yardstick for "would
   * zero have been surprising", not a causal claim.
   *
   * ITS NAME IS AN AMBITION, NOT A MEASUREMENT, and the gap runs both ways.
   * The numerator counts every page-attributable enquiry on the site, from ALL
   * sessions — one-page visits and comparison sessions alike — while the
   * denominator counts comparison sessions only. It is therefore an upper bound
   * on the real enquiries-per-comparison-session, and an upper bound in the
   * expectation makes `mute` EASIER to reach, which is the unsafe direction.
   * Running against it, the volume this figure multiplies is onward-only while
   * the denominator is the site-level metric, so the per-class expectations sum
   * to LESS than `attributedLeads` rather than exactly to it: measured
   * 2026-08-23 they sum to 28.2 against 37 attributed. Net, the arithmetic still
   * under-claims, but not by construction — check both halves before leaning on
   * it, and re-check them if either scope changes.
   *
   * It cannot be MADE what its name says: `Lead` and `PageView` share no session
   * key, so the enquiries produced BY comparison sessions are not identifiable
   * at all (the same missing key documented above the attribution loop). Naming
   * it for the scope of its denominator is the closest honest description. The
   * site-level metric is the approved north-star figure and is not rescoped to
   * tidy up this arithmetic.
   */
  const siteLeadsPerComparisonSession = siteComparisonSessions > 0 ? attributedLeads / siteComparisonSessions : 0;

  // The true observed rate for EVERY class, including those below the floor —
  // it is a fact about the class either way, and reporting it keeps NaN out of
  // the record entirely (a NaN would serialise to null and break any consumer
  // calling toFixed on it). The floors govern whether it may be JUDGED and
  // whether it may set the bar, both decided below.
  const rates = new Map<TemplateClass, number>();
  for (const cls of ALL_CLASSES) {
    const e = entering.get(cls) ?? 0;
    rates.set(cls, e > 0 ? (100 * (onwardComparing.get(cls) ?? 0)) / e : 0);
  }

  /**
   * Which classes are allowed to SET the bar — the same evidence floor the bar
   * then imposes on everyone else, applied to the class setting it.
   *
   * Until 2026-08-23 only MIN_ENTERING_SESSIONS gated this, and MIN_EXPECTED_ONWARD
   * gated the class being JUDGED. So a class the module refused to judge could
   * still decide what everybody else was judged against. That is not a
   * hypothetical: on this window `projects-listing` is `unjudged` — 12 onward
   * sessions cannot support a verdict either way — and its 11.0% is the highest
   * rate on the site, so as the benchmark it would make `development-page`
   * `repelling` at 5.1% against a bar drawn from evidence the tool would not
   * accept about `projects-listing` itself. A bar nobody is allowed to be judged on is not a
   * bar.
   *
   * Measured on the class's OWN onward count rather than on `expectedOnward`,
   * which would be circular — `expectedOnward` is defined in terms of `bestRate`
   * and `bestRate` is what this is choosing. The two coincide exactly where it
   * matters: for the class that sets the bar,
   * `expectedOnward = enteringSessions × rate = onwardComparisonSessions`. So
   * this is MIN_EXPECTED_ONWARD evaluated at the benchmark class, not a second,
   * looser floor wearing its name.
   */
  const benchmarkClasses = ALL_CLASSES.filter(
    (cls) => (entering.get(cls) ?? 0) >= MIN_ENTERING_SESSIONS && (onwardComparing.get(cls) ?? 0) >= MIN_EXPECTED_ONWARD,
  );
  const bestRate = Math.max(0, ...benchmarkClasses.map((cls) => rates.get(cls) ?? 0));

  return ALL_CLASSES.map((cls): ClassVerdict => {
    const enteringSessions = entering.get(cls) ?? 0;
    const onwardComparisonSessions = onwardComparing.get(cls) ?? 0;
    const onwardComparisonRate = rates.get(cls) ?? 0;
    const leadCount = leadsByClass.get(cls) ?? 0;
    const expectedLeads = onwardComparisonSessions * siteLeadsPerComparisonSession;
    // What this class WOULD have produced at the best class's rate. The bar the
    // `repelling` test moves against, and therefore the right quantity to size
    // the evidence on: a rate can only be told from the bar when the bar itself
    // predicts enough events. For the best class it equals its own observed
    // count exactly, which is the sanity check on the formula — and, since
    // 2026-08-23, also the eligibility test for setting the bar at all.
    const expectedOnward = (enteringSessions * bestRate) / 100;
    const base = {
      templateClass: cls,
      enteringSessions,
      onwardComparisonSessions,
      onwardComparisonRate,
      attributableLeads: leadCount,
    };

    if (enteringSessions < MIN_ENTERING_SESSIONS) {
      return {
        ...base,
        diagnosis: "unjudged",
        reason: `Only ${fmt(enteringSessions)} sessions entered the site here in ${WINDOW_DAYS} days — below the ${MIN_ENTERING_SESSIONS} needed to judge.`,
      };
    }

    // A zero bar means no class cleared BOTH benchmark floors with a single
    // session going onward to two properties. Left to fall through, every
    // comparison of the form `0 < 0 * 0.5` is false and each of these classes
    // would be certified against a benchmark that does not exist. Today the
    // MIN_COMPARISON_SESSIONS branch below would happen to catch them — but on a
    // floor over a different quantity, by coincidence, and coincidence is not a
    // guard.
    if (!(bestRate > 0)) {
      return {
        ...base,
        diagnosis: "unjudged",
        reason: `No template class carries enough evidence to set a benchmark — that needs ${MIN_ENTERING_SESSIONS} entering sessions and ${MIN_EXPECTED_ONWARD} of them going on to two or more properties other than the one they landed on, and in ${WINDOW_DAYS} days none did — so there is nothing to measure this one against.`,
      };
    }

    // Gates the WHOLE engagement axis, not just `repelling`. MIN_ENTERING_SESSIONS
    // bounds the denominator of the rate and nothing bounded the numerator, so a
    // class could clear that floor and still be judged on a handful of onward
    // sessions — measured 2026-08-23, `projects-listing` is judged on 12 (see
    // MIN_EXPECTED_ONWARD in types.ts for the false-alarm table). Blocking only
    // the `repelling` branch would hand the same class `healthy` on the same
    // non-evidence with the sign flipped, since that branch asks only for a
    // traced enquiry. Thin evidence is no more evidence for healthy than against
    // it, so neither verdict is available here and the reason says so outright.
    //
    // Returning `unjudged` rather than falling through to the lead axis hides
    // nothing: `onwardComparisonSessions >= MIN_COMPARISON_SESSIONS` would force
    // this class's own rate to at least 50/enteringSessions, hence
    // `expectedOnward = enteringSessions × bestRate ≥ 50` since `bestRate` is the
    // maximum over benchmark-eligible classes — well above this floor. A class
    // gated here can therefore never have been eligible for `mute` anyway.
    if (expectedOnward < MIN_EXPECTED_ONWARD) {
      const engagement = `${fmt(onwardComparisonSessions)} of the ${fmt(enteringSessions)} sessions entering here went on to two or more properties other than their landing page, where the strongest class's rate predicts about ${expectedOnward.toFixed(0)} — below the ${MIN_EXPECTED_ONWARD} expected needed before that gap can be told from chance, so this class is not judged on engagement in either direction.`;
      return {
        ...base,
        diagnosis: "unjudged",
        reason: leadCount > 0
          ? `${engagement} ${enquiries(leadCount)} came from pages of this class, too few to stand as a verdict alone.`
          : engagement,
      };
    }

    if (onwardComparisonRate < bestRate * CLASS_RATE_FRACTION) {
      return {
        ...base,
        diagnosis: "repelling",
        reason: `${onwardComparisonRate.toFixed(1)}% of the ${fmt(enteringSessions)} sessions entering here go on to view two or more different properties OTHER THAN the page they landed on, against ${bestRate.toFixed(1)}% for the strongest class — landing layout and internal routes to further properties.`,
      };
    }

    // Positive evidence needs no sample-size floor: MIN_COMPARISON_SESSIONS
    // exists to stop an ABSENCE of leads being read as a finding, and there is
    // no absence here.
    if (leadCount > 0) {
      return {
        ...base,
        diagnosis: "healthy",
        reason: `${onwardComparisonRate.toFixed(1)}% of sessions entering here go on to two or more properties other than their landing page, in line with the ${bestRate.toFixed(1)}% best, and ${enquiries(leadCount)} came from pages of this class.`,
      };
    }

    if (onwardComparisonSessions < MIN_COMPARISON_SESSIONS) {
      return {
        ...base,
        diagnosis: "unjudged",
        reason: `${fmt(onwardComparisonSessions)} sessions entered here and went on to two or more properties other than their landing page — below the ${MIN_COMPARISON_SESSIONS} needed to judge whether this class produces enquiries.`,
      };
    }

    if (expectedLeads >= MUTE_MIN_EXPECTED_LEADS) {
      return {
        ...base,
        diagnosis: "mute",
        reason: `${fmt(onwardComparisonSessions)} sessions entered here and went on to two or more properties other than their landing page, which at the site's own rate of enquiries traceable to a page should have produced about ${expectedLeads.toFixed(1)} — none came from a page of this class. Offer, call to action, contact path.`,
      };
    }

    // Where the plan would have emitted `mute` unconditionally. See
    // MUTE_MIN_EXPECTED_LEADS: for a class this thin, zero is the expected
    // outcome even when nothing is wrong, so the honest report is what the
    // evidence cannot support, not a finding.
    return {
      ...base,
      diagnosis: "unjudged",
      reason: `The whole site produced ${enquiries(attributedLeads)} traceable to a page from ${fmt(siteComparisonSessions)} comparison sessions in ${WINDOW_DAYS} days (enquiries reaching us by phone or WhatsApp carry no page and are not counted), so the ${fmt(onwardComparisonSessions)} sessions that entered here and went on to two or more properties other than their landing page would be expected to produce about ${expectedLeads.toFixed(1)} — too few for its zero to mean anything.`,
    };
  });
}
