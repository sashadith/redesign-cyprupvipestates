import { prisma } from "@/lib/prisma";
import { computeAvailability, availabilityContradiction } from "@/lib/developmentAvailability";
import { computePublishGate, areaSlugOf } from "@/lib/developmentPublishGate";
import { SYNCED_DEVS } from "@/lib/feedSync";
import { WARM_CONTACT_STATUSES } from "./crm";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { developerGroupExists } from "@/lib/developerLink";
import { isDropboxShareUrl } from "@/lib/dropbox";
import type { ActionItem } from "../types";

const DAY = 86_400_000;
const SOLD_OUT_ARCHIVE_REMINDER_DAYS = 60;
const NEW_DEV_WINDOW_DAYS = 7;
const READY_TO_PUBLISH_MIN_AGE_DAYS = 3;
const FEED_MISSING_GRACE_DAYS = 2; // 0-1 days is grace (transient feed hiccups happen); alert from day 2
const FEED_MISSING_ARCHIVE_REMINDER_DAYS = 7; // escalate to ACTION only once real available inventory has been stale this long
const BACK_IN_STOCK_WINDOW_DAYS = 14; // rolling live-query window — see backInStockReminders() below
const MANUAL_STALE_DAYS = 30; // Sascha's own figure for price/availability drift risk (2026-08-13, AGG decision)

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
// out a while. Ages off Development.soldOutSince, the real false->true
// transition stamp (Bündel 2, 2026-08-01; maintained by
// recomputeDevelopmentDerivedState from every write path that can change unit
// status — see the schema comment).
//
// This rule predates that field and used the newest unit row's updatedAt as a
// stand-in for it, on the reasoning that units are what a sold-out
// determination is computed from. The stand-in does not age: the nightly feed
// sync rewrites those rows, so it resets to zero every night. Measured against
// production on 2026-08-24 — all 26 sold-out published developments had a
// newest unit row 0 or 1 days old, while soldOutSince put them at 15 to 22
// days. Across the whole published catalogue, 119 of 148 sat at 0-1 days and
// the oldest anywhere was 44.
//
// The threshold is 60, so the consequence was not a slightly-off date: the
// ACTION tier could never be reached by any development the sync touches, and
// the archive reminder this rule exists for had never once fired. Every
// sold-out project instead showed "Archive reminder in 60 days" — a countdown
// that reset each night and never arrived — and reported `since` as today, so
// the panel (which sorts on `since` within a severity, see ../index.ts) filed
// three-week-old sold-outs as brand new.
//
// Switching the source flips no tier on the day it ships: the oldest
// soldOutSince is 22 days, still short of 60. The first real archive reminder
// lands 2026-09-30.
//
// "at least" / the `+` is not hedging. Developments that were already sold out
// when the field shipped were stamped by a one-off backfill
// (scripts/backfill-sold-out-since.mjs), so their value is a lower bound — 5 of
// the 26 carry the 2026-08-01 rollout date for that reason. The house
// convention is to phrase every soldOutSince the same way rather than try to
// tell backfilled values from real transitions; fmtSoldOutSince in
// src/app/admin/(panel)/developments/page.tsx already does exactly that.
async function soldOutReminders(): Promise<ActionItem[]> {
  const devs = await prisma.development.findMany({
    where: { publishStatus: "published" },
    include: { units: { select: { status: true, updatedAt: true } } },
  });
  const items: ActionItem[] = [];
  for (const d of devs) {
    const { soldOut } = computeAvailability(d.units);
    if (!soldOut) continue;
    // soldOutSince is null only when the derived state has drifted from the
    // units it is derived from — a direct DB/admin status write that skipped
    // recomputeDevelopmentDerivedState, the same class of desync
    // availabilityContradiction() below reports on. None of the 26 sold-out
    // developments was in that state on 2026-08-24. Falling back to the old
    // proxy keeps such a row visible instead of dropping a genuinely sold-out
    // project off the panel, and because the proxy understates age it can only
    // hold the item at INFO — a desynced row can never produce an archive
    // reminder it has not earned.
    const since = d.soldOutSince ?? d.units.reduce((max, u) => (u.updatedAt > max ? u.updatedAt : max), d.updatedAt);
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
      const remaining = SOLD_OUT_ARCHIVE_REMINDER_DAYS - days;
      items.push({
        id: `sold-out:${d.id}`, severity: "INFO", category: "DEVELOPERS",
        title: `${name} is sold out`,
        // The age leads, because it is now a real one. The countdown alone was
        // all this could honestly say while every project looked a day old.
        description: `${days === 0 ? "Sold out today" : `Sold out for ${days}+ day${days === 1 ? "" : "s"}`}. Archive reminder in ${remaining} day${remaining === 1 ? "" : "s"}.`,
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

// (e) Feed/Drive sync failure — per-developer CronRunLog rows written as
// "feed-sync:<devKey>" / "drive-sync:<developerName>" by the cron routes (see
// src/lib/cronLog.ts). Only the LATEST row per job key matters — an old
// failure that a later successful run superseded is not a live condition.
// 2026-08-11 (Olias incident) — this rule's own comment already claimed to
// cover "drive-sync:" too, but the `where` clause never actually did; that
// gap, combined with syncAllDrives()'s aggregate row always logging ok:true
// (see withCronLog in src/lib/cronLog.ts), meant a per-developer Drive sync
// could fail silently for weeks with NO Action Center item at all. A
// "notified:*" marker row (src/lib/cronLog.ts's shouldNotifyFailureStreak)
// is deliberately excluded — it's a Telegram/email throttling bookkeeping
// row, always ok:true, never a real job outcome.
async function feedSyncFailures(): Promise<ActionItem[]> {
  const rows = await prisma.cronRunLog.findMany({
    where: {
      OR: [{ job: { startsWith: "feed-sync:" } }, { job: { startsWith: "drive-sync:" } }],
    },
    orderBy: { ranAt: "desc" },
    take: 500, // per-developer count is small (~10 across both); generous cap, cheap query
  });
  const latestByJob = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latestByJob.has(r.job)) latestByJob.set(r.job, r);

  /* "Latest row per job" only tells the truth while the job still runs. When a
     developer STOPS being covered by drive-sync, its last row is frozen as
     whatever it was — and if that was a failure, this rule reports it forever,
     because no later success can ever arrive to supersede it.

     That is not hypothetical: Kuutio moved to Dropbox on 2026-08-13, the
     nightly drive-sync kept picking it up and failing ("Could not read a folder
     id from the Drive link.") until commit 1e530e1 taught syncAllDrives to skip
     Dropbox accounts on 2026-08-14 — and that correct fix is precisely what
     froze the failure row in place. The URGENT item survived its own cause by
     12 days and went out in the digest again on 2026-08-22.

     A Dropbox developer has its own job ("kuutio-sync", watched by
     systemRules()'s cron-health JOBS list), so nothing goes unwatched here;
     what is dropped is only a stale claim about a job that no longer runs.
     Matched by developer NAME because that is exactly how the drive-sync
     route keys its per-developer rows ("drive-sync:<acct.name>"). */
  const dropboxNames = new Set(
    (await prisma.developerAccount.findMany({ where: { NOT: { driveFolderUrl: null } }, select: { name: true, driveFolderUrl: true } }))
      .filter((a) => isDropboxShareUrl(a.driveFolderUrl))
      .map((a) => a.name),
  );

  const items: ActionItem[] = [];
  for (const [job, row] of Array.from(latestByJob)) {
    if (row.ok) continue;
    const isDrive = job.startsWith("drive-sync:");
    if (isDrive && dropboxNames.has(job.slice("drive-sync:".length))) continue;
    const devKey = job.slice(job.indexOf(":") + 1);
    items.push({
      id: `sync-fail:${job}`, severity: "URGENT", category: "DEVELOPERS",
      title: `${devKey} ${isDrive ? "Drive sync" : "feed"} failed last sync — check logs`,
      description: row.message || "No error detail captured.",
      // Drive developers are keyed by their full display name (spaces/parens),
      // not a feed-sync devKey the ?dev= filter understands — link to the
      // developer list instead of a filtered developments view.
      deepLink: isDrive ? "/admin/developments/developers" : `/admin/developments?dev=${encodeURIComponent(devKey)}`,
      since: row.ranAt,
    });
  }
  return items;
}

// (e2) Feed-completeness guard tripped — a developer's sync was skipped
// entirely this run because too much of its previously-known inventory
// vanished from one day's pull (see checkFeedCompleteness in feedSync.ts).
// Own job-key namespace ("feed-incomplete:", distinct from "feed-sync:") so
// this never collides with feedSyncFailures() above — a blocked run is a
// deliberate skip, not a crash, and the two conditions must stay
// independently visible/snoozable. Same "latest row per job" pattern.
async function feedIncompleteWarnings(): Promise<ActionItem[]> {
  const rows = await prisma.cronRunLog.findMany({
    where: { job: { startsWith: "feed-incomplete:" } },
    orderBy: { ranAt: "desc" },
    take: 500,
  });
  const latestByJob = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latestByJob.has(r.job)) latestByJob.set(r.job, r);

  const items: ActionItem[] = [];
  for (const [job, row] of Array.from(latestByJob)) {
    if (row.ok) continue; // a later, complete sync superseded the block — not a live condition
    const devKey = job.slice("feed-incomplete:".length);
    items.push({
      id: `feed-incomplete:${job}`, severity: "URGENT", category: "DEVELOPERS",
      title: `${devKey} feed looks incomplete — nothing was synced`,
      description: row.message || "A large share of this developer's known units are missing from the feed. Nothing was written; check the feed before the next run.",
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
    select: { id: true, dev: true, publicName: true, syncedAt: true, createdAt: true, units: { select: { status: true } } },
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
    // computeAvailability(), not the Development.unitsAvailable cache column
    // — that column is only ever refreshed by a full feed/drive sync, never
    // by statusOnlySync() or a direct unit-status correction (confirmed
    // 2026-07-31: Trinity Residences' unit was set sold, but its cached
    // count still said 1 available). Every other surface in the app already
    // reads live off DevelopmentUnit rows; this rule was the one exception.
    const { available } = computeAvailability(d.units);
    const dateLabel = new Date(d.syncedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    const unitsClause =
      available > 0
        ? `${available} available unit${available === 1 ? "" : "s"} still advertised with data from ${dateLabel}`
        : `No available units advertised`;
    const severity: ActionItem["severity"] = available > 0 && days >= FEED_MISSING_ARCHIVE_REMINDER_DAYS ? "ACTION" : "INFO";
    items.push({
      id: `feed-missing:${d.id}`, severity, category: "DEVELOPERS",
      title: `${name}: missing from the ${d.dev} feed for ${days} day${days === 1 ? "" : "s"}`,
      description: `${unitsClause}, ${days} day${days === 1 ? "" : "s"} since it last appeared in the ${d.dev} feed.`,
      deepLink: `/admin/developments/${d.id}`, since: d.syncedAt,
    });
  }
  return items;
}

// (g) Development that recently regained available units after being sold
// out — Bündel 2, 2026-08-01. soldOutSince/returnedToMarketAt are set/cleared
// by recomputeDevelopmentDerivedState() (src/lib/developmentDerivedState.ts)
// from every write path that can change unit status; this rule only READS
// returnedToMarketAt, live, same as every other item here — it never writes.
//
// Keyed off returnedToMarketAt (a real stored timestamp), not a recomputed
// available-count comparison done here: computeAvailability()'s own
// `total > 0 && available === 0` guard already ensures returnedToMarketAt
// only gets stamped on a genuine sold-out->available transition, so a whole-
// project feed delisting (Salt/legacy — the dev's rows are never touched at
// all while missing) or a transient units-sub-feed glitch (count briefly
// zeroed, syncedAt still advances) can never produce a false one — see that
// helper's own header for the full reasoning. The live `available <= 0`
// check below only guards the OTHER direction: a development that returned
// and then sold out again within the window shouldn't still read as
// "back in stock" just because returnedToMarketAt hasn't been overwritten
// yet by a third transition.
//
// Separate itemId namespace (back-in-stock:) from sold-out:<id> — same
// reasoning as feed-missing: above: a "don't remind me again" on the
// sold-out reminder must never suppress this unrelated notification, and
// the Action Center's exact-itemId-string snooze match already guarantees
// that (see snooze.ts) — no extra code needed here for the separation to hold.
//
// Lead count: resolveIdentifiedProject() (src/lib/crm/compose/generate.ts)
// is a live regex-parse of Lead.pageSource with no indexed/FK equivalent to
// query against — so this counts leads by a direct "/projects/<slug>"
// substring match on THIS development's own current slug, not the full
// resolution chain (which also falls back through a legacy, since-superseded
// Project model). That can under-count leads whose page URL pointed at an
// old, superseded slug — a deliberate simplification for this notification,
// phrased as "at least N" rather than an exact count. Only non-closed/
// non-lost leads count as a live "warm" contact (WARM_CONTACT_STATUSES,
// shared with crm.ts — one definition, not a second one invented here.
// Deliberately BROADER than crm.ts's own follow-up rule: a KEEP_CONTACT
// lead gets no stale-follow-up nag, but should absolutely still hear when
// their project of interest comes back in stock).
async function backInStockReminders(): Promise<ActionItem[]> {
  const since = new Date(Date.now() - BACK_IN_STOCK_WINDOW_DAYS * DAY);
  const devs = await prisma.development.findMany({
    where: { publishStatus: { in: ["published", "ready"] }, returnedToMarketAt: { gte: since } },
    select: { id: true, slug: true, publicName: true, returnedToMarketAt: true, units: { select: { status: true } } },
  });
  const items: ActionItem[] = [];
  for (const d of devs) {
    if (!d.returnedToMarketAt) continue;
    const { available } = computeAvailability(d.units);
    if (available <= 0) continue; // sold out again within the window — not currently "back in stock"
    const leadCount = d.slug
      ? await prisma.lead.count({
          // Newsletter leads carry a pageSource too — the sign-up form records
          // the page it was submitted from — so without this a subscriber who
          // joined while reading a project page would be reported as someone
          // who "had enquired about this project".
          where: { pageSource: { contains: `/projects/${d.slug}` }, status: { in: [...WARM_CONTACT_STATUSES] }, deletedAt: null, ...EXCLUDE_NEWSLETTER },
        })
      : 0;
    const leadsClause = leadCount > 0
      ? ` — at least ${leadCount} interested lead${leadCount === 1 ? "" : "s"} had enquired about this project.`
      : "";
    items.push({
      id: `back-in-stock:${d.id}`, severity: "INFO", category: "DEVELOPERS",
      title: `${d.publicName} is back in stock (${available} unit${available === 1 ? "" : "s"})`,
      description: `Sold out, now has ${available} available unit${available === 1 ? "" : "s"} again${leadsClause}`,
      deepLink: d.slug && leadCount > 0 ? `/admin/crm?project=${encodeURIComponent(d.slug)}` : `/admin/developments/${d.id}`,
      since: d.returnedToMarketAt,
    });
  }
  return items;
}

// (h) DeveloperAccount with no linked public developer page (Bündel 3
// Schritt 1, 2026-08-01) — see DeveloperAccount.developerTranslationGroupId's
// schema comment. Live: any account with a null link qualifies, no grace
// period (same as sold-out: — snooze/dismiss handles noise, not a timer
// here). Deliberately does NOT try to guess a match — that's exactly what
// the whole linking step was designed to avoid (see the conversation this
// was built from: slug similarity alone was wrong 6 times out of 12).
async function developerNoPageReminders(): Promise<ActionItem[]> {
  const accounts = await prisma.developerAccount.findMany({
    where: { developerTranslationGroupId: null },
    select: { id: true, name: true, createdAt: true },
  });
  return accounts.map((a) => ({
    id: `developer-no-page:${a.id}`, severity: "INFO", category: "DEVELOPERS",
    title: `${a.name} has no public developer page`,
    description: "Link an existing page on this developer's admin screen, or create one under Content → Developers.",
    deepLink: `/admin/developments/developers/${a.id}`, since: a.createdAt,
  }));
}

// (i) DeveloperAccount whose linked translationGroupId no longer resolves to
// ANY Developer row — the group was deleted, or its id changed, after the
// link was made. No formal DB relation exists to catch this automatically
// (see the schema comment), so this rule is the thing that keeps a stale
// link from failing silently. ACTION severity (not INFO like (h)) — this
// used to work and quietly stopped, which is a real regression to fix, not
// a routine "not set up yet" state.
async function developerLinkBrokenReminders(): Promise<ActionItem[]> {
  const accounts = await prisma.developerAccount.findMany({
    where: { developerTranslationGroupId: { not: null } },
    select: { id: true, name: true, developerTranslationGroupId: true, updatedAt: true },
  });
  const items: ActionItem[] = [];
  for (const a of accounts) {
    const exists = await developerGroupExists(a.developerTranslationGroupId!);
    if (exists) continue;
    items.push({
      id: `developer-link-broken:${a.id}`, severity: "ACTION", category: "DEVELOPERS",
      title: `${a.name}: linked developer page no longer exists`,
      description: "Its public profile page was deleted or moved to a different translation group — re-link it on this developer's admin screen.",
      deepLink: `/admin/developments/developers/${a.id}`, since: a.updatedAt,
    });
  }
  return items;
}

// (j) Unconfirmed overlap-sweep candidates (2026-08-03) — legacy Project rows
// that look like the same real building as a Development but aren't linked
// yet (see src/lib/overlapSweep.ts + /admin/content/projects/overlaps). Left
// unreviewed, the legacy page keeps advertising its own (possibly stale)
// price/availability instead of redirecting to the live Development listing
// — exactly the azalea-villas-aristo/serenity-court-aristo case this whole
// feature exists because of. One aggregate item, not one per pair (same
// pattern as readyToPublishBatch above) — with 0-2 new candidates expected
// per night, per-pair items would be noise the admin has to dismiss one by
// one instead of reviewing on the overlaps page where the actual decision
// happens.
//
// A candidate row is "pending" here by the SAME rule the overlaps page
// itself uses (re-derived live from Project.supersededByDevelopmentId /
// overlapRejectedDevelopmentIds, not stored on OverlapCandidate) — the
// instant an admin confirms or rejects a pair, it drops out of this count on
// the very next Action Center computation, no extra bookkeeping needed.
//
// Severity: URGENT when any pending candidate's Development side is
// currently sold out live (computeAvailability — never the cache column,
// same rule as every other availability check in this file) — that's the
// customer-facing case: a legacy page still advertising a sold-out building
// as available, the exact bug azalea-villas-aristo/serenity-court-aristo
// were. Otherwise ACTION — still needs a look, but nothing is actively
// misrepresenting availability to a visitor right now.
//
// Separate itemId namespace (overlap-candidates-pending, singular — no
// per-entity suffix since this is one aggregate item) from every other rule
// in this file — a blanket dismiss-forever elsewhere matches on the exact
// itemId string (see snooze.ts), so it can never silently swallow this one.
async function overlapCandidatesPending(): Promise<ActionItem[]> {
  const candidates = await prisma.overlapCandidate.findMany({
    select: { legacyProjectId: true, developmentId: true, foundAt: true },
  });
  if (!candidates.length) return [];

  const legacyIds = Array.from(new Set(candidates.map((c) => c.legacyProjectId)));
  const devIds = Array.from(new Set(candidates.map((c) => c.developmentId)));
  const [legacyRows, devs] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: legacyIds } },
      select: { id: true, supersededByDevelopmentId: true, overlapRejectedDevelopmentIds: true },
    }),
    prisma.development.findMany({ where: { id: { in: devIds } }, include: { units: { select: { status: true } } } }),
  ]);
  const legacyById = new Map(legacyRows.map((p) => [p.id, p]));
  const devById = new Map(devs.map((d) => [d.id, d]));

  let pendingCount = 0;
  let soldOutCount = 0;
  let oldestFoundAt: Date | null = null;
  for (const c of candidates) {
    const legacy = legacyById.get(c.legacyProjectId);
    if (!legacy) continue;
    const rejected = Array.isArray(legacy.overlapRejectedDevelopmentIds) ? (legacy.overlapRejectedDevelopmentIds as string[]) : [];
    const isPending = legacy.supersededByDevelopmentId !== c.developmentId && !rejected.includes(c.developmentId);
    if (!isPending) continue;
    pendingCount++;
    if (!oldestFoundAt || c.foundAt < oldestFoundAt) oldestFoundAt = c.foundAt;
    const dev = devById.get(c.developmentId);
    if (dev && computeAvailability(dev.units).soldOut) soldOutCount++;
  }
  if (pendingCount === 0) return [];

  const severity: ActionItem["severity"] = soldOutCount > 0 ? "URGENT" : "ACTION";
  const soldOutClause =
    soldOutCount > 0
      ? ` — ${soldOutCount} involve${soldOutCount === 1 ? "s" : ""} a sold-out Development still advertised as available on the legacy page`
      : "";
  return [{
    id: "overlap-candidates-pending", severity, category: "DEVELOPERS",
    title: `${pendingCount} legacy/Development overlap${pendingCount === 1 ? "" : "s"} to review`,
    description: `Unconfirmed duplicate listing${pendingCount === 1 ? "" : "s"} found by the nightly sweep${soldOutClause}.`,
    deepLink: "/admin/content/projects/overlaps", since: oldestFoundAt ?? new Date(),
  }];
}

