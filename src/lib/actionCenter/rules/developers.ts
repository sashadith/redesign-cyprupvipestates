import { prisma } from "@/lib/prisma";
import { computeAvailability, availabilityContradiction } from "@/lib/developmentAvailability";
import { computePublishGate, areaSlugOf } from "@/lib/developmentPublishGate";
import { SYNCED_DEVS } from "@/lib/feedSync";
import type { ActionItem } from "../types";

const DAY = 86_400_000;
const SOLD_OUT_ARCHIVE_REMINDER_DAYS = 60;
const NEW_DEV_WINDOW_DAYS = 7;
const READY_TO_PUBLISH_MIN_AGE_DAYS = 3;
const FEED_MISSING_GRACE_DAYS = 2; // 0-1 days is grace (transient feed hiccups happen); alert from day 2
const FEED_MISSING_ARCHIVE_REMINDER_DAYS = 7; // escalate to ACTION only once real available inventory has been stale this long

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
// Calendar-day difference (not a rolling 24h interval) — matches how "day 2"
// reads intuitively against a fixed once-daily sync, independent of the
// exact hour the cron happened to run.
const daysSinceCalendar = (d: Date): number => {
  const now = new Date();
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startOfThat = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((startOfToday - startOfThat) / DAY);
};

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

// (f) Published/ready development whose source feed no longer lists it.
// syncedAt only advances when the sync loop actually visits a project (see
// feedSync.ts's developmentRow() — it's set unconditionally on every
// successful upsert, for every id listProjectIds() currently returns), so
// its age already IS "days since this dev's feed last confirmed the project
// exists" — no separate "last seen" field needed.
//
// Scoped to SYNCED_DEVS only (confirmed 2026-07-31, not assumed): drive-
// based developments (dev:"drive") update syncedAt on a different,
// inconsistent cadence — only some driveAvailabilitySync.ts code paths
// touch it — and manually-curated developments (dev:"manual") never get one
// at all. Without this scope, the same query picks up 3 drive-devs with
// meaningless "days since" values and 6 manual devs via a NULL syncedAt
// that was never expected to be set — both false positives, not real
// feed-disappearance cases.
//
// A separate itemId namespace (feed-missing:) from sold-out:<id> is
// deliberate — the two conditions are independent (a development can be
// both, either, or neither) and a "don't remind me again" on one must never
// silently suppress the other; the Action Center's dismiss/snooze mechanism
// keys on the exact itemId string, so this falls out for free.
async function feedMissingReminders(): Promise<ActionItem[]> {
  const devs = await prisma.development.findMany({
    where: { dev: { in: SYNCED_DEVS }, publishStatus: { in: ["published", "ready"] } },
    select: { id: true, dev: true, publicName: true, unitsAvailable: true, syncedAt: true, createdAt: true },
  });
  const items: ActionItem[] = [];
  for (const d of devs) {
    const name = d.publicName;
    if (!d.syncedAt) {
      // Never confirmed by a real sync at all — flag immediately, no grace period applies.
      items.push({
        id: `feed-missing:${d.id}`, severity: "INFO", category: "DEVELOPERS",
        title: `${name}: never confirmed by the ${d.dev} feed`,
        description: `Published, but no successful ${d.dev} sync has ever matched this project.`,
        deepLink: `/admin/developments/${d.id}`, since: d.createdAt,
      });
      continue;
    }
    const days = daysSinceCalendar(new Date(d.syncedAt));
    if (days < FEED_MISSING_GRACE_DAYS) continue;
    const dateLabel = new Date(d.syncedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    const unitsClause =
      d.unitsAvailable > 0
        ? `${d.unitsAvailable} available unit${d.unitsAvailable === 1 ? "" : "s"} still advertised with data from ${dateLabel}`
        : `No available units advertised`;
    const severity: ActionItem["severity"] = d.unitsAvailable > 0 && days >= FEED_MISSING_ARCHIVE_REMINDER_DAYS ? "ACTION" : "INFO";
    items.push({
      id: `feed-missing:${d.id}`, severity, category: "DEVELOPERS",
      title: `${name}: missing from the ${d.dev} feed for ${days} day${days === 1 ? "" : "s"}`,
      description: `${unitsClause}, ${days} day${days === 1 ? "" : "s"} since it last appeared in the ${d.dev} feed.`,
      deepLink: `/admin/developments/${d.id}`, since: d.syncedAt,
    });
  }
  return items;
}

export async function developerRules(): Promise<ActionItem[]> {
  const [a, b, c, d, e, f] = await Promise.all([
    soldOutReminders(), newUnpublished(), availabilityContradictions(), readyToPublishBatch(), feedSyncFailures(), feedMissingReminders(),
  ]);
  return [...a, ...b, ...c, ...d, ...e, ...f];
}
