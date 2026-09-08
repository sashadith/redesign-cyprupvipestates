import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { locationMatch } from "@/lib/crm/matching";
import { publicUrlFor } from "@/lib/crm/inventorySearch";
import { snapshotOf, type SnapshotShape, type SnapshotUnit } from "@/lib/crm/inventorySnapshot";

/* "What changed in the catalogue" (MCP connector Phase 3). Two sources:
   - dated fields that already exist (publishedAt, soldOutSince,
     returnedToMarketAt, DevelopmentUnit.createdAt) — available from day one;
   - the nightly DevelopmentSnapshot rows, diffed against the LIVE state so
     today's changes count immediately. History starts with the first
     capture; coverage.note says so to the model. */

export const CHANGE_TYPES = ["published", "sold_out", "back_on_market", "new_units", "availability_changed", "price_from_changed", "unit_status_changed", "unit_price_changed"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export type DevRef = {
  developmentId: string; name: string; developer: string | null;
  location: { area: string | null; district: string | null; town: string | null };
  publicUrl: ReturnType<typeof publicUrlFor>;
};
// `at` is the exact time for dated events; snapshot-based events only know
// "changed between `since` (the snapshot) and now", so `at` is null there.
export type ChangeEvent = DevRef & { type: ChangeType; at: Date | null; since: Date | null } & Record<string, unknown>;

export type ChangesDevelopment = {
  id: string; publicName: string; developer: string | null; district: string | null; town: string | null; area: string | null; slug: string | null;
  publishStatus: string; publishedAt: Date | null; soldOutSince: Date | null; returnedToMarketAt: Date | null; priceFrom: number | null; priceTo: number | null;
  units: { id: string; ref: string | null; feedRef: string | null; label: string | null; type: string | null; status: string | null; price: number | null; source: string; createdAt: Date }[];
  override: { alias: string | null; district: string | null; town: string | null; area: string | null } | null;
};

export const UNIT_PRICE_THRESHOLD = 0.01;
export const MAX_UNITS_PER_EVENT = 10;
const DAY = 86_400_000;

export function devRef(d: ChangesDevelopment): DevRef {
  const ov = d.override;
  return {
    developmentId: d.id,
    name: ov?.alias || d.publicName,
    developer: d.developer,
    location: { area: ov?.area || d.area || null, district: ov?.district || d.district || null, town: ov?.town || d.town || null },
    publicUrl: publicUrlFor(d.slug, d.publishStatus),
  };
}

const inWindow = (t: Date | null, from: Date, to: Date) => !!t && t.getTime() >= from.getTime() && t.getTime() <= to.getTime();
const pct = (from: number, to: number) => Math.round(((to - from) / from) * 1000) / 10;

export function datedEvents(d: ChangesDevelopment, from: Date, to: Date): ChangeEvent[] {
  if (d.publishStatus !== "published") return [];
  const ref = devRef(d);
  const out: ChangeEvent[] = [];
  if (inWindow(d.publishedAt, from, to)) out.push({ ...ref, type: "published", at: d.publishedAt, since: null });
  // Every soldOutSince is phrased as a lower bound — the 2026-08-01 backfill
  // stamped "now" on projects that had been sold out for longer (see the
  // schema comment and actionCenter/rules/developers.ts).
  if (inWindow(d.soldOutSince, from, to)) out.push({ ...ref, type: "sold_out", at: d.soldOutSince, since: null, sinceIsLowerBound: true });
  const availableNow = d.units.filter((u) => u.status === "available").length;
  if (inWindow(d.returnedToMarketAt, from, to)) out.push({ ...ref, type: "back_on_market", at: d.returnedToMarketAt, since: null, availableNow });
  const fresh = d.units.filter((u) => u.status !== "unlisted" && inWindow(u.createdAt, from, to));
  if (fresh.length) {
    const prices = fresh.map((u) => u.price).filter((p): p is number => p != null);
    const sources = new Set(fresh.map((u) => u.source));
    out.push({
      ...ref, type: "new_units", at: fresh.reduce((m, u) => (u.createdAt > m ? u.createdAt : m), fresh[0].createdAt), since: null,
      count: fresh.length,
      types: Array.from(new Set(fresh.map((u) => u.type).filter((t): t is string => !!t))),
      priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
      source: sources.size > 1 ? "mixed" : (sources.values().next().value as string),
    });
  }
  return out;
}

export function diffSnapshot(ref: DevRef, prev: SnapshotShape & { capturedAt: Date }, current: SnapshotShape, now: Date): ChangeEvent[] {
  const out: ChangeEvent[] = [];
  const base = { ...ref, at: null as Date | null, since: prev.capturedAt };
  if (prev.unitsAvailable !== current.unitsAvailable) {
    out.push({ ...base, type: "availability_changed", from: prev.unitsAvailable, to: current.unitsAvailable, lastUnits: current.unitsAvailable <= 2 && current.unitsAvailable < prev.unitsAvailable });
  }
  if (prev.priceFrom != null && current.priceFrom != null && prev.priceFrom !== current.priceFrom) {
    out.push({ ...base, type: "price_from_changed", from: prev.priceFrom, to: current.priceFrom, pct: prev.priceFrom > 0 ? pct(prev.priceFrom, current.priceFrom) : null });
  }
  const curByKey = new Map(current.units.map((u) => [u.key, u]));
  const statusChanges: { key: string; label: string | null; from: string; to: string; price: number | null }[] = [];
  const priceChanges: { key: string; label: string | null; from: number; to: number; pct: number }[] = [];
  for (const p of prev.units) {
    const c = curByKey.get(p.key);
    if (!c) {
      // Missing from the live listed set of a development that was published
      // in BOTH states means the feed dropped it (the row was flipped to
      // "unlisted", which listedUnits excludes) or a drive/Dropbox sync
      // pruned it — "removed" is the honest label. If either state was not
      // published, that side's unit list was rewritten nightly with fresh
      // ids (see snapshotOf / unitKey) and a gap says nothing.
      if (prev.publishStatus === "published" && current.publishStatus === "published") {
        statusChanges.push({ key: p.key, label: p.label, from: p.status, to: "removed", price: p.price });
      }
      continue;
    }
    if (p.status !== c.status) statusChanges.push({ key: p.key, label: c.label ?? p.label, from: p.status, to: c.status, price: c.price });
    if (p.price != null && c.price != null && p.price > 0 && Math.abs(c.price - p.price) / p.price >= UNIT_PRICE_THRESHOLD) {
      priceChanges.push({ key: p.key, label: c.label ?? p.label, from: p.price, to: c.price, pct: pct(p.price, c.price) });
    }
  }
  if (statusChanges.length) out.push({ ...base, type: "unit_status_changed", count: statusChanges.length, units: statusChanges.slice(0, MAX_UNITS_PER_EVENT), more: Math.max(0, statusChanges.length - MAX_UNITS_PER_EVENT) });
  if (priceChanges.length) out.push({ ...base, type: "unit_price_changed", count: priceChanges.length, units: priceChanges.slice(0, MAX_UNITS_PER_EVENT), more: Math.max(0, priceChanges.length - MAX_UNITS_PER_EVENT) });
  return out;
}

/** Oldest row per development — the caller fetches rows with capturedAt >= window start. */
export function pickPrevSnapshots<T extends { developmentId: string; capturedAt: Date }>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) {
    const cur = m.get(r.developmentId);
    if (!cur || r.capturedAt < cur.capturedAt) m.set(r.developmentId, r);
  }
  return m;
}