// (k) Two (or more) DeveloperAccounts claiming the SAME public page
// (2026-08-03, BBF/Domenica incident) — a fangnet alongside the DB's own
// @unique(developerTranslationGroupId) constraint (schema.prisma), not a
// replacement for it: this project runs raw DB writes fairly often
// (several this week alone, including the fix for this exact incident),
// any of which can set this column directly without going through
// setDeveloperPageLink()/the constraint's own application-layer handling.
// URGENT unconditionally — this is precisely the bug class that showed
// one developer's entire live catalog under another's brand with no
// error and no warning; there's no "quiet" version of this condition.
// Separate itemId namespace (developer-link-collision:) from
// developer-link-broken:/developer-no-page: — same reasoning as those two
// already document: a dismiss on one must never swallow an unrelated one.
async function developerLinkCollisions(): Promise<ActionItem[]> {
  const accounts = await prisma.developerAccount.findMany({
    where: { developerTranslationGroupId: { not: null } },
    select: { id: true, name: true, developerTranslationGroupId: true, updatedAt: true },
  });
  const byGroup = new Map<string, typeof accounts>();
  for (const a of accounts) {
    const key = a.developerTranslationGroupId as string;
    byGroup.set(key, [...(byGroup.get(key) ?? []), a]);
  }
  const items: ActionItem[] = [];
  for (const [groupId, group] of Array.from(byGroup)) {
    if (group.length < 2) continue;
    const names = group.map((a) => a.name).join(", ");
    const mostRecent = group.reduce((max, a) => (a.updatedAt > max ? a.updatedAt : max), group[0].updatedAt);
    items.push({
      id: `developer-link-collision:${groupId}`, severity: "URGENT", category: "DEVELOPERS",
      title: `${group.length} developer accounts linked to the same public page`,
      description: `${names} all claim the same public page — one of them is showing the wrong project catalog to visitors. Re-link the wrong one(s) on their own admin screen.`,
      deepLink: `/admin/developments/developers/${group[0].id}`, since: mostRecent,
    });
  }
  return items;
}

