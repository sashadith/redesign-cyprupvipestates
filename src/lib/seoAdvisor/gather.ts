import { prisma } from "@/lib/prisma";
import { computeAvailability } from "@/lib/developmentAvailability";
import { computePublishGate, areaSlugOf } from "@/lib/developmentPublishGate";
import {
  getLocalePeriodComparison,
  getClickDeltaMovers,
  getStrikingDistance,
  getCtrWatchlist,
  getCwvFailingByClass,
  ADVISOR_PERIOD_DAYS,
  CWV_LCP_MAX_MS,
  CWV_CLS_MAX,
  CWV_INP_MAX_MS,
} from "@/lib/seo/queries";
import type { TemplateClass } from "@/lib/seo/templateClass";
import { loadSweepEntries } from "@/lib/seo/titleSweepLog";
import { computeTitleSweepComparison } from "@/lib/seo/titleSweepRemeasure";
import { getRecentChangelogEntries, type ChangelogEntry } from "@/lib/seo/siteChangelog";
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
import { WINDOW_DAYS as PAGE_POWER_WINDOW_DAYS, type PageDiagnosis, type ClassDiagnosis } from "@/lib/seo/pagePower/types";

const DAY = 86_400_000;
const CHANGELOG_LOOKBACK_DAYS = 60;
const asArr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

// The three diagnoses that name WORK. `healthy` and `unjudged` are reported as
// counts further down rather than dropped — see PAGE_POWER_OTHER_DIAGNOSES.
const PAGE_POWER_ACTIONABLE: readonly PageDiagnosis[] = ["buried", "unclicked", "invisible"];
const PAGE_POWER_OTHER_DIAGNOSES: readonly PageDiagnosis[] = ["healthy", "unjudged"];

/** Impression floor for LISTING a diagnosed page as its own row, as opposed to
 *  counting it inside its pile.
 *
 *  Not a tuned knob. The diagnoses' own floors leave the range [10, 100) empty
 *  of every actionable diagnosis, so this number can neither drop a `buried`
 *  page (which needs MIN_IMPRESSIONS_BURIED = 100 impressions to exist at all)
 *  nor keep an `invisible` one (which needs fewer than MIN_IMPRESSIONS_VISIBLE
 *  = 10). Measured against production on 2026-08-23 it listed 78 of 78 buried
 *  and 12 of 12 unclicked pages, and 0 of 1,118 invisible ones.
 *
 *  That last figure is why it exists. The invisible pile is 67% of the 1,679
 *  verdicts and carries 1,463 impressions between them — 1.3 each — so its
 *  "largest" pages are ten rows of nine impressions apiece, each paying the full
 *  cost of a reason sentence to describe a page no suggestion could ever be
 *  justified on. The PILE is actionable; its individual pages are not. It
 *  therefore arrives as counts, which is the shape the work it asks for
 *  (indexing, internal links) acts on anyway. */
const ADVISOR_MIN_LISTED_IMPRESSIONS = 100;

/** Listed rows per diagnosis, after the floor. Half the `slice(0, 20)` the GSC
 *  lists below use, because the rows are not comparable: a striking-distance row
 *  is ~100 bytes of numbers, while a listed verdict carries a whole reason
 *  sentence. Measured 2026-08-23: at 10 the pagePower block serialises to 8.1 kB
 *  and the payload grows from 10.6 kB to 18.7 kB — the largest single block after
 *  the GSC lists, which is the right order for the only field that names the work
 *  rather than the metric. The cap binds hardest on `buried` (78 pages), where
 *  the ten listed carry 28,611 of the pile's 62,982 impressions and the other
 *  34,371 are disclosed in `omittedImpressions` rather than implied by silence. */
const ADVISOR_MAX_LISTED_PAGES = 10;

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

