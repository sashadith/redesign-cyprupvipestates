import { prisma } from "@/lib/prisma";
import { computeAvailability, availabilityContradiction } from "@/lib/developmentAvailability";
import { computePublishGate, areaSlugOf } from "@/lib/developmentPublishGate";
import type { ActionItem } from "../types";

const DAY = 86_400_000;
const SOLD_OUT_ARCHIVE_REMINDER_DAYS = 60;
const NEW_DEV_WINDOW_DAYS = 7;
const READY_TO_PUBLISH_MIN_AGE_DAYS = 3;

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

// (a) Sold-out published development — archive reminder once it's been sold
// out a while. There's no stored "became sold out at" timestamp (no history
// table for that), so `since` uses the most recent unit row's updatedAt as a
// best-effort proxy for "last time this development's data changed" — units
// are what a sold-out determination is computed from, so this is the closest
// available signal.
async function soldOutReminders(): Promise<ActionItem[]> {
  const devs = await prisma.development.findMany({
    where: { publishStatus: "published" },
    include: { units: { select: { status: true, updatedAt: true } } },
  });
  const items: ActionItem[] = [];
  for (const d of devs) {
    const { soldOut } = computeAvailability(d.units);
    if (!soldOut) continue;
    const since = d.units.reduce((max, u) => (u.updatedAt > max ? u.updatedAt : max), d.updatedAt);
    const days = Math.floor((Date.now() - since.getTime()) / DAY);
    const name = d.publicName;
    if (days >= SOLD_OUT_ARCHIVE_REMINDER_DAYS) {
      items.push({
        id: `sold-out:${d.id}`, severity: "ACTION", category: "DEVELOPERS",
        title: `${name} is sold out — archive reminder`,
        description: `Sold out for ${days}+ days — consider archiving.`,
        deepLink: `/admin/developments/${d.id}`, since,
      });
    } else {
      items.push({
        id: `sold-out:${d.id}`, severity: "INFO", category: "DEVELOPERS",
        title: `${name} is sold out`,
        description: `Archive reminder in ${SOLD_OUT_ARCHIVE_REMINDER_DAYS - days} day${SOLD_OUT_ARCHIVE_REMINDER_DAYS - days === 1 ? "" : "s"}.`,
        deepLink: `/admin/developments/${d.id}`, since,
      });
    }
  }
  return items;
}

// (b) New development appeared via sync in the last 7 days, still unpublished.
async function newUnpublished(): Promise<ActionItem[]> {
  const since = new Date(Date.now() - NEW_DEV_WINDOW_DAYS * DAY);
  const devs = await prisma.development.findMany({
    where: { createdAt: { gte: since }, publishStatus: { not: "published" } },
    select: { id: true, publicName: true, developer: true, dev: true, createdAt: true },
  });
  return devs.map((d) => ({
    id: `new-dev:${d.id}`, severity: "ACTION", category: "DEVELOPERS",
    title: `${d.developer || d.dev} added ${d.publicName} — review it`,
    description: "New from sync, not yet published.",
    deepLink: `/admin/developments/${d.id}`, since: d.createdAt,
  }));
}

// (c) Availability contradiction (stage/status claims sold out, units disagree)
// — see src/lib/developmentAvailability.ts for the bug this guards against
// (Celestia, 2026-07-17). `since` uses Development.updatedAt as the best
// available proxy for "when this contradiction was last touched/introduced".
async function availabilityContradictions(): Promise<ActionItem[]> {
  const devs = await prisma.development.findMany({
    where: { publishStatus: { not: "archived" } },
    include: { units: { select: { status: true } }, override: { select: { stage: true } } },
  });
  const items: ActionItem[] = [];
  for (const d of devs) {
    const { soldOut, available } = computeAvailability(d.units);
    // Override wins — see DevelopmentOverride.stage's schema comment.
    const warning = availabilityContradiction(d.override?.stage || d.stage, d.status, soldOut, available);
    if (!warning) continue;
    items.push({
      id: `avail-contradiction:${d.id}`, severity: "ACTION", category: "DEVELOPERS",
      title: `${d.publicName}: availability contradiction`,
      description: warning,
      deepLink: `/admin/developments/${d.id}`, since: d.updatedAt,
    });
  }
  return items;
}

