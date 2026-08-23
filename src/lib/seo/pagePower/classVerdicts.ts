import { prisma } from "@/lib/prisma";
import { buildCanonicalMap, canonicalize, localeOfPath } from "@/lib/seo/urlCanonical";
import { templateClassOf, type TemplateClass } from "@/lib/seo/templateClass";
import {
  CLASS_RATE_FRACTION, COMPARISON_PROJECT_PAGES, MIN_COMPARISON_SESSIONS,
  MIN_ENTERING_SESSIONS, MIN_EXPECTED_ONWARD, WINDOW_DAYS, type ClassVerdict,
} from "./types";

// The two diagnoses that cannot work per page. Only 5 pages on this site clear
// 30 Google clicks in 90 days, so a per-page landing analysis would manufacture
// noise; these are measured on SESSIONS (3,853 in the same window) and reported
// per template class.
//
// EVERY production figure quoted in this file — 3,853 sessions, 282 comparison
// sessions, ~26 website leads in 19 months, 148 of 179 leads entered by hand —
// was measured on 2026-08-23, the same run as the thresholds in types.ts. See
// docs/superpowers/specs/2026-08-23-seo-page-power-design.md. Re-measure before
// leaning on one; they are not preferences and they are not eternal.

const DAY = 86_400_000;

/**
 * The `mute` bar: how many enquiries this class would have to be EXPECTED to
 * produce before observing none is evidence of anything.
 *
 * This is not a measured production threshold like the ones in types.ts — it is
 * a derivation, which is why it lives here and not there. The site produced ~26
 * website leads in 19 months, i.e. on the order of four per 90-day window across
 * all five classes. Under a Poisson null with mean λ, the chance of seeing zero
 * is e^-λ: at λ = 0.8 that is 45%, at λ = 0.2 it is 82%. So "this class produced
 * no lead" is the ORDINARY outcome for a perfectly healthy class, and a `mute`
 * verdict gated only on a comparison-session count — the plan's original shape —
 * would fire on nearly every class that clears the floor while carrying no
 * information at all. e^-3 ≈ 5%, so λ ≥ 3 is the point at which silence is
 * surprising rather than expected. Below it this module says so, in words,
 * instead of emitting a finding it cannot support.
 *
 * What that actually requires. Since
 * `expectedLeads_c = onwardComparisonSessions_c × attributedLeads / siteComparisonSessions`
 * and `onwardComparisonSessions_c ≤ siteComparisonSessions`, the tight bound is
 * just `expectedLeads_c ≤ attributedLeads`. So the precondition for `mute` is
 * THREE PAGE-ATTRIBUTABLE LEADS SITE-WIDE in the window, plus concentration: at
 * four leads against 282 comparison sessions, one class would need about 212 of
 * those 282. Hundreds, not thousands, and within reach of the traffic this site
 * already has.
 *
 * The practical consequence, stated plainly: at the site's current lead volume
 * `mute` will not fire, and the reason is the numerator, not the traffic.
 * `attributedLeads` counts only leads carrying a resolvable `pageSource`, and
 * most arrive by phone, WhatsApp or manual entry — 148 of 179 since January 2025
 * were entered by hand — so the realistic page-attributable count in a 90-day
 * window is nought to two, short of three on its own. That is the honest state
 * of the evidence, and the design spec predicted it ("Diagnosis 5 will read
 * unjudged for most classes at first, and that is the honest output"). The
 * diagnosis becomes reachable on its own as page-attributable lead volume grows
 * — no threshold edit needed.
 */
const MUTE_MIN_EXPECTED_LEADS = 3;

/** Same helper as pageVerdicts.ts, for a different reason. There it is because
 *  `SearchMetric.date` is `@db.Date`; here it is because `PageView.visitorHash`
 *  is salted with the UTC DAY (see src/lib/visitorHash.ts), so a session starts
 *  at UTC midnight. A window bound carrying `now`'s time-of-day would slice the
 *  oldest day in half and hand back sessions whose FIRST ROW IS NOT THEIR ENTRY
 *  PAGE — every entry-page-derived number below would be silently wrong for that
 *  day. Truncating the newest day is harmless by comparison: a session's first
 *  row is still its first row.
 *
 *  Carries the same warning as the copy in pageVerdicts.ts, because this module
 *  performs exactly the arithmetic that warning protects: DST is a non-issue and
 *  `DAY = 86_400_000` is exact here, since every bound produced by this function
 *  is a UTC-midnight instant and every comparison against it is absolute-ms — no
 *  local calendar is ever consulted. Do NOT "fix" the subtraction below into a
 *  timezone-aware one. Duplicated rather than shared only because the two
 *  modules justify it differently; keep the two copies identical in behaviour. */
