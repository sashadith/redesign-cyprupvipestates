import { prisma } from "@/lib/prisma";
import { getPreviewProject, listProjectIds, type ProjectVM } from "@/app/preview-project/feeds";
import type { UnitVM } from "@/app/preview-project/UnitsView";
import { mirrorAll, devKeyFor, scheduleAppRestart } from "@/lib/imageMirror";
import { recomputeDevelopmentDistances } from "@/lib/developmentDistances";
import { recomputeDevelopmentDerivedState } from "@/lib/developmentDerivedState";

/* Feed sync (Phase 1). Pulls every development of a developer from its feed
   (reusing the feeds.ts adapters → canonical ProjectVM) and upserts into
   Development / DevelopmentUnit, keyed by feedKey ("<dev>:<id>"). Admin edits in
   DevelopmentOverride are NEVER touched. Images are stored as the feed URLs for
   now — the mirroring step (Increment 3) rewrites them to our own URLs. */

const DEV_ACCOUNT: Record<string, { slug: string; name: string }> = {
  "island-blue": { slug: "island-blue", name: "Island Blue" },
  inex: { slug: "inex", name: "INEX" },
  bbf: { slug: "bbf", name: "BBF" },
  aristo: { slug: "aristo", name: "Aristo" },
  pafilia: { slug: "pafilia", name: "Pafilia" },
  domenica: { slug: "domenica", name: "Domenica Group" },
  medousa: { slug: "medousa", name: "Medousa" },
  agg: { slug: "agg", name: "AGG Luxury Homes" },
  squareone: { slug: "square-one", name: "Square One" },
};

async function ensureAccount(dev: string): Promise<string> {
  const meta = DEV_ACCOUNT[dev] ?? { slug: dev, name: dev };
  const acct = await prisma.developerAccount.upsert({
    where: { slug: meta.slug },
    update: {},
    create: { slug: meta.slug, name: meta.name },
  });
  return acct.id;
}

const int = (n: number | null | undefined) => (n != null && Number.isFinite(n) ? Math.round(n) : null);

function developmentRow(vm: ProjectVM, dev: string, feedProjectId: string, accountId: string) {
  const available = vm.units.filter((u) => u.status === "available").length;
  return {
    developerAccountId: accountId,
    dev,
    feedProjectId,
    feedKey: `${dev}:${feedProjectId}`,
    developerName: vm.developerName || vm.publicName || "",
    publicName: vm.publicName || "",
    developer: vm.developer || null,
    category: vm.category || null,
    status: vm.status || null,
    stage: vm.stage || null,
    completion: vm.completion || null,
    energy: vm.energy || null,
    district: vm.district || null,
    town: vm.town || null,
    area: vm.area || null,
    priceFrom: int(vm.priceFrom),
    priceTo: int(vm.priceTo),
    currency: vm.currency || "EUR",
    latitude: vm.center?.lat ?? null,
    longitude: vm.center?.lng ?? null,
    unitsTotal: vm.units.length,
    unitsAvailable: available,
    description: vm.description || null,
    amenities: (vm.amenities ?? []) as any,
    gallery: (vm.gallery ?? []) as any,
    plans: (vm.plans ?? []) as any,
    extraFacts: (vm.extraFacts ?? []) as any,
    syncedAt: new Date(),
  };
}

function unitRow(u: UnitVM, developmentId: string, i: number) {
  return {
    developmentId,
    ref: u.ref || null,
    // feed's own reference code — always fresh from the adapter on every
    // sync of a source:feed unit; the status-only sync's match anchor for
    // source:manual units (see backfillFeedRef / statusOnlySync below).
    feedRef: u.ref || null,
    name: u.name || null,
    label: u.label || null,
    type: u.type || null,
    status: u.status || "available",
    price: int(u.price),
    currency: u.currency || "EUR",
    beds: u.beds || null,
    baths: u.baths || null,
    areaBuilt: u.areaBuilt || null,
    areaPlot: u.areaPlot || null,
    areaVeranda: u.areaVeranda || null,
    floor: u.floor || null,
    orientation: u.orientation || null,
    latitude: u.coords?.lat ?? null,
    longitude: u.coords?.lng ?? null,
    attrs: (u.attrs ?? []) as any,
    amenities: (u.features ?? []) as any,
    photos: (u.photos ?? []) as any,
    plans: (u.plans ?? []) as any,
    sortIndex: i,
  };
}