// (m) A published Development whose feed gallery/plans/unit-photos have
// drifted from what's actually mirrored (Development.imageDriftDetectedAt
// set — see the schema comment for the full mechanism). The 2026-08-08
// mirror-freeze fix deliberately stops downloading a published project's
// changed images automatically, so this Action Center item is the ONLY
// place that surfaces it — without it, a developer replacing bad renderings
// with real photos would never be noticed. INFO, not ACTION/URGENT: nothing
// is broken on the live site, this is "worth a look", and the admin decides
// via "Reload images" + the New in feed picker whether to act on it.
// One item PER Development (own itemId namespace, image-drift-pending:), not
// one aggregate — same reasoning as developer-link-collision: above, a
// dismiss on one project's drift must never swallow another's.
async function imageDriftPending(): Promise<ActionItem[]> {
  const rows = await prisma.development.findMany({
    where: { publishStatus: "published", imageDriftDetectedAt: { not: null } },
    select: { id: true, publicName: true, imageDriftDetectedAt: true, newFromFeed: true },
  });
  if (!rows.length) return [];
  return rows.map((d) => {
    const counts = (d.newFromFeed as { driftCounts?: { gallery: number; plans: number; units: number } } | null)?.driftCounts;
    const galleryPlans = (counts?.gallery ?? 0) + (counts?.plans ?? 0);
    const units = counts?.units ?? 0;
    const parts = [
      galleryPlans > 0 ? `${galleryPlans} gallery/plan image${galleryPlans === 1 ? "" : "s"}` : null,
      units > 0 ? `${units} unit photo${units === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    return {
      id: `image-drift-pending:${d.id}`, severity: "INFO", category: "DEVELOPERS",
      title: `${d.publicName}: feed images changed since publish`,
      description: `${parts.join(", ") || "Images"} in the feed no longer match what's mirrored — the sync skips re-downloading a published project's images automatically. "Reload images" on the project page mirrors the new ones for review.`,
      deepLink: `/admin/developments/${d.id}`, since: d.imageDriftDetectedAt as Date,
    };
  });
}

// (n) Feed-created project that has never once had any units — 2026-08-13
// (GROSSER AUFTRAG Teil 3/4, Island Blue: Avalon Park/Avalon Valley/Bluvia/
// Pafia City 3 sit in the projects-feed with zero rows in the units-feed).
// A structurally different gap than feedMissingReminders() below: that rule
// only looks at PUBLISHED/READY projects that USED to sync successfully and
// then stopped; this one catches projects that synced fine but never had any
// units to begin with, so they stay "draft" forever and age out of
// newUnpublished()'s 7-day window unnoticed. This isn't something our sync
// can fix (there's nothing in the developer's own feed to import) — it's a
// standing awareness reminder, ACTION not URGENT, same weekly-reminder cadence
// as everything else once it reaches the digest (see digestNotify.ts).
async function emptyDraftReminders(): Promise<ActionItem[]> {
  const devs = await prisma.development.findMany({
    where: { dev: { in: SYNCED_DEVS }, publishStatus: "draft" },
    select: { id: true, publicName: true, developer: true, dev: true, createdAt: true, units: { select: { id: true } } },
  });
  const items: ActionItem[] = [];
  for (const d of devs) {
    if (d.units.length) continue;
    // createdAt, NOT syncedAt: every daily sync re-touches syncedAt on this
    // row even though it finds nothing (the project itself is still present
    // in the feed, just permanently empty), so syncedAt would always read as
    // "just synced" and this project would never cross the grace period —
    // createdAt ("how long has this sat empty since it first appeared") is
    // the only timestamp on this row that actually moves.
    if (daysSinceCalendar(d.createdAt) < FEED_MISSING_GRACE_DAYS) continue;
    items.push({
      id: `empty-draft:${d.id}`, severity: "ACTION", category: "DEVELOPERS",
      title: `${d.developer || d.dev} — ${d.publicName} has no units in the feed`,
      description: `Synced from the ${d.dev} feed but has never had any units — the project itself exists in the developer's feed, but nothing for it in their unit/pricing data. Not fixable on our side.`,
      deepLink: `/admin/developments/${d.id}`, since: d.createdAt,
    });
  }
  return items;
}