export type ChangesParams = { days: number; developmentIds?: string[]; districts?: string[]; types?: ChangeType[]; limit: number; now?: Date };
export type ChangesResult = {
  window: { from: Date; to: Date; days: number };
  coverage: { snapshotBased: boolean; oldestSnapshotAt: Date | null; note: string };
  total: number; returned: number; events: ChangeEvent[];
};

// Snapshots are captured nightly, so the oldest row at/after the window start
// is within a day or two of `from` even after a missed run or two — this
// upper bound keeps the window query from scanning the whole retention
// period. pickPrevSnapshots still keeps the oldest per development.
export const SNAPSHOT_LOOKAHEAD_DAYS = 7;

type SnapshotRow = { developmentId: string; capturedAt: Date; publishStatus: string; priceFrom: number | null; priceTo: number | null; unitsTotal: number; unitsAvailable: number; units: unknown };

// The DevelopmentSnapshot table (migration 20260908120000_add_development_snapshots)
// is additive but not guaranteed to be applied yet — degrade instead of
// throwing an opaque internal error while a deploy is mid-rollout.
async function loadSnapshots(from: Date, developmentIds?: string[]): Promise<{ rows: SnapshotRow[]; oldest: Date | null; missingTable: boolean }> {
  try {
    const [rows, oldest] = await Promise.all([
      prisma.developmentSnapshot.findMany({
        where: {
          capturedAt: { gte: from, lt: new Date(from.getTime() + SNAPSHOT_LOOKAHEAD_DAYS * DAY) },
          ...(developmentIds?.length ? { developmentId: { in: developmentIds } } : {}),
        },
        select: { developmentId: true, capturedAt: true, publishStatus: true, priceFrom: true, priceTo: true, unitsTotal: true, unitsAvailable: true, units: true },
      }),
      prisma.developmentSnapshot.findFirst({ orderBy: { capturedAt: "asc" }, select: { capturedAt: true } }),
    ]);
    return { rows, oldest: oldest?.capturedAt ?? null, missingTable: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      return { rows: [], oldest: null, missingTable: true };
    }
    throw e;
  }
}