// Compact, token-conscious payload for the weekly SEO Advisor analysis —
// every number here is already aggregated; the LLM never sees raw rows.
export type AdvisorPayload = {
  periodDays: number;
  gsc: {
    perLocale: Awaited<ReturnType<typeof getLocalePeriodComparison>>;
    winners: Awaited<ReturnType<typeof getClickDeltaMovers>>["winners"];
    losers: Awaited<ReturnType<typeof getClickDeltaMovers>>["losers"];
    ctrWatchlist: Awaited<ReturnType<typeof getCtrWatchlist>>;
    strikingDistance: Awaited<ReturnType<typeof getStrikingDistance>>;
  };
  cwv: {
    thresholds: { lcpMs: number; cls: number; inpMs: number };
    perClass: { templateClass: TemplateClass; label: string; totalTracked: number; failing: number; failingMetrics: string[] }[];
  };
  platform: {
    developmentsPublished: number;
    developmentsDraft: number;
    developmentsArchived: number;
    readyToPublishCount: number;
    newlyPublishedThisWeek: number;
    soldOutCount: number;
    archivedThisWeek: number;
  };
  // One entry per still-active batch (a batch drops off once its window
  // closes) — `urls` is the actual protected list, not just a count, so the
  // Advisor can check a specific candidate URL against it directly instead
  // of just knowing a number of pages are protected somewhere.
  titleSweep: { batchDate: string; daysRemaining: number; urls: string[] }[];
  // Page Power diagnoses, so the ANALYZE step reasons about named piles ("78
  // pages buried below position 20") rather than re-deriving them from raw
  // metrics and inventing its own thresholds. The full table lives at
  // /admin/analytics/seo/power; serialised whole on 2026-08-23 the 1,679
  // verdicts are 658 kB against a 10.6 kB payload — sixty times the rest of it,
  // two thirds of that the invisible pile at 1.3 impressions a page.
  //
  // `notes` is not decoration. Everything a truncated, threshold-derived summary
  // is SILENT about is stated there, because silence reads to a model as "no
  // caveat" — that a pile is longer than the rows shown, that `unjudged` is
  // unmeasured rather than fine, that `mute` cannot fire at this traffic volume,
  // and that a `reason` is the evidence while the diagnosis word is only the
  // label of the threshold it crossed.
  pagePower: {
    /** Both INCLUSIVE, YYYY-MM-DD. Deliberately not `PageVerdictResult.windowEnd`,
     *  which is exclusive: this payload is read by a model that will quote the
     *  dates it is given, and an exclusive bound quoted as a date is wrong. */
    firstDay: string;
    lastDay: string;
    windowDays: number;
    coveragePct: number;
    totalPages: number;
    pages: {
      diagnosis: PageDiagnosis;
      count: number;
      impressions: number;
      listed: { path: string; impressions: number; clicks: number; ctr: number; position: number | null; reason: string }[];
      omittedPages: number;
      omittedImpressions: number;
    }[];
    otherDiagnoses: { diagnosis: PageDiagnosis; count: number; impressions: number }[];
    /** EVERY class, healthy ones included — not just the ones with a finding. A
     *  filtered list cannot be told apart from a short one, so a class that
     *  simply did not appear would be read as certified. */
    classes: { templateClass: TemplateClass; diagnosis: ClassDiagnosis; reason: string }[];
    notes: string[];
  };
  // Routing/content changes (last 60 days) that can shift GSC metrics for
  // reasons unrelated to ranking quality — see docs/SITE-CHANGELOG.md. The
  // ANALYZE step is instructed to attribute an overlapping metric shift to
  // one of these FIRST, before reading it as a ranking problem.
  siteChangelog: ChangelogEntry[];
};

// Delegates to the same lab-aware logic the Action Center rule uses (see
// getCwvFailingByClass in src/lib/seo/queries.ts) instead of re-deriving
// pass/fail here. A prior version of this function compared every reading's
// raw LCP straight against CWV_LCP_MAX_MS regardless of source — since
// fetchCwv() has never returned field (CrUX) data for this origin (no
// real-user traffic clears Google's reporting threshold), every reading was
// lab-only Lantern-simulated LCP, which commonly reads 9700-11500ms on this
// site vs ~3700ms in a real devtools-throttled run. Comparing that straight
// to a 3500ms absolute cutoff manufactured a "100% failing" result every
// week regardless of real page health (see docs/SITE-CHANGELOG.md's "Known
// lab-data caveat for the CWV rule", 2026-07-20). getCwvFailingByClass
// already does the right thing: relative regression against each page's own
// 14-day baseline for lab-sourced rows, absolute threshold only once field
// data actually exists.
async function gatherCwvSummary() {
  const classes = await getCwvFailingByClass();
  return classes.map((c) => ({
    templateClass: c.templateClass,
    label: c.label,
    totalTracked: c.totalTracked,
    failing: c.failingUrls.length,
    failingMetrics: c.failingMetrics,
  }));
}