// (o) Manually-maintained (dev: "manual") published/ready project whose
// price/availability data hasn't been touched in a while — 2026-08-13 (AGG
// decision: "wenn AGG-Daten manuell sind, veralten sie unbemerkt"). Applies
// to every hand-entered developer, not just AGG (Luma, and any future one)
// — a feed can't silently go stale on its own (feedMissingReminders() below
// already covers that), but a human forgetting to revisit a manual listing
// absolutely can. Anchor is the LATEST of the Development row's own
// updatedAt and every one of its units' updatedAt — editing a unit's price/
// status bumps only that unit's own updatedAt, never its parent Development
// row, so using Development.updatedAt alone would miss exactly the edits
// this rule cares about most.
async function manualDataStaleReminders(): Promise<ActionItem[]> {
  const devs = await prisma.development.findMany({
    where: { dev: "manual", publishStatus: { in: ["published", "ready"] } },
    select: { id: true, publicName: true, developer: true, updatedAt: true, units: { select: { updatedAt: true } } },
  });
  const items: ActionItem[] = [];
  for (const d of devs) {
    const latest = d.units.reduce((max, u) => (u.updatedAt > max ? u.updatedAt : max), d.updatedAt);
    const days = daysSinceCalendar(latest);
    if (days < MANUAL_STALE_DAYS) continue;
    items.push({
      id: `manual-stale:${d.id}`, severity: "ACTION", category: "DEVELOPERS",
      title: `${d.developer}: ${d.publicName} not updated in ${days} days`,
      description: `Manually maintained (no feed) — prices/availability haven't been touched in ${days} days. Worth a quick check that they're still current.`,
      deepLink: `/admin/developments/${d.id}`, since: latest,
    });
  }
  return items;
}

