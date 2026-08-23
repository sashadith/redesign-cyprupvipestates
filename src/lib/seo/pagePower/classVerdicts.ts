import { prisma } from "@/lib/prisma";
import { buildCanonicalMap, canonicalize, localeOfPath } from "@/lib/seo/urlCanonical";
import { templateClassOf, type TemplateClass } from "@/lib/seo/templateClass";
import { getInventory } from "./inventory";
import {
  CLASS_RATE_FRACTION, COMPARISON_PROJECT_PAGES, MIN_COMPARISON_SESSIONS,
  MIN_ENTERING_SESSIONS, WINDOW_DAYS, type ClassVerdict,
} from "./types";

// The two diagnoses that cannot work per page. Only 5 pages on this site clear
// 30 Google clicks in 90 days, so a per-page landing analysis would manufacture
// noise; these are measured on SESSIONS (3,853 in the same window) and reported
// per template class.

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
 * `expectedLeads_c = comparisonSessions_c × attributedLeads / siteComparisonSessions`
 * and `comparisonSessions_c ≤ siteComparisonSessions`, the tight bound is just
 * `expectedLeads_c ≤ attributedLeads`. So the precondition for `mute` is THREE
 * PAGE-ATTRIBUTABLE LEADS SITE-WIDE in the window, plus concentration: at four
 * leads against 282 comparison sessions, one class would need about 212 of those
 * 282. Hundreds, not thousands, and within reach of the traffic this site
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
 *  row is still its first row. */
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

/** `projects` holds DEVELOPMENT SLUGS, not paths — see the note where it is
 *  filled. `entryClass` is stored rather than the entry path because the class
 *  is the only thing this module asks of it, and re-deriving it later would mean
 *  canonicalising the same path twice. */
type Session = { entryClass: TemplateClass | null; projects: Set<string> };