export async function inventoryChanges(params: ChangesParams): Promise<ChangesResult> {
  const now = params.now ?? new Date();
  const from = new Date(now.getTime() - params.days * DAY);
  const [developments, snapshots] = await Promise.all([
    prisma.development.findMany({
      where: { publishStatus: "published", ...(params.developmentIds?.length ? { id: { in: params.developmentIds } } : {}) },
      select: {
        id: true, publicName: true, developer: true, district: true, town: true, area: true, slug: true, publishStatus: true, publishedAt: true,
        soldOutSince: true, returnedToMarketAt: true, priceFrom: true, priceTo: true,
        units: { select: { id: true, ref: true, feedRef: true, label: true, type: true, status: true, price: true, source: true, createdAt: true } },
        override: { select: { alias: true, district: true, town: true, area: true } },
      },
    }),
    loadSnapshots(from, params.developmentIds),
  ]);
  const prevs = pickPrevSnapshots(snapshots.rows);
  const districts = (params.districts ?? []).map((s) => s.toLowerCase()).filter(Boolean);

  let events: ChangeEvent[] = [];
  for (const d of developments as ChangesDevelopment[]) {
    const ref = devRef(d);
    if (districts.length && !locationMatch(ref.location, districts, []).districtMatches) continue;
    events.push(...datedEvents(d, from, now));
    const prev = prevs.get(d.id);
    if (prev) events.push(...diffSnapshot(ref, { ...prev, units: prev.units as SnapshotUnit[] }, snapshotOf(d), now));
  }
  if (params.types?.length) events = events.filter((e) => params.types!.includes(e.type));
  events.sort((a, b) => ((b.at ?? b.since)?.getTime() ?? 0) - ((a.at ?? a.since)?.getTime() ?? 0) || a.name.localeCompare(b.name));

  const oldestSnapshotAt = snapshots.oldest;
  const note = snapshots.missingTable
    ? "The development_snapshots table is missing — migration 20260908120000_add_development_snapshots has not been applied yet; only publish, sold-out, back-on-market and new-unit dates are known."
    : oldestSnapshotAt
      ? `Price and unit-level history starts on ${oldestSnapshotAt.toISOString().slice(0, 10)}; before that only publish, sold-out, back-on-market and new-unit dates are known.`
      : "No catalogue snapshot has been taken yet: only publish, sold-out, back-on-market and new-unit dates are known. Price and unit-level changes appear from the first nightly snapshot on.";
  return {
    window: { from, to: now, days: params.days },
    coverage: { snapshotBased: prevs.size > 0, oldestSnapshotAt, note },
    total: events.length,
    returned: Math.min(events.length, params.limit),
    events: events.slice(0, params.limit),
  };
}