export type SyncResult = { dev: string; found: number; created: number; updated: number; failed: number };

// Every developer whose units are subject to the full deleteMany+createMany
// sync (syncAll/the daily cron) — the read-only editor gate (Teil 1) and the
// manual/auto toggle (Teil 3) apply to exactly this set. "drive" (its own
// separate sync mechanism, SyncWithDriveButton) and "manual" (no feed at
// all) are deliberately excluded — there is no automated process that would
// ever silently overwrite their units, so there's nothing to guard against.
export const SYNCED_DEVS = ["island-blue", "inex", "bbf", "aristo", "pafilia", "domenica", "medousa", "agg", "squareone"];
// Subset with a real, individually-triggerable feed worth an on-demand pull
// (the admin Force-Sync button, Teil 2). "agg" is excluded — hardcoded
// fixture data, not a live feed; nothing to "pull fresh".
export const FORCE_SYNC_DEVS = SYNCED_DEVS.filter((d) => d !== "agg");

type ProjectSyncOutcome = { ok: boolean; created: boolean; unitsWritten: number; skippedManual: boolean };

// Per-project sync body, shared by syncDeveloperCore's loop (all projects of
// a developer) and syncOneDevelopment (exactly one project, admin Force-Sync
// button) — one implementation, so both call sites get identical protections
// (manual-lock gate, distance recompute, mirroring) with no risk of drift.
async function syncOneProject(dev: string, id: string, accountId: string, opts: { mirror?: boolean } = {}): Promise<ProjectSyncOutcome> {
  const vm = await getPreviewProject(dev, id);
  if (!vm) return { ok: false, created: false, unitsWritten: 0, skippedManual: false };
  const feedKey = `${dev}:${id}`;
  if (opts.mirror) {
    const dk = devKeyFor(feedKey);
    vm.gallery = await mirrorAll(vm.gallery, dk);
    for (const u of vm.units) u.photos = await mirrorAll(u.photos, dk);
  }
  const existing = await prisma.development.findUnique({ where: { feedKey }, select: { id: true } });
  const data = developmentRow(vm, dev, id, accountId);
  const development = existing
    ? await prisma.development.update({ where: { feedKey }, data })
    : await prisma.development.create({ data });
  // Auto recompute (haversine, src/lib/developmentDistances.ts) — resolves
  // override lat/lng first, so a deliberately-corrected admin pin is never
  // clobbered by the feed's own (possibly wrong) coordinates.
  await recomputeDevelopmentDistances(development.id);
  // If a human imported the real unit list (manual units exist), the feed's
  // partial list is ignored entirely — never re-add feed units on top. The
  // Development row above is still refreshed regardless (name/description/
  // gallery/price range/stage/etc.) — only DevelopmentUnit rows are protected.
  const manualUnits = await prisma.developmentUnit.count({ where: { developmentId: development.id, source: "manual" } });
  if (manualUnits > 0) {
    return { ok: true, created: !existing, unitsWritten: 0, skippedManual: true };
  }
  await prisma.developmentUnit.deleteMany({ where: { developmentId: development.id, source: "feed" } });
  if (vm.units.length) await prisma.developmentUnit.createMany({ data: vm.units.map((u, i) => unitRow(u, development.id, i)) });
  await recomputeDevelopmentDerivedState(development.id);
  return { ok: true, created: !existing, unitsWritten: vm.units.length, skippedManual: false };
}

// Core loop, no restart side-effect — syncAll() calls this per developer so a
// full run schedules exactly ONE restart at the end, not one per developer.
async function syncDeveloperCore(dev: string, opts: { mirror?: boolean } = {}): Promise<SyncResult> {
  const accountId = await ensureAccount(dev);
  const ids = await listProjectIds(dev);
  let created = 0, updated = 0, failed = 0;
  for (const id of ids) {
    try {
      const r = await syncOneProject(dev, id, accountId, opts);
      if (!r.ok) { failed++; continue; }
      r.created ? created++ : updated++;
    } catch {
      failed++;
    }
  }
  return { dev, found: ids.length, created, updated, failed };
}