const utcMidnight = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

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
 * The two slug sets are the SAME measurement at two scopes, and keeping them
 * apart is the point:
 *  - `projects` — every distinct Development slug in the session, entry page
 *    included. This is the site-level comparison metric, the approved north-star
 *    figure (282 per quarter), and it is not redefined to suit anything here.
 *  - `onwardProjects` — distinct properties OTHER THAN `entrySlug`, seen after
 *    the entry pageview. This is what a per-class rate must be built on, because
 *    counting the landing property measures a different funnel step for each
 *    class; see `onwardComparisonSessions` in types.ts for the full argument.
 *
 * `entrySlug` exists only to be excluded from `onwardProjects`, and is null when
 * the session did not land on a property at all — in which case there is nothing
 * to exclude and every property seen is onward.
 *
 * All three hold SLUGS, not paths — see the note where they are filled.
 */
type Session = {
  entryClass: TemplateClass;
  entrySlug: string | null;
  projects: Set<string>;
  onwardProjects: Set<string>;
};

export async function getClassVerdicts(now: Date = new Date()): Promise<ClassVerdict[]> {
  // The last WINDOW_DAYS UTC calendar days, the newest of which is today and is
  // therefore only partly elapsed. Deliberately NOT the GSC-lagged window
  // `getPageVerdicts` uses: PageView and Lead are written live, so there is
  // nothing to wait for, and holding back three days of them would discard real
  // sessions to match an unrelated source's latency. The two windows are never
  // joined — but both modules write "in WINDOW_DAYS days" into reason strings an
  // admin reads side by side, and those two spans END three days apart. Say
  // which source a number came from before comparing them.
  const since = new Date(utcMidnight(now).getTime() - (WINDOW_DAYS - 1) * DAY);

  const [map, developments, views, leads] = await Promise.all([
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
    prisma.pageView.findMany({
      where: { createdAt: { gte: since }, isBot: false, isPrefetch: false, isTest: false },
      select: { visitorHash: true, path: true, createdAt: true },
      // `id` is the tie-break, and it is load-bearing: `createdAt` alone leaves
      // rows sharing a timestamp in an order Postgres may return either way, and
      // the FIRST row of each session is read below as its entry page. `id` is
      // an autoincrement written in insertion order, so it settles ties the same
      // way on every run.
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.lead.findMany({
      // Leads with no `pageSource` (phone, WhatsApp, manually entered — 148 of
      // 179 since January 2025 were manual) carry no page to attribute to and
      // are excluded here rather than defaulted anywhere. `Lead.status` is never
      // read: the operator ruled it unusable as a scoring basis.
      where: { createdAt: { gte: since }, pageSource: { not: null } },
      select: { pageSource: true },
    }),
  ]);

  const devSlugs = new Set(developments.map((d) => d.slug).filter((slug): slug is string => slug !== null));

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
    // Keyed by SLUG, not path. A Development is reachable in all four locales,
    // so `/projects/x` and `/de/projects/x` are one property: a visitor using
    // the language switcher on a single property would otherwise register as
    // having compared two, which is precisely the buying signal this whole
    // module is built on. `templateClassOf` only returns `development-page`
    // when the last segment is a known Development slug, so the segment is safe
    // to use as the identity.
    const slug = cls === "development-page" ? (path.split("/").pop() as string) : null;

    const session = sessions.get(view.visitorHash);
    if (session === undefined) {
      // Rows arrive oldest-first, so the first one seen for a hash is the entry
      // pageview. `templateClassOf` is total — anything it does not recognise
      // becomes `other-landing-page` — so no session is ever dropped for having
      // entered on an unknown page. The cost is that `other-landing-page` is a
      // catch-all that also absorbs utility pages (/book/<token>, thank-you
      // pages) and legacy `/projects/<slug>` pages that are not Developments.
      // Filtering entries down to the CMS inventory instead would shrink the
      // session denominator invisibly, which is the worse trade.
      sessions.set(view.visitorHash, {
        entryClass: cls,
        entrySlug: slug,
        projects: slug === null ? new Set<string>() : new Set<string>([slug]),
        // The entry pageview is by definition not onward, so this starts empty
        // even when the session landed ON a property.
        onwardProjects: new Set<string>(),
      });
      continue;
    }
    if (slug !== null) {
      session.projects.add(slug);
      // The landing property is excluded from the onward set for the whole
      // session, not just for its first pageview. `land on x → view y → back to
      // x` is ordinary browsing, and counting that return would let a session
      // entering on a property reach the threshold on ONE further property
      // while every other class still needs two — the same asymmetry, smaller,
      // and running the same direction because `development-page` sets the bar.
      if (slug !== session.entrySlug) session.onwardProjects.add(slug);
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
    if (session.projects.size >= COMPARISON_PROJECT_PAGES) siteComparisonSessions++;
    if (session.onwardProjects.size >= COMPARISON_PROJECT_PAGES) {
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

  // The null model behind `mute`: page-attributable leads spread across the
  // classes in proportion to onward-comparison volume. A yardstick for "would
  // zero have been surprising", not a causal claim.
  //
  // The denominator is the SITE-LEVEL comparison metric (entry page included)
  // while the volume it multiplies is onward-only, so the per-class expectations
  // sum to LESS than `attributedLeads` rather than exactly to it. That is the
  // deliberate direction: it makes `mute` harder to reach, never easier, and
  // under-claiming is the correct failure here. The site-level metric is the
  // approved north-star figure and is not rescoped to tidy up this arithmetic.
  const leadsPerComparisonSession = siteComparisonSessions > 0 ? attributedLeads / siteComparisonSessions : 0;

  // The true observed rate for EVERY class, including those below the floor —
  // it is a fact about the class either way, and reporting it keeps NaN out of
  // the record entirely (a NaN would serialise to null and break any consumer
  // calling toFixed on it). The floor governs whether it may be JUDGED, which
  // is decided per class below; only classes clearing it may set the bar.
  const rates = new Map<TemplateClass, number>();
  for (const cls of ALL_CLASSES) {
    const e = entering.get(cls) ?? 0;
    rates.set(cls, e > 0 ? (100 * (onwardComparing.get(cls) ?? 0)) / e : 0);
  }
  const bestRate = Math.max(
    0,
    ...ALL_CLASSES.filter((cls) => (entering.get(cls) ?? 0) >= MIN_ENTERING_SESSIONS).map((cls) => rates.get(cls) ?? 0),
  );

  return ALL_CLASSES.map((cls): ClassVerdict => {
    const enteringSessions = entering.get(cls) ?? 0;
    const onwardComparisonSessions = onwardComparing.get(cls) ?? 0;
    const onwardComparisonRate = rates.get(cls) ?? 0;
    const leadCount = leadsByClass.get(cls) ?? 0;
    const expectedLeads = onwardComparisonSessions * leadsPerComparisonSession;
    // What this class WOULD have produced at the best class's rate. The bar the
    // `repelling` test moves against, and therefore the right quantity to size
    // the evidence on: a rate can only be told from the bar when the bar itself
    // predicts enough events. For the best class it equals its own observed
    // count exactly, which is the sanity check on the formula.
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

    // Reached only when this class itself cleared the floor, so it is one of the
    // classes the bar is drawn from: a zero bar means NO judgeable class sent a
    // single session onward to two properties. Left to fall through, every
    // comparison of the form `0 < 0 * 0.5` is false and each of those classes
    // would be certified against a benchmark that does not exist. Today the
    // MIN_COMPARISON_SESSIONS branch below would happen to catch them — but on a
    // floor over a different quantity, by coincidence, and coincidence is not a
    // guard.
    if (!(bestRate > 0)) {
      return {
        ...base,
        diagnosis: "unjudged",
        reason: `No template class with enough entering sessions to judge sent a single session on to two or more properties other than the one it landed on in ${WINDOW_DAYS} days, so there is no benchmark to measure this one against.`,
      };
    }

    // Gates the WHOLE engagement axis, not just `repelling`. MIN_ENTERING_SESSIONS
    // bounds the denominator of the rate and nothing bounded the numerator, so a
    // class could clear that floor and still be judged on a handful of onward
    // sessions — measured 2026-08-23, `projects-listing` was called `repelling`
    // on ONE, a 1-in-11 fluke (see MIN_EXPECTED_ONWARD in types.ts for the
    // false-alarm table). Blocking only the `repelling` branch would have handed
    // the same class `healthy` on the same non-evidence with the sign flipped,
    // since that branch asks only for a traced enquiry. One onward session is no
    // more evidence for healthy than against it, so neither verdict is available
    // here and the reason says so outright.
    //
    // Returning `unjudged` rather than falling through to the lead axis hides
    // nothing: `onwardComparisonSessions >= MIN_COMPARISON_SESSIONS` would force
    // this class's own rate to at least 50/enteringSessions, hence
    // `expectedOnward = enteringSessions × bestRate ≥ 50` since `bestRate` is the
    // maximum over judgeable classes — well above this floor. A class gated here
    // can therefore never have been eligible for `mute` anyway.
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

    // Where the plan would have emitted `mute`. See MUTE_MIN_EXPECTED_LEADS: at
    // this site's lead volume zero is the expected outcome for a healthy class,
    // so the honest report is what the evidence cannot support, not a finding.
    return {
      ...base,
      diagnosis: "unjudged",
      reason: `The whole site produced ${enquiries(attributedLeads)} traceable to a page from ${fmt(siteComparisonSessions)} comparison sessions in ${WINDOW_DAYS} days (enquiries by phone, WhatsApp or manual entry carry no page and are not counted), so the ${fmt(onwardComparisonSessions)} sessions that entered here and went on to two or more properties other than their landing page would be expected to produce about ${expectedLeads.toFixed(1)} — too few for its zero to mean anything.`,
    };
  });
}