export async function getClassVerdicts(now: Date = new Date()): Promise<ClassVerdict[]> {
  // WINDOW_DAYS whole UTC days ending with today; today is necessarily partial.
  // Deliberately NOT the GSC-lagged window `getPageVerdicts` uses: PageView and
  // Lead are written live, so there is nothing to wait for, and holding back
  // three days of them would discard real sessions to match an unrelated
  // source's latency. The two windows are never joined.
  const since = new Date(utcMidnight(now).getTime() - (WINDOW_DAYS - 1) * DAY);

  const [map, inventory, views, leads] = await Promise.all([
    buildCanonicalMap(),
    getInventory(),
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

  const devSlugs = new Set(inventory.filter((p) => p.kind === "development").map((p) => p.path.split("/").pop() as string));

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

  // `visitorHash` is a daily-rotating cookieless hash, so one "session" is one
  // visitor-DAY: multi-day research counts more than once and returning
  // visitors are invisible. That is a deliberate ceiling of the analytics
  // design (no PII), not a defect to route around here. The day is inside the
  // hash preimage, so the hash alone is a safe session key.
  const sessions = new Map<string, Session>();
  for (const view of views) {
    if (!view.visitorHash) continue;
    const { path, cls } = classify(view.path);
    const session = sessions.get(view.visitorHash) ?? { entryClass: null, projects: new Set<string>() };
    // Rows arrive oldest-first, so the first one seen for a hash is the entry.
    // `templateClassOf` is total — anything it does not recognise becomes
    // `other-landing-page` — so no session is ever dropped for having entered
    // on an unknown page. The cost is that `other-landing-page` is a catch-all
    // that also absorbs utility pages (/book/<token>, thank-you pages) and
    // legacy `/projects/<slug>` pages that are not Developments. Filtering
    // entries down to the CMS inventory instead would shrink the session
    // denominator invisibly, which is the worse trade.
    if (session.entryClass === null) session.entryClass = cls;
    // Keyed by SLUG, not path. A Development is reachable in all four locales,
    // so `/projects/x` and `/de/projects/x` are one property: a visitor using
    // the language switcher on a single property would otherwise register as
    // having compared two, which is precisely the buying signal this whole
    // module is built on. `templateClassOf` only returns `development-page`
    // when the last segment is a known Development slug, so the segment is safe
    // to use as the identity.
    if (cls === "development-page") session.projects.add(path.split("/").pop() as string);
    sessions.set(view.visitorHash, session);
  }

  const entering = new Map<TemplateClass, number>();
  const comparing = new Map<TemplateClass, number>();
  let siteComparisonSessions = 0;
  for (const session of Array.from(sessions.values())) {
    if (session.entryClass === null) continue;
    const isComparison = session.projects.size >= COMPARISON_PROJECT_PAGES;
    entering.set(session.entryClass, (entering.get(session.entryClass) ?? 0) + 1);
    if (isComparison) {
      comparing.set(session.entryClass, (comparing.get(session.entryClass) ?? 0) + 1);
      siteComparisonSessions++;
    }
  }

  // A lead is attributed to the class of the page its FORM sat on, because that
  // is the only link the data supports — PageView and Lead share no session key,
  // so a lead can never be traced back to the journey that produced it. The
  // limitation is real and worth stating: a comparison session spans several
  // classes, and this credits the last one. A blog post that started the
  // research and a development page that closed it both count as the
  // development page. Read `leads` as "enquiries sent FROM this class", never as
  // "enquiries this class earned".
  //
  // A second mismatch follows from it and matters to `mute` below: `leads` is
  // scoped by the page the FORM sat on, while the expectation it is judged
  // against is built from sessions that ENTERED on the class. A class that hosts
  // most of the site's enquiry forms but receives few entries is therefore
  // measured against an expectation built from someone else's traffic, in both
  // directions. The two cannot be reconciled without a session-to-lead key,
  // which the data does not have — so the bar is set where a mismatch of this
  // size cannot manufacture a verdict on its own.
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

  // The null model behind `mute`: leads spread across classes in proportion to
  // comparison volume. Since every comparison session is counted under exactly
  // one entry class, the per-class expectations sum back to `attributedLeads`.
  // It is a yardstick for "would zero have been surprising", not a causal claim.
  const leadsPerComparisonSession = siteComparisonSessions > 0 ? attributedLeads / siteComparisonSessions : 0;

  // The true observed rate for EVERY class, including those below the floor —
  // it is a fact about the class either way, and reporting it keeps NaN out of
  // the record entirely (a NaN would serialise to null and break any consumer
  // calling toFixed on it). The floor governs whether it may be JUDGED, which
  // is decided per class below; only classes clearing it may set the bar.
  const rates = new Map<TemplateClass, number>();
  for (const cls of ALL_CLASSES) {
    const e = entering.get(cls) ?? 0;
    rates.set(cls, e > 0 ? (100 * (comparing.get(cls) ?? 0)) / e : 0);
  }
  const bestRate = Math.max(
    0,
    ...ALL_CLASSES.filter((cls) => (entering.get(cls) ?? 0) >= MIN_ENTERING_SESSIONS).map((cls) => rates.get(cls) ?? 0),
  );

  return ALL_CLASSES.map((cls): ClassVerdict => {
    const enteringSessions = entering.get(cls) ?? 0;
    const comparisonSessions = comparing.get(cls) ?? 0;
    const comparisonRate = rates.get(cls) ?? 0;
    const leadCount = leadsByClass.get(cls) ?? 0;
    const expectedLeads = comparisonSessions * leadsPerComparisonSession;
    const base = { templateClass: cls, enteringSessions, comparisonSessions, comparisonRate, leads: leadCount };

    if (enteringSessions < MIN_ENTERING_SESSIONS) {
      return {
        ...base,
        diagnosis: "unjudged",
        reason: `Only ${fmt(enteringSessions)} sessions entered the site here in ${WINDOW_DAYS} days — below the ${MIN_ENTERING_SESSIONS} needed to judge.`,
      };
    }

    // Reached only when this class itself cleared the floor, so it is one of the
    // classes the bar is drawn from: a zero bar means NO judgeable class
    // produced a single comparison session. Left to fall through, every
    // comparison of the form `0 < 0 * 0.5` is false and each of those classes
    // would be certified against a benchmark that does not exist. Today the
    // MIN_COMPARISON_SESSIONS branch below would happen to catch them — but on a
    // floor over a different quantity, by coincidence, and coincidence is not a
    // guard.
    if (!(bestRate > 0)) {
      return {
        ...base,
        diagnosis: "unjudged",
        reason: `No template class with enough entering sessions to judge produced a single comparison session in ${WINDOW_DAYS} days, so there is no benchmark to measure this one against.`,
      };
    }

    if (comparisonRate < bestRate * CLASS_RATE_FRACTION) {
      return {
        ...base,
        diagnosis: "repelling",
        reason: `${comparisonRate.toFixed(1)}% of the ${fmt(enteringSessions)} sessions entering here go on to compare two or more properties, against ${bestRate.toFixed(1)}% for the strongest class — landing layout and internal routes to further properties.`,
      };
    }

    // Positive evidence needs no sample-size floor: MIN_COMPARISON_SESSIONS
    // exists to stop an ABSENCE of leads being read as a finding, and there is
    // no absence here.
    if (leadCount > 0) {
      return {
        ...base,
        diagnosis: "healthy",
        reason: `${comparisonRate.toFixed(1)}% of entering sessions go on to compare properties, in line with the ${bestRate.toFixed(1)}% best, and ${enquiries(leadCount)} came from pages of this class.`,
      };
    }

    if (comparisonSessions < MIN_COMPARISON_SESSIONS) {
      return {
        ...base,
        diagnosis: "unjudged",
        reason: `${fmt(comparisonSessions)} sessions entered here and went on to compare properties — below the ${MIN_COMPARISON_SESSIONS} needed to judge whether this class produces enquiries.`,
      };
    }

    if (expectedLeads >= MUTE_MIN_EXPECTED_LEADS) {
      return {
        ...base,
        diagnosis: "mute",
        reason: `${fmt(comparisonSessions)} sessions entered here and compared properties, which at the site's own rate of enquiries traceable to a page should have produced about ${expectedLeads.toFixed(1)} — none came from a page of this class. Offer, call to action, contact path.`,
      };
    }

    // Where the plan would have emitted `mute`. See MUTE_MIN_EXPECTED_LEADS: at
    // this site's lead volume zero is the expected outcome for a healthy class,
    // so the honest report is what the evidence cannot support, not a finding.
    return {
      ...base,
      diagnosis: "unjudged",
      reason: `The whole site produced ${enquiries(attributedLeads)} traceable to a page from ${fmt(siteComparisonSessions)} comparison sessions in ${WINDOW_DAYS} days (enquiries by phone, WhatsApp or manual entry carry no page and are not counted), so this class's ${fmt(comparisonSessions)} would be expected to produce about ${expectedLeads.toFixed(1)} — too few for its zero to mean anything.`,
    };
  });
}
