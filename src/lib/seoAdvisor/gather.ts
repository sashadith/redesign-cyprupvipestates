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
import { templateClassOf, templateClassLabel, type TemplateClass } from "@/lib/seo/templateClass";
import { loadSweepEntries } from "@/lib/seo/titleSweepLog";
import { computeTitleSweepComparison } from "@/lib/seo/titleSweepRemeasure";
import { getRecentChangelogEntries, type ChangelogEntry } from "@/lib/seo/siteChangelog";

const DAY = 86_400_000;
const CHANGELOG_LOOKBACK_DAYS = 60;
const asArr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

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
  titleSweep: {
    hasActiveSweep: boolean;
    batchDate?: string;
    daysRemaining?: number;
    urlsInWindow?: number;
  } | null;
  // Routing/content changes (last 60 days) that can shift GSC metrics for
  // reasons unrelated to ranking quality — see docs/SITE-CHANGELOG.md. The
  // ANALYZE step is instructed to attribute an overlapping metric shift to
  // one of these FIRST, before reading it as a ranking problem.
  siteChangelog: ChangelogEntry[];
};

async function gatherCwvSummary() {
  const since = new Date(Date.now() - 4 * DAY); // last few nights of readings
  const rows = await prisma.cwvMetric.findMany({ where: { date: { gte: since } }, orderBy: { date: "desc" } });
  const latestByUrl = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latestByUrl.has(r.url)) latestByUrl.set(r.url, r);

  const byClass = new Map<TemplateClass, { total: number; failing: number; metrics: Set<string> }>();
  for (const [url, r] of Array.from(latestByUrl)) {
    const cls = templateClassOf(url);
    const entry = byClass.get(cls) ?? { total: 0, failing: 0, metrics: new Set<string>() };
    entry.total++;
    const fails: string[] = [];
    if (r.lcp > CWV_LCP_MAX_MS) fails.push("LCP");
    if (r.cls > CWV_CLS_MAX) fails.push("CLS");
    if (r.inp != null && r.inp > CWV_INP_MAX_MS) fails.push("INP");
    if (fails.length) { entry.failing++; fails.forEach((f) => entry.metrics.add(f)); }
    byClass.set(cls, entry);
  }

  return Array.from(byClass.entries()).map(([templateClass, e]) => ({
    templateClass,
    label: templateClassLabel(templateClass),
    totalTracked: e.total,
    failing: e.failing,
    failingMetrics: Array.from(e.metrics),
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
  const entries = await loadSweepEntries();
  if (!entries.length) return null;
  const comparison = await computeTitleSweepComparison();
  if (!comparison) return null;
  const daysRemaining = Math.max(0, Math.ceil((comparison.dueDate.getTime() - Date.now()) / DAY));
  return {
    hasActiveSweep: !comparison.isDue,
    batchDate: comparison.batchDate.toISOString().slice(0, 10),
    daysRemaining,
    urlsInWindow: entries.length,
  };
}

export async function gatherAdvisorPayload(): Promise<AdvisorPayload> {
  const [perLocale, movers, ctrWatchlist, strikingDistance, cwvPerClass, platform, titleSweep] = await Promise.all([
    getLocalePeriodComparison(ADVISOR_PERIOD_DAYS),
    getClickDeltaMovers(ADVISOR_PERIOD_DAYS, 15),
    getCtrWatchlist(),
    getStrikingDistance(ADVISOR_PERIOD_DAYS),
    gatherCwvSummary(),
    gatherPlatformStats(),
    gatherTitleSweepStatus(),
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
    siteChangelog: getRecentChangelogEntries(CHANGELOG_LOOKBACK_DAYS),
  };
}