// (p) Per-ACCOUNT manual-sync reminder on a configurable cadence
// (DeveloperAccount.manualSyncReminderDays, set in the developer admin). Distinct
// from manualDataStaleReminders (o) above — that one is per-development and only
// for dev:"manual" projects, whereas this is ONE item per ACCOUNT that is synced
// by hand. AGG is the case it was built for: its source sits behind Cloudflare, so
// the prod cron cannot reach it and it is synced from Claude Code. The manual sync
// refreshes driveSyncedAt, so this item clears itself once the sync has run.
async function manualSyncDue(): Promise<ActionItem[]> {
  const accts = await prisma.developerAccount.findMany({
    where: { manualSyncReminderDays: { not: null } },
    select: { id: true, name: true, manualSyncReminderDays: true, driveSyncedAt: true, createdAt: true },
  });
  const items: ActionItem[] = [];
  for (const a of accts) {
    const cadence = a.manualSyncReminderDays!;
    const last = a.driveSyncedAt ?? a.createdAt;
    const days = daysSinceCalendar(last);
    if (days < cadence) continue;
    // `since` is the day it BECAME due (last synced + cadence): a fixed real
    // timestamp, never "today" or a resetting countdown (see soldOutReminders' note
    // on why a resetting countdown quietly broke the archive reminder).
    const since = new Date(last.getTime() + cadence * DAY);
    const cadenceLabel = cadence === 7 ? "weekly" : cadence === 14 ? "2-weekly" : cadence >= 28 && cadence <= 31 ? "monthly" : `${cadence}-day`;
    items.push({
      id: `manual-sync-due:${a.id}`, severity: "ACTION", category: "DEVELOPERS",
      title: `${a.name}: sync due`,
      description: `${a.driveSyncedAt ? `Last synced ${days} days ago` : "Never synced"} — ${cadenceLabel} manual sync. Run it from Claude Code; it clears once driveSyncedAt updates.`,
      deepLink: `/admin/developments/developers/${a.id}`, since,
    });
  }
  return items;
}

export async function developerRules(): Promise<ActionItem[]> {
  const [a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p] = await Promise.all([
    soldOutReminders(), newUnpublished(), availabilityContradictions(), readyToPublishBatch(), feedSyncFailures(), feedMissingReminders(), backInStockReminders(),
    developerNoPageReminders(), developerLinkBrokenReminders(), overlapCandidatesPending(), developerLinkCollisions(), feedIncompleteWarnings(), imageDriftPending(),
    emptyDraftReminders(), manualDataStaleReminders(), manualSyncDue(),
  ]);
  return [...a, ...b, ...c, ...d, ...e, ...f, ...g, ...h, ...i, ...j, ...k, ...l, ...m, ...n, ...o, ...p];
}