// Public single-developer entry (admin "Sync now" for one dev, debug route) —
// mirroring writes new files under public/uploads/, so it MUST restart the app
// afterward or a fresh request for one of those URLs 404s into the [lang]/[...slug]
// catch-all and crashes (see the big comment on scheduleAppRestart in imageMirror.ts).
// This bit us in production once already: an unrestarted app after a mirror run
// crash-looped on the first request for a newly-mirrored image.
export async function syncDeveloper(dev: string, opts: { mirror?: boolean } = {}): Promise<SyncResult> {
  const result = await syncDeveloperCore(dev, opts);
  if (opts.mirror) scheduleAppRestart();
  return result;
}

export async function syncAll(opts: { mirror?: boolean } = {}): Promise<SyncResult[]> {
  const out: SyncResult[] = [];
  for (const d of SYNCED_DEVS) out.push(await syncDeveloperCore(d, opts));
  if (opts.mirror) scheduleAppRestart();
  return out;
}

// Admin "Units aus Feed neu ziehen" (Force-Sync, Teil 2) — syncs exactly one
// Development immediately, instead of waiting for the 4am cron. Reuses
// syncOneProject verbatim, so it has the exact same manual-lock protection
// as the regular sync: a source:manual Development still gets its
// project-level fields refreshed, but unitsWritten stays 0 (skippedManual
// true) — the caller renders a message that says so explicitly, never a
// silent no-op.
export type SyncOneDevelopmentResult = { ok: boolean; unitsWritten: number; skippedManual: boolean; error?: string };
export async function syncOneDevelopment(developmentId: string, opts: { mirror?: boolean } = {}): Promise<SyncOneDevelopmentResult> {
  const development = await prisma.development.findUnique({ where: { id: developmentId }, select: { dev: true, feedProjectId: true } });
  if (!development?.dev || !development?.feedProjectId) {
    return { ok: false, unitsWritten: 0, skippedManual: false, error: "no feed configured for this development" };
  }
  try {
    const accountId = await ensureAccount(development.dev);
    const r = await syncOneProject(development.dev, development.feedProjectId, accountId, opts);
    if (!r.ok) return { ok: false, unitsWritten: 0, skippedManual: false, error: "feed unavailable or project not found" };
    if (opts.mirror) scheduleAppRestart();
    return { ok: true, unitsWritten: r.unitsWritten, skippedManual: r.skippedManual };
  } catch (e) {
    return { ok: false, unitsWritten: 0, skippedManual: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// One-time transitional backfill for already-manual units whose feedRef was
// never populated (the normal feed sync skips a Development entirely once
// any of its units are source:manual, so feedRef only auto-populates for
// units created fresh by a sync — see unitRow() above). Matches purely on
// the trailing digit run of the unit's own ref/label against the same run
// in the feed's ref, scoped to one Development at a time. Only ever writes
// feedRef via a targeted update() per unit — never touches any other field,
// never deletes/recreates. A unit is matched only if it resolves to EXACTLY
// ONE feed unit AND that feed unit isn't also the best match for a
// different manual unit in the same run; anything else is skipped and
// reported, never guessed.
const trailingDigits = (s: string | null | undefined): string | null => {
  const m = String(s ?? "").trim().match(/(\d+)\s*$/);
  return m ? m[1] : null;
};

export type BackfillFeedRefResult = {
  developmentId: string;
  feedKey: string | null;
  matched: { unitId: string; ref: string | null; label: string | null; feedRef: string }[];
  skipped: { unitId: string; ref: string | null; label: string | null; reason: string }[];
};

export async function backfillFeedRefFromDigits(developmentId: string, opts: { dryRun?: boolean } = {}): Promise<BackfillFeedRefResult> {
  const development = await prisma.development.findUnique({ where: { id: developmentId }, select: { dev: true, feedProjectId: true } });
  if (!development?.dev || !development?.feedProjectId) {
    return { developmentId, feedKey: null, matched: [], skipped: [] };
  }
  const feedKey = `${development.dev}:${development.feedProjectId}`;
  const vm = await getPreviewProject(development.dev, development.feedProjectId);
  if (!vm) return { developmentId, feedKey, matched: [], skipped: [] };

  // Island Blue's own ref ends in digits directly ("CLST-101") — fine as
  // the match key. xml2u's (Domenica/Pafilia) raw ref instead ends in the
  // project-name suffix ("A101ApartmentsInPaphosEnikoMare"), so it never
  // carries a trailing digit run at all; name does, post suffix-stripping
  // ("Apartment A101" — see feeds.ts). Fall back to name's digits ONLY when
  // ref itself has none — the value stored is always the real ref either
  // way, never name. Confirmed via the 2026-07-27 dry run (0/52 Domenica
  // matches on ref alone; 9/33 on riverside once name supplies the key).
  const feedByDigits = new Map<string, string[]>();
  for (const u of vm.units) {
    const d = trailingDigits(u.ref) || trailingDigits(u.name);
    if (!d || !u.ref) continue;
    if (!feedByDigits.has(d)) feedByDigits.set(d, []);
    feedByDigits.get(d)!.push(u.ref);
  }

  const units = await prisma.developmentUnit.findMany({
    where: { developmentId, source: "manual", OR: [{ feedRef: null }, { feedRef: "" }] },
    select: { id: true, ref: true, label: true },
  });

  type Candidate = { u: (typeof units)[number]; feedRef?: string; reason?: string };
  const candidates: Candidate[] = units.map((u) => {
    const d = trailingDigits(u.ref) || trailingDigits(u.label);
    if (!d) return { u, reason: "no trailing digit run in ref/label" };
    const feedMatches = feedByDigits.get(d) || [];
    if (feedMatches.length === 0) return { u, reason: `no feed unit ends in "${d}"` };
    if (feedMatches.length > 1) return { u, reason: `ambiguous — ${feedMatches.length} feed units end in "${d}" (${feedMatches.join(", ")})` };
    return { u, feedRef: feedMatches[0] };
  });

  // Guard against two manual units independently resolving to the same feed
  // unit (only possible if the feed itself has a duplicate trailing digit
  // run across projects sharing a feedKey — belt-and-braces, not expected).
  const feedRefCount = new Map<string, number>();
  for (const c of candidates) if (c.feedRef) feedRefCount.set(c.feedRef, (feedRefCount.get(c.feedRef) ?? 0) + 1);

  const matched: BackfillFeedRefResult["matched"] = [];
  const skipped: BackfillFeedRefResult["skipped"] = [];
  for (const c of candidates) {
    if (!c.feedRef) { skipped.push({ unitId: c.u.id, ref: c.u.ref, label: c.u.label, reason: c.reason! }); continue; }
    if ((feedRefCount.get(c.feedRef) ?? 0) > 1) {
      skipped.push({ unitId: c.u.id, ref: c.u.ref, label: c.u.label, reason: `collision — multiple manual units matched feed ref "${c.feedRef}"` });
      continue;
    }
    matched.push({ unitId: c.u.id, ref: c.u.ref, label: c.u.label, feedRef: c.feedRef });
  }

  if (!opts.dryRun) {
    for (const m of matched) {
      await prisma.developmentUnit.update({ where: { id: m.unitId }, data: { feedRef: m.feedRef } });
    }
  }

  return { developmentId, feedKey, matched, skipped };
}

// Status-only sync: the auto-status half of "manual edits stay manual, but
// availability still tracks the feed" — the normal full sync above skips a
// Development entirely the moment any of its units are source:manual, so
// this is the only path that ever refreshes their status again. Matches
// purely on feedRef (never label/ref/name — those are exactly what a human
// might have retyped) and writes ONLY status; every other field a human may
// have edited is untouched. A unit with no feedRef, or whose feedRef isn't
// present in the CURRENT feed response (unit sold-and-delisted, or the whole
// project pulled), is skipped and counted — never guessed at.
//
// Scoped to feeds with a real per-unit status field: Island Blue and
// Domenica confirmed live (see feeds.ts); Aristo's adapter already parses
// its own Status field the same way, so it's included ready-to-go even
// though no Aristo development currently has manual units — harmless no-op
// until one does. Pafilia/SquareOne have no status field in their feeds at
// all (see the 2026-07-26 investigation), so they're excluded rather than
// silently doing nothing every run. qubehub (inex/bbf) stays out pending
// API access, same as everywhere else this session. Medousa's OLD
// file-based feed had no status field either — its new live XML feed
// (2026-08-03) does (sold|active|reserved), so it's added here too.
export const STATUS_SYNC_DEVS = ["island-blue", "domenica", "aristo", "medousa"];

export type StatusOnlySyncChange = { slug: string; unitRef: string; from: string; to: string };

export type StatusOnlySyncResult = {
  dev: string;
  developmentsChecked: number;
  developmentsSkipped: number; // whole project absent from the current feed response
  matched: number; // manual units whose feedRef resolved in the current feed
  updated: number; // of those, how many actually had a different status
  skipped: number; // manual units with no feedRef, or no match in the current feed
  // One entry per actual write (a subset of `updated`, same count) — never
  // for skips, which stay a pure aggregate number (a real run skips dozens
  // of units with no feedRef; a log line each would be noise, not signal).
  // This is what the A302 investigation (2026-07-27) needed and didn't
  // have: statusOnlySync's aggregate counts alone couldn't tell "was this a
  // genuine sold→available correction or a report artifact" without a raw
  // DB backup diff — a real before/after line makes that a one-line answer.
  changes: StatusOnlySyncChange[];
};

export async function statusOnlySync(devs: string[] = STATUS_SYNC_DEVS): Promise<StatusOnlySyncResult[]> {
  const results: StatusOnlySyncResult[] = [];
  for (const dev of devs) {
    const developments = await prisma.development.findMany({
      where: { dev, units: { some: { source: "manual" } } },
      select: { id: true, feedProjectId: true, slug: true, developerName: true },
    });
    let developmentsSkipped = 0, matched = 0, updated = 0, skipped = 0;
    const changes: StatusOnlySyncChange[] = [];
    for (const development of developments) {
      const vm = await getPreviewProject(dev, development.feedProjectId!);
      if (!vm || !vm.units.length) { developmentsSkipped++; continue; } // whole project gone from the feed — touch nothing
      const feedStatusByRef = new Map<string, string>();
      for (const u of vm.units) if (u.ref) feedStatusByRef.set(u.ref, u.status || "available");

      const manualUnits = await prisma.developmentUnit.findMany({
        where: { developmentId: development.id, source: "manual" },
        select: { id: true, ref: true, feedRef: true, status: true },
      });
      for (const unit of manualUnits) {
        const feedStatus = unit.feedRef ? feedStatusByRef.get(unit.feedRef) : undefined;
        if (feedStatus == null) { skipped++; continue; }
        matched++;
        if (feedStatus !== unit.status) {
          await prisma.developmentUnit.update({ where: { id: unit.id }, data: { status: feedStatus } });
          updated++;
          changes.push({
            slug: development.slug || development.developerName || development.id,
            unitRef: unit.ref || unit.feedRef || unit.id,
            from: unit.status || "(none)",
            to: feedStatus,
          });
        }
      }

      // Recompute the Development-level cache + soldOutSince/returnedToMarketAt
      // from ALL of this project's units (not just the manual ones just
      // touched above) — see recomputeDevelopmentDerivedState()'s own header
      // for why this must run from every unit-status write path. A full feed
      // sync only ever refreshes unitsAvailable/unitsTotal from the FEED's
      // own reported units, and never overwrites source:"manual" rows — so
      // for any development with manual corrections, the cache and the
      // actual unit rows can permanently disagree no matter how often a
      // full sync runs. This is hygiene, not a functional dependency for the
      // cache fields: nothing reads them for display or logic anymore (see
      // feedMissingReminders(), fixed 2026-07-31 to use computeAvailability()
      // instead) — but soldOutSince/returnedToMarketAt ARE load-bearing.
      await recomputeDevelopmentDerivedState(development.id);
    }
    results.push({ dev, developmentsChecked: developments.length, developmentsSkipped, matched, updated, skipped, changes });
  }
  return results;
}