async function gatherPlatformStats() {
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const [byStatus, newlyPublished, published, approvedAreas] = await Promise.all([
    prisma.development.groupBy({ by: ["publishStatus"], _count: true }),
    prisma.development.count({ where: { publishStatus: "published", publishedAt: { gte: weekAgo } } }),
    prisma.development.findMany({ where: { publishStatus: "published" }, include: { units: { select: { status: true } } } }),
    prisma.areaDescription.findMany({ where: { status: "approved" }, select: { areaSlug: true } }),
  ]);
  const countOf = (s: string) => byStatus.find((b) => b.publishStatus === s)?._count ?? 0;

  const approvedSlugs = new Set(approvedAreas.map((a) => a.areaSlug));
  const unpublished = await prisma.development.findMany({
    where: { publishStatus: { not: "published" } },
    include: { override: true, units: { select: { status: true } } },
  });
  let readyToPublishCount = 0;
  for (const d of unpublished) {
    const ov = d.override;
    const area = ov?.area || d.area || "";
    const gate = computePublishGate({
      description: ov?.descriptionEN || d.description || "",
      area, district: ov?.district || d.district || "",
      lat: ov?.latitude ?? d.latitude, lng: ov?.longitude ?? d.longitude,
      stage: ov?.stage || d.stage, hasAreaDescription: area ? approvedSlugs.has(areaSlugOf(area)) : false,
      gallery: asArr(ov?.gallery).length ? asArr(ov?.gallery) : asArr(d.gallery), mainImage: ov?.mainImage,
      soldOut: computeAvailability(d.units).soldOut,
    });
    if (gate.every((g) => g.ok)) readyToPublishCount++;
  }

  const soldOutCount = published.filter((d) => computeAvailability(d.units).soldOut).length;
  const archivedThisWeek = await prisma.development.count({ where: { publishStatus: "archived", updatedAt: { gte: weekAgo } } });

  return {
    developmentsPublished: countOf("published"),
    developmentsDraft: countOf("draft"),
    developmentsArchived: countOf("archived"),
    readyToPublishCount,
    newlyPublishedThisWeek: newlyPublished,
    soldOutCount,
    archivedThisWeek,
  };
}

async function gatherTitleSweepStatus(): Promise<AdvisorPayload["titleSweep"]> {
  const comparisons = await computeTitleSweepComparison();
  return comparisons
    .filter((c) => !c.isDue)
    .map((c) => ({
      batchDate: c.batchDate.toISOString().slice(0, 10),
      daysRemaining: Math.max(0, Math.ceil((c.dueDate.getTime() - Date.now()) / DAY)),
      urls: c.rows.map((r) => r.page),
    }));
}

