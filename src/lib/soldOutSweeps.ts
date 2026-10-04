import { prisma } from "@/lib/prisma";
import { recomputeDevelopmentDerivedState } from "@/lib/developmentDerivedState";

/* Two nightly sweeps that move a Development along the "no longer offered"
   path without ever asserting something we cannot know.

   The operator's rule, settled 2026-09-09: a project that leaves its feed is
   marked SOLD OUT rather than archived, because the page keeps its search
   ranking and its traffic that way — and a sold-out Development is already
   excluded from the public listing and from the map (queryFilteredRows /
   getFilteredProjectLocationsByLang), so it stops being offered without the
   URL being thrown away. Archiving is the later, separate step. */

// ── Sweep 1: missing from the feed → sold out ────────────────────────────────

/** Days a Development may be absent from its source before it stops being
    offered. Below this, absence is a feed hiccup — the Action Center's own
    FEED_MISSING_GRACE_DAYS treats 0-1 days as noise for the same reason. */
export const MISSING_FROM_FEED_DAYS = 5;

/* The safeguard that makes this sweep safe at all. syncedAt only advances when
   a sync actually wrote the Development, so a broken feed, a blocked
   completeness guard, or a developer whose cron is simply off freezes EVERY
   one of their projects at the same age. Without this check, five days of an
   outage would mark that developer's entire catalogue sold out, silently —
   the project-level version of the "half the catalogue sold" mistake the feed
   guard already exists to prevent.

   So a project only counts as missing when a SIBLING project of the same
   developer synced recently: one project stale among fresh ones is the project
   being gone; all of them stale is the pipeline being down.

   48 hours, not 24: Drive and SharePoint developers sync on weekly intervals
   and move as a block, so their "fresh" window has to survive a run that
   slipped by a day. Measured 2026-09-09 — Olias all at 1 day, Kuutio all at 6,
   Motive Point and AGG all at 11. */
export const PEER_FRESH_HOURS = 48;

/** A Development whose publishStatus means it is (or is about to be) offered.
    Draft and archived are none of this sweep's business. */
const OFFERED = ["published", "ready"];

export type SoldOutSweepLine = {
  developmentId: string;
  development: string;
  dev: string;
  /** Units flipped from available to unlisted by this sweep. */
  unitsUnlisted: number;
  missingDays: number;
};

/** Decides, from ages alone, whether a project counts as gone. Pure so the
    safeguard can be tested without a database — see
    scripts/qa/sold-out-sweep-check.mjs. */
export function isMissingFromFeed(
  syncedAt: Date | null,
  peerSyncedAt: (Date | null)[],
  now: Date,
): boolean {
  if (!syncedAt) return false; // never synced: a manual row, not a feed row
  const ageMs = now.getTime() - syncedAt.getTime();
  if (ageMs < MISSING_FROM_FEED_DAYS * 86_400_000) return false;
  const freshCutoff = now.getTime() - PEER_FRESH_HOURS * 3_600_000;
  return peerSyncedAt.some((d) => d != null && d.getTime() >= freshCutoff);
}

/**
 * Marks projects that have left their feed as sold out, by unlisting the units
 * that are still advertised as available.
 *
 * `unlisted` rather than `sold` on purpose: it is the status the rest of the
 * system already uses for "no longer in the developer's catalogue", it makes no
 * claim about any individual unit having been bought, and the sync restores it
 * from the feed the moment the project comes back — at which point
 * recomputeDevelopmentDerivedState clears soldOutSince and stamps
 * returnedToMarketAt by itself. Nothing here needs undoing by hand.
 */
export async function markProjectsMissingFromFeedSoldOut(now = new Date()): Promise<SoldOutSweepLine[]> {
  const candidates = await prisma.development.findMany({
    where: { publishStatus: { in: OFFERED }, syncedAt: { not: null }, units: { some: { status: "available" } } },
    select: { id: true, publicName: true, dev: true, developerAccountId: true, syncedAt: true },
  });
  if (!candidates.length) return [];

  // One query for every sibling age, rather than one per candidate.
  const peers = await prisma.development.findMany({
    where: { developerAccountId: { in: Array.from(new Set(candidates.map((c) => c.developerAccountId))) } },
    select: { id: true, developerAccountId: true, syncedAt: true },
  });
  const peersByAccount = new Map<string, { id: string; syncedAt: Date | null }[]>();
  for (const p of peers) {
    const list = peersByAccount.get(p.developerAccountId) ?? [];
    list.push({ id: p.id, syncedAt: p.syncedAt });
    peersByAccount.set(p.developerAccountId, list);
  }

  const out: SoldOutSweepLine[] = [];
  for (const c of candidates) {
    const siblings = (peersByAccount.get(c.developerAccountId) ?? []).filter((p) => p.id !== c.id).map((p) => p.syncedAt);
    if (!isMissingFromFeed(c.syncedAt, siblings, now)) continue;

    const { count } = await prisma.developmentUnit.updateMany({
      where: { developmentId: c.id, status: "available" },
      data: { status: "unlisted" },
    });
    if (!count) continue;
    // Sets soldOutSince (and unitsAvailable/unitsTotal) from the unit rows.
    await recomputeDevelopmentDerivedState(c.id);
    out.push({
      developmentId: c.id,
      development: c.publicName,
      dev: c.dev,
      unitsUnlisted: count,
      missingDays: Math.floor((now.getTime() - c.syncedAt!.getTime()) / 86_400_000),
    });
  }
  return out;
}