// (d) Ready-to-publish batch — one aggregate item, not one per development
// (per spec: "X developments are ready to publish"). "Ready" reuses the exact
// same computePublishGate check as the Publishing Queue page, so the two
// surfaces can never disagree on what "ready" means.
async function readyToPublishBatch(): Promise<ActionItem[]> {
  const minAge = new Date(Date.now() - READY_TO_PUBLISH_MIN_AGE_DAYS * DAY);
  const [devs, approvedAreas] = await Promise.all([
    prisma.development.findMany({
      where: { publishStatus: { not: "published" }, createdAt: { lte: minAge } },
      include: { override: true, units: { select: { status: true } } },
    }),
    prisma.areaDescription.findMany({ where: { status: "approved" }, select: { areaSlug: true } }),
  ]);
  const approvedSlugs = new Set(approvedAreas.map((a) => a.areaSlug));
  let readyCount = 0;
  let oldestCreatedAt: Date | null = null;
  for (const d of devs) {
    const ov = d.override;
    const area = ov?.area || d.area || "";
    const gate = computePublishGate({
      description: ov?.descriptionEN || d.description || "",
      area, district: ov?.district || d.district || "",
      lat: ov?.latitude ?? d.latitude, lng: ov?.longitude ?? d.longitude,
      stage: ov?.stage || d.stage, hasAreaDescription: area ? approvedSlugs.has(areaSlugOf(area)) : false,
      gallery: arr(ov?.gallery).length ? arr(ov?.gallery) : arr(d.gallery), mainImage: ov?.mainImage,
      soldOut: computeAvailability(d.units).soldOut,
    });
    if (gate.every((g) => g.ok)) {
      readyCount++;
      if (!oldestCreatedAt || d.createdAt < oldestCreatedAt) oldestCreatedAt = d.createdAt;
    }
  }
  if (readyCount === 0) return [];
  return [{
    id: "publishing-queue:ready-batch", severity: "INFO", category: "DEVELOPERS",
    title: `${readyCount} development${readyCount === 1 ? "" : "s"} ready to publish`,
    description: "All data checks pass, still unpublished for 3+ days.",
    deepLink: "/admin/developers/publishing-queue?ready=1", since: oldestCreatedAt ?? minAge,
  }];
}

// (e) Feed sync failure — per-developer CronRunLog rows written as
// "feed-sync:<devKey>" / "drive-sync:<developerName>" by the cron routes (see
// src/lib/cronLog.ts). Only the LATEST row per job key matters — an old
// failure that a later successful run superseded is not a live condition.
async function feedSyncFailures(): Promise<ActionItem[]> {
  const rows = await prisma.cronRunLog.findMany({
    where: { job: { startsWith: "feed-sync:" } },
    orderBy: { ranAt: "desc" },
    take: 500, // per-developer count is small (~9); generous cap, cheap query
  });
  const latestByJob = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latestByJob.has(r.job)) latestByJob.set(r.job, r);

  const items: ActionItem[] = [];
  for (const [job, row] of Array.from(latestByJob)) {
    if (row.ok) continue;
    const devKey = job.slice("feed-sync:".length);
    items.push({
      id: `sync-fail:${job}`, severity: "URGENT", category: "DEVELOPERS",
      title: `${devKey} feed failed last sync — check logs`,
      description: row.message || "No error detail captured.",
      deepLink: `/admin/developments?dev=${encodeURIComponent(devKey)}`, since: row.ranAt,
    });
  }
  return items;
}

export async function developerRules(): Promise<ActionItem[]> {
  const [a, b, c, d, e] = await Promise.all([
    soldOutReminders(), newUnpublished(), availabilityContradictions(), readyToPublishBatch(), feedSyncFailures(),
  ]);
  return [...a, ...b, ...c, ...d, ...e];
}