async function gatherPagePower(): Promise<AdvisorPayload["pagePower"]> {
  const [pageResult, classes] = await Promise.all([getPageVerdicts(), getClassVerdicts()]);
  const impressionsOf = (rows: { impressions: number }[]) => rows.reduce((sum, v) => sum + v.impressions, 0);

  const pages = PAGE_POWER_ACTIONABLE.map((diagnosis) => {
    const matching = pageResult.verdicts
      .filter((v) => v.diagnosis === diagnosis)
      .sort((a, b) => b.impressions - a.impressions);
    const listable = matching.filter((v) => v.impressions >= ADVISOR_MIN_LISTED_IMPRESSIONS);
    const listed = listable.slice(0, ADVISOR_MAX_LISTED_PAGES);
    return {
      diagnosis,
      count: matching.length,
      impressions: impressionsOf(matching),
      listed: listed.map((v) => ({
        path: v.path,
        impressions: v.impressions,
        clicks: v.clicks,
        // Rounded to what the reason sentences already print. Full precision
        // here would put "4.919977924" beside the reason's "4.92" and invite the
        // model to treat two renderings of one number as two measurements.
        ctr: Number(v.ctr.toFixed(2)),
        position: v.position == null ? null : Number(v.position.toFixed(1)),
        // Verbatim, never re-summarised. The reason is where the nuance lives:
        // that an `invisible` page at position 2.9 has ruled indexing OUT, that
        // a zero bucket median means a CTR cannot be called high or low. A
        // paraphrase would keep the diagnosis and drop exactly the sentence that
        // stops it being over-claimed.
        reason: v.reason,
      })),
      omittedPages: matching.length - listed.length,
      omittedImpressions: impressionsOf(matching) - impressionsOf(listed),
    };
  });

  const otherDiagnoses = PAGE_POWER_OTHER_DIAGNOSES.map((diagnosis) => {
    const matching = pageResult.verdicts.filter((v) => v.diagnosis === diagnosis);
    return { diagnosis, count: matching.length, impressions: impressionsOf(matching) };
  });

  // The last day the window COVERS. `windowEnd` is exclusive (see
  // PageVerdictResult), so the human date is one day earlier.
  const lastDay = new Date(pageResult.windowEnd.getTime() - DAY);

  return {
    firstDay: isoDay(pageResult.windowStart),
    lastDay: isoDay(lastDay),
    windowDays: PAGE_POWER_WINDOW_DAYS,
    coveragePct: Number(pageResult.coveragePct.toFixed(1)),
    totalPages: pageResult.verdicts.length,
    pages,
    otherDiagnoses,
    classes: classes.map((c) => ({ templateClass: c.templateClass, diagnosis: c.diagnosis, reason: c.reason })),
    notes: [
      `Window: ${PAGE_POWER_WINDOW_DAYS} days, ${isoDay(pageResult.windowStart)} to ${isoDay(lastDay)} inclusive — longer than, and ending earlier than, the ${ADVISOR_PERIOD_DAYS}-day GSC figures elsewhere in this payload. The two never sum and are not comparable page by page.`,
      `Truncated on purpose: a pile lists only its pages with at least ${ADVISOR_MIN_LISTED_IMPRESSIONS} impressions, largest first, at most ${ADVISOR_MAX_LISTED_PAGES} of them. 'omittedPages' and 'omittedImpressions' say exactly what each 'listed' array leaves out, so an empty or short 'listed' is never an empty or short pile. The full table is at /admin/analytics/seo/power.`,
      `'reason' is the measured evidence; the diagnosis word is only the label of the threshold that evidence crossed. Build rationales from the reason text and carry its qualifications with it — do not restate the label as if it were the finding.`,
      `'position' is impression-weighted across every query a page ranks for, so a page can carry a poor average position and a healthy CTR at the same time when its clicks come from a few strong queries and its impressions from a long tail of deep ones. That pairing is a query mix, not a contradiction and not a data error: read the CTR before proposing work on a buried page.`,
      `'unjudged' means below a measurement floor, not healthy — those pages are unmeasured, and 'otherDiagnoses' carries the impressions sitting in them. Never report unjudged pages, or an unjudged template class, as fine.`,
      `The class diagnosis 'mute' — comparison traffic arriving but no enquiry traceable to it — cannot fire at this site's traffic volume; such a class is reported 'unjudged' instead. Its absence is not evidence that lead production is healthy.`,
      `Every page here is published and in the CMS inventory; ${Number(pageResult.coveragePct.toFixed(1))}% of GSC clicks in the window resolved onto one. The rest landed on URLs the canonical map does not know, so a page's figures can understate it.`,
    ],
  };
}

export async function gatherAdvisorPayload(): Promise<AdvisorPayload> {
  const [perLocale, movers, ctrWatchlist, strikingDistance, cwvPerClass, platform, titleSweep, pagePower] = await Promise.all([
    getLocalePeriodComparison(ADVISOR_PERIOD_DAYS),
    getClickDeltaMovers(ADVISOR_PERIOD_DAYS, 15),
    getCtrWatchlist(),
    getStrikingDistance(ADVISOR_PERIOD_DAYS),
    gatherCwvSummary(),
    gatherPlatformStats(),
    gatherTitleSweepStatus(),
    gatherPagePower(),
  ]);

  return {
    periodDays: ADVISOR_PERIOD_DAYS,
    gsc: {
      perLocale,
      winners: movers.winners,
      losers: movers.losers,
      ctrWatchlist: ctrWatchlist.slice(0, 20), // cap — the rule already caps to genuine outliers, this just bounds token cost further
      strikingDistance: strikingDistance.slice(0, 20),
    },
    cwv: {
      thresholds: { lcpMs: CWV_LCP_MAX_MS, cls: CWV_CLS_MAX, inpMs: CWV_INP_MAX_MS },
      perClass: cwvPerClass,
    },
    platform,
    titleSweep,
    pagePower,
    siteChangelog: getRecentChangelogEntries(CHANGELOG_LOOKBACK_DAYS),
  };
}