// ── Sweep 2: a sold-out page nobody sees any more → archived ────────────────

/** How long a sold-out page must go without a single Google impression before
    it is archived. Impressions, not clicks: measured across the 28 sold-out
    projects on 2026-09-09, 19 had zero CLICKS in 30 days while every single one
    still had impressions — these are niche pages where the expected click count
    at a handful of impressions is well under one, so zero clicks is the normal
    outcome and says nothing. Zero impressions says Google no longer shows the
    page at all, which is the thing we actually care about. 90 days rather than
    30 absorbs seasonality and Search Console's own reporting lag. */
export const DEAD_PAGE_IMPRESSION_DAYS = 90;

export type ArchivedDeadPageLine = { developmentId: string; development: string; dev: string; slug: string };

/** The last path segment of a Search Console page URL, ignoring a trailing
    slash and any query or fragment. */
export function slugFromPage(page: string): string {
  return page.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() ?? "";
}

/** Impressions for one project across every locale prefix its page appears
    under (/projects/x and /de/projects/x are the same project), summed rather
    than guessing which path is canonical. Pure, so the matching can be tested
    without a database. */
export function sumImpressionsForSlug(impressionsByPage: Map<string, number>, slugs: string[]): number {
  const wanted = new Set(slugs.filter(Boolean));
  let total = 0;
  for (const [page, n] of Array.from(impressionsByPage)) if (wanted.has(slugFromPage(page))) total += n;
  return total;
}

export type DeadPageSweepResult = {
  archived: ArchivedDeadPageLine[];
  /** Set when the sweep refused to run; nothing was archived. */
  skipped?: string;
};

/**
 * Archives sold-out projects that Google has stopped showing entirely.
 *
 * Refuses to act when there is no search data for the window at all. Without
 * that check a broken GSC sync reads exactly like "every page is dead" and
 * would archive the whole catalogue — the same failure shape as sweep 1's
 * peer-freshness guard, and just as silent.
 */
export async function archiveSoldOutPagesWithNoImpressions(now = new Date()): Promise<DeadPageSweepResult> {
  const since = new Date(now.getTime() - DEAD_PAGE_IMPRESSION_DAYS * 86_400_000);

  const totalRows = await prisma.searchMetric.count({ where: { query: null, date: { gte: since } } });
  if (totalRows === 0) {
    return { archived: [], skipped: "no Search Console data in the window — refusing to read that as every page being dead" };
  }

  /* A Development's traffic does not necessarily live under its OWN slug. 122
     of 344 developments supersede a legacy Project page whose slug carries a
     developer suffix — Germasogeia View 2 is `germasogeia-view-2` here while
     Search Console reports it under /projects/germasogeia-view-2-island-blue.
     Matching on the Development slug alone found nothing for it and would have
     archived a page with 15 impressions and a click over the window (measured
     2026-09-09). Every superseded slug counts as this project's own. */
  const soldOut = await prisma.development.findMany({
    where: { publishStatus: "published", soldOutSince: { not: null }, slug: { not: null } },
    select: { id: true, publicName: true, dev: true, slug: true, supersedesProjects: { select: { slug: true } } },
  });
  if (!soldOut.length) return { archived: [] };

  // Page-level rows only (query: null); a per-query row would double-count.
  const rows = await prisma.searchMetric.groupBy({
    by: ["page"],
    where: { query: null, date: { gte: since } },
    _sum: { impressions: true },
  });
  const impressionsByPage = new Map(rows.map((r) => [r.page, r._sum.impressions ?? 0]));
  const slugsOf = (d: { slug: string | null; supersedesProjects: { slug: string | null }[] }) =>
    [d.slug, ...d.supersedesProjects.map((x) => x.slug)].filter((x): x is string => !!x);

  const archived: ArchivedDeadPageLine[] = [];
  for (const d of soldOut) {
    if (sumImpressionsForSlug(impressionsByPage, slugsOf(d)) > 0) continue;
    await prisma.development.update({ where: { id: d.id }, data: { publishStatus: "archived" } });
    archived.push({ developmentId: d.id, development: d.publicName, dev: d.dev, slug: d.slug! });
  }
  return { archived };
}
