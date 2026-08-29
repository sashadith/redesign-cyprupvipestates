import { prisma } from "@/lib/prisma";
import { getPreviewProject, listProjectIds, mitoClusters, mitoVm, type MitoCluster, type ProjectVM } from "@/app/preview-project/feeds";
import type { UnitVM } from "@/app/preview-project/UnitsView";
import { mirrorAll, mirrorImage, devKeyFor, scheduleAppRestart, beginSyncWindow, sourceUrlHash, hashFromMirroredUrl, classifyByContent } from "@/lib/imageMirror";
import { recomputeDevelopmentDistances } from "@/lib/developmentDistances";
import { recomputeDevelopmentDerivedState } from "@/lib/developmentDerivedState";

/* Feed sync (Phase 1). Pulls every development of a developer from its feed
   (reusing the feeds.ts adapters → canonical ProjectVM) and upserts into
   Development / DevelopmentUnit, keyed by feedKey ("<dev>:<id>"). Admin edits in
   DevelopmentOverride are NEVER touched. Images are stored as the feed URLs for
   now — the mirroring step (Increment 3) rewrites them to our own URLs. */

// A cluster matches an existing Mito development within this distance. Same
// figure as the clustering threshold in feeds.ts, and for the same reason: on
// the live feed every gap between two different projects is over 400 m, so 150
// separates them with room on both sides.
const MITO_MATCH_M = 150;

export const DEV_ACCOUNT: Record<string, { slug: string; name: string }> = {
  "island-blue": { slug: "island-blue", name: "Island Blue" },
  inex: { slug: "inex", name: "INEX" },
  bbf: { slug: "bbf", name: "BBF" },
  aristo: { slug: "aristo", name: "Aristo" },
  pafilia: { slug: "pafilia", name: "Pafilia" },
  domenica: { slug: "domenica", name: "Domenica Group" },
  // slug "medousa-xml" (2026-08-03), not "medousa" — the old file-based-era
  // DeveloperAccount (slug "medousa") was deleted along with its 16 unpublished
  // drafts when the old adapter was retired; the account the admin manually
  // created for this new live feed has slug "medousa-xml". ensureAccount()
  // below upserts by this exact slug — leaving it as the old "medousa" would
  // silently create a THIRD, empty, disconnected account on the next sync
  // instead of attaching to the one already configured.
  medousa: { slug: "medousa-xml", name: "Medousa (XML)" },
  // slug "mito-xml", not "mito" — the same trap as medousa above. The account
  // the admin created for this feed on 2026-08-28 has that slug, and
  // ensureAccount upserts by it; without this entry the first sync would create
  // a second, empty account and attach every Mito project to it.
  mito: { slug: "mito-xml", name: "Mito (XML)" },
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

// One line per unit that flipped to "unlisted" this run — the detail behind
// the "N units removed from the feed" notification (src/lib/feedNotifications.ts).
export type UnitChangeLine = { developmentId: string; development: string; ref: string; label: string };

export type SyncResult = {
  dev: string; found: number; created: number; updated: number; failed: number; mirroredNewFiles: boolean;
  // unitsWritten is every feed unit this run put in the database; unitsCreated
  // counts only the ones that are NEW to an already-published project.
  //
  // They differ for a reason, and the difference used to be invisible. An
  // unpublished development takes the deleteMany + createMany path, which
  // rewrites its whole unit list every run — so "created" there would be all of
  // them, every night, and the "N new units awaiting review" notification would
  // cry wolf. unitsCreated is deliberately left at 0 for that path.
  //
  // The cost was that a first import reported `created: 4, unitsCreated: 0` and
  // read as "four projects, no units" — it briefly fooled the person who wrote
  // the adapter. unitsWritten says what actually happened without touching what
  // the notification keys off.
  unitsWritten: number;
  unitsCreated: number; unitsUnlisted: UnitChangeLine[];
  // Feed-completeness guard tripped (see checkFeedCompleteness below) — this
  // developer's sync was skipped entirely this run, nothing written at all,
  // found/created/updated/failed are meaningless zeros for it.
  blocked?: boolean;
  blockedMessage?: string;
  blockedMissing?: number;
  blockedTotal?: number;
};

// Every developer whose units are subject to the full deleteMany+createMany
// sync (syncAll/the daily cron) — the read-only editor gate (Teil 1) and the
// manual/auto toggle (Teil 3) apply to exactly this set. "drive" (its own
// separate sync mechanism, SyncWithDriveButton) and "manual" (no feed at
// all) are deliberately excluded — there is no automated process that would
// ever silently overwrite their units, so there's nothing to guard against.
// "agg" removed 2026-08-13 — was never a real feed (a one-time Cloudflare-
// scrape fixture), AGG is now maintained manually like Luma and every other
// hand-entered developer (dev: "manual").
// "mito" (2026-08-28) is in this list out of necessity, not just for the cron.
// SYNCED_DEVS also gates the admin sync controls (developments/[id]/page.tsx),
// and the developer page's own "Sync now" button only renders when the account
// ALREADY has a development carrying a feed dev key — which Mito, with zero
// projects, does not. Without this entry there is no way to run a first sync at
// all, and syncMitoCore would be unreachable code.
export const SYNCED_DEVS = ["island-blue", "inex", "bbf", "aristo", "pafilia", "domenica", "medousa", "squareone", "mito"];
// Subset with a real, individually-triggerable feed worth an on-demand pull
// (the admin Force-Sync button, Teil 2).
export const FORCE_SYNC_DEVS = SYNCED_DEVS;

type ProjectSyncOutcome = {
  ok: boolean; created: boolean; unitsWritten: number; skippedManual: boolean; mirroredNewFiles: boolean;
  developmentId?: string; developmentName?: string;
  unitsCreated: number; unitsUnlisted: { ref: string; label: string }[];
};

// Customer-facing catalogue fields, frozen once a Development is published —
// an admin's careful hand-edits (public name, description, amenities,
// curated gallery/plans) must never be silently reverted by a routine sync.
// Everything else keeps syncing normally: unit data (price/area/status) via
// syncFeedUnitsPreservingUnlisted below, and every other Development-level
// field (district/town/area/stage/completion/energy/coordinates/price/etc.)
// — mapRowToVM() (developmentRender.ts) already resolves ALL of those
// override-first, so an admin correction there is separately protected and
// staying live-tracking the feed for the rest is exactly what's wanted.
// Confirmed 2026-08-06 by reading mapRowToVM() directly, not assumed.
const FROZEN_WHEN_PUBLISHED = ["publicName", "description", "amenities", "gallery", "plans"] as const;

// Published developments: never hard-delete a feed-sourced unit that
// disappears from today's feed pull — a customer may already be looking at
// it (Client Presentation, browser tab, an earlier email). Diff against the
// fresh feed by ref instead: matched units update in place, new units are
// created, and units no longer in the feed flip to "unlisted" (row otherwise
// untouched — photos, price, area, ref, feedRef all survive) rather than
// being deleted. See the Salt/legacy investigation (2026-08-06) for why
// "gone from the feed" must never be conflated with "sold". A unit already
// "sold" (or already "unlisted") stays put even once it disappears — same
// hard rule as statusOnlySync below: sold is terminal, never silently
// reinterpreted from feed noise, and there's no point re-flagging an already-
// unlisted row every single day.
async function syncFeedUnitsPreservingUnlisted(
  developmentId: string,
  freshUnits: UnitVM[],
  opts: { freezeExistingUnitMedia?: boolean } = {},
): Promise<{ written: number; createdCount: number; unlisted: { ref: string; label: string }[] }> {
  const existing = await prisma.developmentUnit.findMany({
    where: { developmentId, source: "feed" },
    select: { id: true, ref: true, status: true, label: true, name: true },
  });
  const existingByRef = new Map<string, (typeof existing)[number]>();
  for (const u of existing) if (u.ref) existingByRef.set(u.ref, u);
  const freshRefs = new Set(freshUnits.map((u) => u.ref).filter(Boolean));

  let written = 0, createdCount = 0;
  for (let i = 0; i < freshUnits.length; i++) {
    const u = freshUnits[i];
    const row = unitRow(u, developmentId, i);
    const match = u.ref ? existingByRef.get(u.ref) : undefined;
    if (match) {
      // Photos/plans on an ALREADY-KNOWN unit of a published development are
      // never mirrored in the first place when frozen (see syncOneProject) —
      // `row.photos`/`row.plans` here would still be the feed's raw external
      // URLs (mirroring was skipped, not the field), so writing them as-is
      // would overwrite a correctly-mirrored local URL with a live hotlink.
      // Omit both keys entirely so the update leaves them untouched, exactly
      // like FROZEN_WHEN_PUBLISHED does for the Development row itself. A
      // genuinely NEW unit (no match) always gets the full row below,
      // photos/plans included — "new units get their photos once" holds.
      const data = opts.freezeExistingUnitMedia ? (({ photos, plans, ...rest }) => rest)(row) : row;
      await prisma.developmentUnit.update({ where: { id: match.id }, data });
    } else {
      await prisma.developmentUnit.create({ data: row });
      createdCount++;
    }
    written++;
  }

  const unlisted: { ref: string; label: string }[] = [];
  for (const old of existing) {
    if (!old.ref || freshRefs.has(old.ref)) continue; // no stable key to diff, or still present
    if (old.status === "sold" || old.status === "unlisted") continue; // hard rule / already flagged
    await prisma.developmentUnit.update({ where: { id: old.id }, data: { status: "unlisted" } });
    unlisted.push({ ref: old.ref, label: old.label || old.name || old.ref });
  }
  return { written, createdCount, unlisted };
}

// Per-project sync body, shared by syncDeveloperCore's loop (all projects of
// a developer) and syncOneDevelopment (exactly one project, admin Force-Sync
// button) — one implementation, so both call sites get identical protections
// (manual-lock gate, distance recompute, mirroring) with no risk of drift.
// opts.vm: a pre-fetched ProjectVM, used by syncDeveloperCore so the feed-
// completeness guard (checkFeedCompleteness) and the actual sync share one
// fetch instead of two. undefined (the syncOneDevelopment call site) means
// "fetch it fresh here"; null means "already looked up, not found".

// Classifies fresh source URLs against what's already stored for the SAME
// scope (one project's gallery, or one unit's own photos — never mix
// scopes, or a candidate could spuriously "match" an unrelated room).
// Cheap hash comparison first (no network); anything that mismatches by
// hash is checked against VerifiedDuplicateImage (a vendor's URL-only churn,
// confirmed 2026-08-08 for Weblium/Domenica and BBF's unit-photo storage,
// only ever needs downloading+content-verifying once per distinct URL —
// see imageMirror.ts's classifyByContent doc comment for the full story);
// anything still unresolved is downloaded ONCE into memory and content-
// compared (never persisted here — no mirrorImage() call), with newly
// confirmed duplicates memoized so the SAME vendor rotation is never
// re-downloaded on a later sync. Never mirrors/persists anything itself —
// callers decide what to do with genuinelyNew (count it, or mirror it) and
// reuse (map straight to the existing local file, no download needed at
// all).
async function classifyFreshUrls(
  freshSourceUrls: string[],
  storedMirroredUrls: string[],
): Promise<{ genuinelyNew: string[]; reuse: Map<string, string> }> {
  const storedHashes = new Map<string, string>();
  for (const u of storedMirroredUrls) {
    const h = hashFromMirroredUrl(u);
    if (h) storedHashes.set(h, u);
  }
  const reuse = new Map<string, string>(); // fresh source url -> local url to reuse, no download needed
  const candidates: string[] = [];
  for (const u of freshSourceUrls) {
    const existingUrl = storedHashes.get(sourceUrlHash(u));
    if (existingUrl) reuse.set(u, existingUrl);
    else candidates.push(u);
  }
  if (!candidates.length) return { genuinelyNew: [], reuse };

  const known = await prisma.verifiedDuplicateImage.findMany({
    where: { sourceHash: { in: candidates.map(sourceUrlHash) } },
    select: { sourceHash: true, matchedHash: true },
  });
  const knownMap = new Map(known.map((k) => [k.sourceHash, k.matchedHash]));
  const stillUnknown: string[] = [];
  for (const u of candidates) {
    const matchedHash = knownMap.get(sourceUrlHash(u));
    const existingUrl = matchedHash ? storedHashes.get(matchedHash) : undefined;
    if (existingUrl) reuse.set(u, existingUrl);
    else stillUnknown.push(u); // either never checked before, or its match fell outside this scope
  }
  if (!stillUnknown.length) return { genuinelyNew: [], reuse };

  const { genuinelyNew, duplicateOf } = await classifyByContent(stillUnknown, storedMirroredUrls);
  if (duplicateOf.size) {
    await prisma.verifiedDuplicateImage.createMany({
      data: Array.from(duplicateOf.entries()).map(([url, matchedHash]) => ({ sourceHash: sourceUrlHash(url), matchedHash })),
      skipDuplicates: true,
    });
    for (const [url, matchedHash] of Array.from(duplicateOf.entries())) {
      const existingUrl = storedHashes.get(matchedHash);
      if (existingUrl) reuse.set(url, existingUrl); // always found in practice — matchedHash came from these exact storedMirroredUrls
    }
  }
  return { genuinelyNew, reuse };
}

// Mirrors each url individually and returns a source-url -> local-url map
// (unlike mirrorAll's flat array, which silently drops failures with no way
// to tell which input they belonged to) — needed here to reconstruct a
// gallery/plans/photos array that mixes reused-as-is duplicates with newly
// mirrored genuine content, in the original order.
async function mirrorEachTracked(urls: string[], devKey: string, concurrency = 4): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((u) => mirrorImage(u, devKey)));
    batch.forEach((u, j) => { const r = results[j]; if (r) map.set(u, r.url); });
  }
  return map;
}

async function syncOneProject(dev: string, id: string, accountId: string, opts: { mirror?: boolean; vm?: ProjectVM | null; forceMirror?: boolean } = {}): Promise<ProjectSyncOutcome> {
  const vm = opts.vm !== undefined ? opts.vm : await getPreviewProject(dev, id);
  if (!vm) return { ok: false, created: false, unitsWritten: 0, skippedManual: false, mirroredNewFiles: false, unitsCreated: 0, unitsUnlisted: [] };
  const feedKey = `${dev}:${id}`;
  // Fetched up front (used to be after mirroring) so the freeze check below
  // can gate the download itself, not just the DB write.
  const existing = await prisma.development.findUnique({
    where: { feedKey },
    select: {
      id: true, publishStatus: true, gallery: true, plans: true, imageDriftDetectedAt: true,
      // Gallery drift must compare against every hash the admin has EVER
      // accounted for, not just the currently-displayed set. This is
      // deliberately the UNION of raw Development.gallery (frozen at
      // publish time) + DevelopmentOverride.gallery + hero — NOT the
      // override-first "what's shown" resolution used elsewhere
      // (mapRowToVM/mapDevelopmentRowToCard). Discovered 2026-08-08
      // pre-deploy: an override-first-only comparison treats every raw
      // image the admin deliberately DIDN'T curate into their override as
      // permanently "new" forever — confirmed on Pearl Sea Caves Villas
      // (146 raw, only 38 in the curated override): 108 old, already-seen
      // images were misreported as fresh drift on every single sync. 49 of
      // 122 published developments have a smaller override than raw
      // gallery, most by 1 (harmless) but several by double digits. Plans
      // have no override table (savePlans writes Development.plans
      // directly), so no union is needed there — raw IS the only set.
      override: { select: { gallery: true, mainImage: true } },
    },
  });
  const resolvedStoredGallery: string[] = (() => {
    const raw = (existing?.gallery as string[] | null) ?? [];
    const ovGallery = (existing?.override?.gallery as string[] | null) ?? [];
    const hero = existing?.override?.mainImage;
    return [...(hero ? [hero] : []), ...ovGallery, ...raw];
  })();
  // Published + not admin-forced: skip mirroring itself, not just the DB
  // write. FROZEN_WHEN_PUBLISHED already discarded the resulting URLs from
  // the Development update either way, so mirrorAll() was downloading and
  // writing 3 fresh webp files to disk for nothing every time the feed's
  // gallery/plans drifted even slightly — every such file was an orphan the
  // instant it was created (found 2026-08-08 investigating the orphan
  // cleanup: mirrorImage() itself already skips re-downloading an
  // already-mirrored hash via its own exists() check, line ~90 — this isn't
  // that path; a *new* hash from a *published* project's drifted feed URL
  // was still always downloaded and mirrored, just never referenced).
  // opts.forceMirror bypasses this — the admin "Pull units from feed"/Force-
  // Sync buttons (runSync, syncOneDevelopmentAction) always pass it, so an
  // admin can deliberately re-mirror a published project on demand.
  const isPublished = existing?.publishStatus === "published";
  const freezeMirror = isPublished && !opts.forceMirror;
  let mirroredNewFiles = false;
  // imageDriftDetectedAt / newFromFeed — only meaningful for a published
  // Development (see the schema comment for the full picture). Left
  // undefined (not included in the update at all) for anything not
  // published, so a draft/ready/archived project's bookkeeping is simply
  // never touched either way.
  let driftPatch: { imageDriftDetectedAt?: Date | null; newFromFeed?: any } | undefined;
  if (opts.mirror) {
    const dk = devKeyFor(feedKey);
    // Units queried up front whenever published, so both the mirror-skip
    // logic below AND unit-level drift counting (frozen case) can use the
    // same rows — one query either way, not two.
    const existingUnits = isPublished
      ? await prisma.developmentUnit.findMany({ where: { developmentId: existing!.id, source: "feed" }, select: { ref: true, photos: true, plans: true } })
      : [];
    const knownRefs = new Set(existingUnits.map((u) => u.ref).filter(Boolean));

    if (!freezeMirror && isPublished) {
      // Admin-forced re-mirror of a published project. Content-verify BEFORE
      // mirroring (classifyFreshUrls) so a vendor's URL-only churn never
      // re-downloads+re-stores an image already on disk under its original
      // hash — only genuinely new content gets mirrored and offered as a
      // "new in feed" pick; everything else reuses the existing local file
      // (mirrorEachTracked below covers exactly the genuinelyNew subset).
      const galleryClass = await classifyFreshUrls(vm.gallery, resolvedStoredGallery);
      const plansClass = await classifyFreshUrls(vm.plans, (existing?.plans as string[] | null) ?? []);
      const galleryNewMap = await mirrorEachTracked(galleryClass.genuinelyNew, dk);
      const plansNewMap = await mirrorEachTracked(plansClass.genuinelyNew, dk);
      mirroredNewFiles = galleryNewMap.size > 0 || plansNewMap.size > 0;
      // gallery/plans stay frozen in the DB write below regardless (an
      // admin's curated set must never be silently replaced — see
      // FROZEN_WHEN_PUBLISHED). What CAN happen: surface the freshly
      // mirrored genuinely-new files as "new in feed" picks, and resolve the
      // drift flag — the admin has looked, whether or not they add anything.
      driftPatch = {
        imageDriftDetectedAt: null,
        newFromFeed: {
          gallery: Array.from(galleryNewMap.values()),
          plans: Array.from(plansNewMap.values()),
          driftCounts: { gallery: 0, plans: 0, units: 0 }, // resolved by this very sync
        },
      };
      vm.gallery = vm.gallery.map((u) => galleryClass.reuse.get(u) ?? galleryNewMap.get(u)).filter((u): u is string => !!u);
      vm.plans = vm.plans.map((u) => plansClass.reuse.get(u) ?? plansNewMap.get(u)).filter((u): u is string => !!u);
    } else if (!freezeMirror) {
      // Draft/ready/archived — unaffected by any drift/dedup bookkeeping,
      // full normal mirror exactly as before this feature existed.
      const gallery = await mirrorAll(vm.gallery, dk);
      const plans = await mirrorAll(vm.plans, dk);
      mirroredNewFiles = gallery.anyNew || plans.anyNew;
      vm.gallery = gallery.urls;
      vm.plans = plans.urls;
    } else {
      // freezeMirror: published, not forced — content-verified COUNT only.
      // classifyFreshUrls downloads hash-mismatched candidates into memory
      // to compare, but never calls mirrorImage/persists a file, and skips
      // the download entirely for any URL already confirmed as a duplicate
      // on a previous sync (VerifiedDuplicateImage).
      const galleryClass = await classifyFreshUrls(vm.gallery, resolvedStoredGallery);
      const plansClass = await classifyFreshUrls(vm.plans, (existing?.plans as string[] | null) ?? []);
      const galleryDrift = galleryClass.genuinelyNew.length;
      const plansDrift = plansClass.genuinelyNew.length;
      let unitsDrift = 0;
      const existingUnitByRef = new Map(existingUnits.map((u) => [u.ref, u]));
      for (const u of vm.units) {
        const match = u.ref ? existingUnitByRef.get(u.ref) : undefined;
        if (!match) continue; // brand-new unit — not "drift" on an existing one, handled by the mirror loop below
        const photosClass = await classifyFreshUrls(u.photos, (match.photos as string[] | null) ?? []);
        const unitPlansClass = await classifyFreshUrls(u.plans, (match.plans as string[] | null) ?? []);
        unitsDrift += photosClass.genuinelyNew.length + unitPlansClass.genuinelyNew.length;
      }
      const hasDrift = galleryDrift + plansDrift + unitsDrift > 0;
      const wasFlagged = !!existing?.imageDriftDetectedAt;
      // Only touch the row at all when there's something to say — hasDrift
      // or wasFlagged, not both false — so a project with no drift, that's
      // never had drift, doesn't get a no-op UPDATE every single night.
      if (hasDrift || wasFlagged) {
        driftPatch = {
          // driftCounts refreshed on every pass regardless of transition — a
          // persisting drift's COUNT can still grow night to night (2 new
          // photos yesterday, 5 today) even though imageDriftDetectedAt
          // itself stays pinned to the first-seen date. null once resolved.
          newFromFeed: hasDrift
            ? { gallery: [], plans: [], driftCounts: { gallery: galleryDrift, plans: plansDrift, units: unitsDrift } }
            : null,
        };
        if (hasDrift !== wasFlagged) {
          // false→true: stamp now. true→false (feed reverted on its own,
          // rare but possible): clear. Persisting drift across many nights
          // leaves imageDriftDetectedAt untouched — "since" stays the first
          // night it was seen, not the most recent.
          driftPatch.imageDriftDetectedAt = hasDrift ? new Date() : null;
        }
      }
    }
    // Units: a brand-new unit (not yet in the DB) still gets its photos/plans
    // mirrored once even on a frozen published project — "new units on a
    // published project get their photos" was the explicit agreed exception.
    // Existing/matched units are skipped entirely when frozen; their DB write
    // (syncFeedUnitsPreservingUnlisted, below) also omits photos/plans for
    // those so a skipped-mirror unit's raw external feed URL can never
    // overwrite its already-correct local one. When forced (published, not
    // frozen) an EXISTING unit is content-verified the same way as gallery/
    // plans above, so "reload images" doesn't blow away 30 correct photos to
    // keep just the 1 genuinely new one — a brand-new unit has nothing to
    // compare against and always gets the plain full mirror.
    const existingUnitByRef = new Map(existingUnits.map((u) => [u.ref, u]));
    for (const u of vm.units) {
      const known = !!(u.ref && knownRefs.has(u.ref));
      if (freezeMirror && known) continue; // existing unit, published, not forced — skip entirely
      if (isPublished && !freezeMirror && known) {
        const match = existingUnitByRef.get(u.ref)!;
        const photosClass = await classifyFreshUrls(u.photos, (match.photos as string[] | null) ?? []);
        const plansClass = await classifyFreshUrls(u.plans, (match.plans as string[] | null) ?? []);
        const photosNewMap = await mirrorEachTracked(photosClass.genuinelyNew, dk);
        const plansNewMap = await mirrorEachTracked(plansClass.genuinelyNew, dk);
        u.photos = u.photos.map((p) => photosClass.reuse.get(p) ?? photosNewMap.get(p)).filter((p): p is string => !!p);
        u.plans = u.plans.map((p) => plansClass.reuse.get(p) ?? plansNewMap.get(p)).filter((p): p is string => !!p);
        if (photosNewMap.size > 0 || plansNewMap.size > 0) mirroredNewFiles = true;
      } else {
        const photos = await mirrorAll(u.photos, dk);
        u.photos = photos.urls;
        const uPlans = await mirrorAll(u.plans, dk);
        u.plans = uPlans.urls;
        if (photos.anyNew || uPlans.anyNew) mirroredNewFiles = true;
      }
    }
  }
  const fullData = developmentRow(vm, dev, id, accountId);
  let updateData: Partial<typeof fullData> & typeof driftPatch = fullData;
  if (existing?.publishStatus === "published") {
    const frozen = { ...fullData };
    for (const k of FROZEN_WHEN_PUBLISHED) delete (frozen as any)[k];
    updateData = frozen;
  }
  // Never subject to FROZEN_WHEN_PUBLISHED — imageDriftDetectedAt/newFromFeed
  // aren't customer-facing content, they're the admin's own "what changed"
  // bookkeeping, meant to update on every published sync regardless.
  if (driftPatch) updateData = { ...updateData, ...driftPatch };
  const development = existing
    ? await prisma.development.update({ where: { feedKey }, data: updateData })
    : await prisma.development.create({ data: fullData });
  // Auto recompute (haversine, src/lib/developmentDistances.ts) — resolves
  // override lat/lng first, so a deliberately-corrected admin pin is never
  // clobbered by the feed's own (possibly wrong) coordinates.
  await recomputeDevelopmentDistances(development.id);
  // If a human imported the real unit list (manual units exist), the feed's
  // partial list is ignored entirely — never re-add feed units on top. The
  // Development row above is still refreshed regardless (name/description/
  // gallery/price range/stage/etc., or a subset thereof once published — see
  // FROZEN_WHEN_PUBLISHED) — only DevelopmentUnit rows are protected.
  const manualUnits = await prisma.developmentUnit.count({ where: { developmentId: development.id, source: "manual" } });
  if (manualUnits > 0) {
    return { ok: true, created: !existing, unitsWritten: 0, skippedManual: true, mirroredNewFiles, developmentId: development.id, developmentName: development.publicName, unitsCreated: 0, unitsUnlisted: [] };
  }
  let unitsWritten: number, unitsCreated = 0, unitsUnlisted: { ref: string; label: string }[] = [];
  if (development.publishStatus === "published") {
    const diff = await syncFeedUnitsPreservingUnlisted(development.id, vm.units, { freezeExistingUnitMedia: freezeMirror });
    unitsWritten = diff.written; unitsCreated = diff.createdCount; unitsUnlisted = diff.unlisted;
  } else {
    await prisma.developmentUnit.deleteMany({ where: { developmentId: development.id, source: "feed" } });
    if (vm.units.length) await prisma.developmentUnit.createMany({ data: vm.units.map((u, i) => unitRow(u, development.id, i)) });
    unitsWritten = vm.units.length;
  }
  await recomputeDevelopmentDerivedState(development.id);
  return { ok: true, created: !existing, unitsWritten, skippedManual: false, mirroredNewFiles, developmentId: development.id, developmentName: development.publicName, unitsCreated, unitsUnlisted };
}

// Guards against a partial/broken feed fetch masquerading as "half the
// catalogue sold" — a large chunk of a developer's previously-known units
// vanishing from one day's pull is far more likely a feed/API hiccup than a
// genuine sales event (see the Salt/legacy premise-check, 2026-08-06: "unit
// disappeared" ≠ "sold", and a bad fetch can make far more than one unit
// disappear at once). Blocks only when BOTH thresholds are crossed — percent
// alone would trip constantly for small developers (a 3-project, 16-unit
// developer loses "15%" over a single real unit selling), and an absolute
// count alone would rarely trip for large ones. Validated against real
// per-developer unit counts (2026-08-06): bbf 506, olias-homes 330, aristo
// 309, medousa-xml 273, island-blue 201, domenica 120, luma 84, inex 78,
// square-one 53, pafilia 27, kuutio-homes-drive 16 — the 20-unit floor
// dominates for the small end, 15% for the large end, exactly as intended.
// Scoped developer-wide (not per-published-project): a broken feed/API
// response affects the developer's whole pull equally, published or not.
const FEED_INCOMPLETE_PCT = 0.15;
const FEED_INCOMPLETE_ABS_FLOOR = 20;

// Mito's own floor, deliberately not the shared FEED_INCOMPLETE_ABS_FLOOR of 20.
// That figure was tuned against developers carrying 27–506 units; Mito's entire
// catalogue is 16, so `missing > 20` can never be true and the guard would be
// decoration. Three is the smallest number that still tolerates an ordinary
// night's sales: with 16 units, losing 4 trips it (25 %), losing 3 does not.
// The stricter floor is also the right trade for Mito specifically, because its
// projects are unpublished and therefore on the hard-delete path, where the
// other developers' units would merely flip to "unlisted".
const MITO_INCOMPLETE_ABS_FLOOR = 3;

async function checkFeedCompleteness(
  dev: string,
  ids: string[],
): Promise<{ blocked: boolean; message?: string; missing?: number; total?: number; vmsById: Map<string, ProjectVM | null> }> {
  const vmsById = new Map<string, ProjectVM | null>();
  let afterCount = 0;
  for (const id of ids) {
    let vm: ProjectVM | null = null;
    try { vm = await getPreviewProject(dev, id); } catch { vm = null; }
    vmsById.set(id, vm);
    afterCount += vm?.units.length ?? 0;
  }
  const beforeCount = await prisma.developmentUnit.count({ where: { source: "feed", development: { dev } } });
  if (beforeCount > 0) {
    const missing = beforeCount - afterCount;
    const missingPct = missing / beforeCount;
    if (missing > FEED_INCOMPLETE_ABS_FLOOR && missingPct > FEED_INCOMPLETE_PCT) {
      const pctLabel = Math.round(missingPct * 100);
      return {
        blocked: true,
        message: `${missing} of ${beforeCount} units are missing from today's feed (${pctLabel} %). Nothing was changed — the catalogue stays as it is until this has been checked.`,
        missing, total: beforeCount,
        vmsById,
      };
    }
  }
  return { blocked: false, vmsById };
}

/* Mito's feed carries no project ids, so it cannot use the listProjectIds →
   getPreviewProject path: that path's premise is a feed that supplies stable
   ids. Each sync clusters the feed afresh and then RECONCILES those clusters
   against what is already in the database, matching by proximity.

   Anchoring identity in the DB rather than recomputing it is the whole point.
   The operator names these projects by hand — two of the four are never named in
   the feed — so a key that shifted when the feed shifted would leave the name on
   the old row and create an unnamed twin beside it. Mamba shows how real that
   is: it is held together by a single shared description, and one unit leaving
   plus one text edit would re-key it. */
async function syncMitoCore(opts: { mirror?: boolean; forceMirror?: boolean } = {}): Promise<SyncResult> {
  const dev = "mito";
  const accountId = await ensureAccount(dev);
  // A failed fetch must not take the rest of the nightly run with it: this
  // throws out of syncAll, and withCronLog re-throws after logging, so one
  // Qobrix hiccup would skip every later developer's log row, statusOnlySync,
  // the unit notifications and the purges. An empty result is then genuinely
  // safe — the loop below never runs and nothing is written. Same guard the
  // medousa branch of listProjectIds already uses.
  let clusters: MitoCluster[] = [];
  try { clusters = await mitoClusters(); } catch { clusters = []; }

  // The same protection checkFeedCompleteness gives the other eight developers.
  // Mito cannot use that function — it works from listProjectIds, which Mito has
  // no equivalent of — but it needs the rule, because the rule is about units,
  // not ids, and Mito's exposure is worse than theirs: a freshly created Mito
  // project is UNPUBLISHED, and syncOneProject's unpublished path is
  // deleteMany({source:"feed"}) + createMany. A partial fetch would not flip
  // units to "unlisted" as it does for a published project — it would delete
  // them. Every Mito project is unpublished until the operator has named and
  // published it, so that is the normal state, not an edge case.
  //
  // A total fetch failure (network error above, or the feed genuinely returning
  // zero properties) is caught by this same check, not sidestepped by it: with
  // clusters=[], afterCount is 0, so an existing catalogue of any size trips
  // missing > MITO_INCOMPLETE_ABS_FLOOR and blocks rather than silently wiping
  // every unpublished project down to nothing.
  const afterCount = clusters.reduce((n, c) => n + c.units.length, 0);
  const beforeCount = await prisma.developmentUnit.count({ where: { source: "feed", development: { dev } } });
  if (beforeCount > 0) {
    const missing = beforeCount - afterCount;
    const missingPct = missing / beforeCount;
    if (missing > MITO_INCOMPLETE_ABS_FLOOR && missingPct > FEED_INCOMPLETE_PCT) {
      const pctLabel = Math.round(missingPct * 100);
      return {
        dev, found: clusters.length, created: 0, updated: 0, failed: 0,
        mirroredNewFiles: false, unitsWritten: 0, unitsCreated: 0, unitsUnlisted: [],
        blocked: true,
        blockedMessage: `${missing} of ${beforeCount} units are missing from today's feed (${pctLabel} %). Nothing was changed — the catalogue stays as it is until this has been checked.`,
        blockedMissing: missing, blockedTotal: beforeCount,
      };
    }
  }

  const known = await prisma.development.findMany({
    where: { dev, developerAccountId: accountId },
    select: { feedProjectId: true, latitude: true, longitude: true },
  });

  // Assign globally nearest-first, not greedily per cluster. A per-cluster grab
  // lets a farther cluster processed earlier claim a row that belongs to a
  // nearer one processed later — which would diff the wrong project's units
  // against the operator's hand-named row. The live feed's clusters are 712 m
  // to 5.7 km apart so nothing competes today, but the operator's names are
  // exactly what this ordering protects.
  const idByCluster = new Map<MitoCluster, string>();
  {
    const pairs: { cluster: MitoCluster; id: string; m: number }[] = [];
    for (const cluster of clusters) {
      const center = cluster.center;
      if (!center) continue;
      for (const k of known) {
        if (!k.feedProjectId) continue;
        if (k.latitude == null || k.longitude == null) continue;
        const m = Math.hypot(
          (center.lat - k.latitude) * 111320,
          (k.longitude - center.lng) * 111320 * Math.cos((center.lat * Math.PI) / 180),
        );
        if (m < MITO_MATCH_M) pairs.push({ cluster, id: k.feedProjectId, m });
      }
    }
    pairs.sort((a, b) => a.m - b.m);
    const claimedRows = new Set<string>();
    for (const p of pairs) {
      if (idByCluster.has(p.cluster) || claimedRows.has(p.id)) continue;
      idByCluster.set(p.cluster, p.id);
      claimedRows.add(p.id);
    }
    for (const cluster of clusters) {
      if (idByCluster.has(cluster)) continue;
      const center = cluster.center;
      if (center) {
        idByCluster.set(cluster, `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`);
        continue;
      }
      // No coordinates at all, so proximity matching is impossible. Key on the
      // lowest ref instead: unstable if that unit sells, but distinct per cluster,
      // which a shared sentinel would not be — two such clusters would land on one
      // feedKey and merge into a single project. Every property in the live feed
      // has coordinates, so this is a guard, not a path in use.
      const lowest = cluster.units.map((u: any) => String(u?.ref ?? "").trim()).filter(Boolean).sort()[0];
      idByCluster.set(cluster, lowest ? `noloc-${lowest}` : "noloc");
    }
  }

  let created = 0, updated = 0, failed = 0, mirroredNewFiles = false, unitsCreated = 0, unitsWritten = 0;
  const unitsUnlisted: UnitChangeLine[] = [];
  for (const cluster of clusters) {
    const id = idByCluster.get(cluster)!;
    try {
      const r = await syncOneProject(dev, id, accountId, { ...opts, vm: mitoVm(cluster, id) });
      if (!r.ok) { failed++; continue; }
      r.created ? created++ : updated++;
      if (r.mirroredNewFiles) mirroredNewFiles = true;
      unitsCreated += r.unitsCreated;
      unitsWritten += r.unitsWritten;
      for (const u of r.unitsUnlisted) {
        unitsUnlisted.push({ developmentId: r.developmentId!, development: r.developmentName!, ref: u.ref, label: u.label });
      }
    } catch {
      failed++;
    }
  }
  return { dev, found: clusters.length, created, updated, failed, mirroredNewFiles, unitsWritten, unitsCreated, unitsUnlisted };
}

// Core loop, no restart side-effect — syncAll() calls this per developer so a
// full run schedules exactly ONE restart at the end, not one per developer.
async function syncDeveloperCore(dev: string, opts: { mirror?: boolean; forceMirror?: boolean } = {}): Promise<SyncResult> {
  if (dev === "mito") return syncMitoCore(opts);
  const accountId = await ensureAccount(dev);
  const ids = await listProjectIds(dev);

  const guard = await checkFeedCompleteness(dev, ids);
  if (guard.blocked) {
    return { dev, found: ids.length, created: 0, updated: 0, failed: 0, mirroredNewFiles: false, unitsWritten: 0, unitsCreated: 0, unitsUnlisted: [], blocked: true, blockedMessage: guard.message, blockedMissing: guard.missing, blockedTotal: guard.total };
  }

  let created = 0, updated = 0, failed = 0, mirroredNewFiles = false, unitsCreated = 0, unitsWritten = 0;
  const unitsUnlisted: UnitChangeLine[] = [];
  for (const id of ids) {
    try {
      const r = await syncOneProject(dev, id, accountId, { ...opts, vm: guard.vmsById.get(id) ?? null });
      if (!r.ok) { failed++; continue; }
      r.created ? created++ : updated++;
      if (r.mirroredNewFiles) mirroredNewFiles = true;
      unitsCreated += r.unitsCreated;
      unitsWritten += r.unitsWritten;
      for (const u of r.unitsUnlisted) {
        unitsUnlisted.push({ developmentId: r.developmentId!, development: r.developmentName!, ref: u.ref, label: u.label });
      }
    } catch {
      failed++;
    }
  }
  return { dev, found: ids.length, created, updated, failed, mirroredNewFiles, unitsWritten, unitsCreated, unitsUnlisted };
}

// Public single-developer entry (admin "Sync now" for one dev, debug route) —
// mirroring writes new files under public/uploads/, so it MUST restart the app
// afterward or a fresh request for one of those URLs 404s into the [lang]/[...slug]
// catch-all and crashes (see the big comment on scheduleAppRestart in imageMirror.ts).
// This bit us in production once already: an unrestarted app after a mirror run
// crash-looped on the first request for a newly-mirrored image. Restart is only
// scheduled when something was ACTUALLY written (mirroredNewFiles) — most syncs
// re-hit already-mirrored images (skip-if-exists), and scheduleAppRestart()
// itself is now debounced too (see imageMirror.ts), so this is belt-and-suspenders
// against restart-storming a routine "nothing changed" sync.
// beginSyncWindow (2026-08-25): both entries below run for minutes and mirror
// images. Two directions to protect — this run must not be cut short by someone
// else's mirror-triggered restart, and its OWN restart at the end must not cut
// short whatever else is running. The 4am cron calling syncAll() is what killed a
// manual Drive import mid-loop; see beginSyncWindow's doc comment in imageMirror.ts.
export async function syncDeveloper(dev: string, opts: { mirror?: boolean; forceMirror?: boolean } = {}): Promise<SyncResult> {
  const releaseSyncWindow = beginSyncWindow(`feed:${dev}`);
  try {
    const result = await syncDeveloperCore(dev, opts);
    if (opts.mirror && result.mirroredNewFiles) scheduleAppRestart();
    return result;
  } finally {
    releaseSyncWindow();
  }
}

export async function syncAll(opts: { mirror?: boolean; forceMirror?: boolean } = {}): Promise<SyncResult[]> {
  const releaseSyncWindow = beginSyncWindow("feed:all");
  try {
    const out: SyncResult[] = [];
    for (const d of SYNCED_DEVS) out.push(await syncDeveloperCore(d, opts));
    if (opts.mirror && out.some((r) => r.mirroredNewFiles)) scheduleAppRestart();
    return out;
  } finally {
    releaseSyncWindow();
  }
}

// Admin "Units aus Feed neu ziehen" (Force-Sync, Teil 2) — syncs exactly one
// Development immediately, instead of waiting for the 4am cron. Reuses
// syncOneProject verbatim, so it has the exact same manual-lock protection
// as the regular sync: a source:manual Development still gets its
// project-level fields refreshed, but unitsWritten stays 0 (skippedManual
// true) — the caller renders a message that says so explicitly, never a
// silent no-op.
export type SyncOneDevelopmentResult = { ok: boolean; unitsWritten: number; skippedManual: boolean; error?: string };
export async function syncOneDevelopment(developmentId: string, opts: { mirror?: boolean; forceMirror?: boolean } = {}): Promise<SyncOneDevelopmentResult> {
  const development = await prisma.development.findUnique({ where: { id: developmentId }, select: { dev: true, feedProjectId: true, latitude: true, longitude: true } });
  if (!development?.dev || !development?.feedProjectId) {
    return { ok: false, unitsWritten: 0, skippedManual: false, error: "no feed configured for this development" };
  }
  try {
    const accountId = await ensureAccount(development.dev);
    // Mito has no project ids, so the generic path's getPreviewProject(dev, id)
    // cannot serve it — and now throws rather than silently returning another
    // developer's feed. Re-cluster and pick the cluster nearest this
    // development's stored coordinates, the same match syncMitoCore makes.
    if (development.dev === "mito") {
      if (development.latitude == null || development.longitude == null) {
        return { ok: false, unitsWritten: 0, skippedManual: false, error: "This Mito project has no coordinates, so its cluster cannot be identified." };
      }
      const clusters = await mitoClusters();
      let best: { cluster: MitoCluster; m: number } | null = null;
      for (const c of clusters) {
        if (!c.center) continue;
        const m = Math.hypot(
          (c.center.lat - development.latitude) * 111320,
          (development.longitude - c.center.lng) * 111320 * Math.cos((c.center.lat * Math.PI) / 180),
        );
        if (m < MITO_MATCH_M && (!best || m < best.m)) best = { cluster: c, m };
      }
      if (!best) return { ok: false, unitsWritten: 0, skippedManual: false, error: "No cluster in today's Mito feed matches this project's location." };
      const r = await syncOneProject(development.dev, development.feedProjectId, accountId, { ...opts, vm: mitoVm(best.cluster, development.feedProjectId) });
      if (!r.ok) return { ok: false, unitsWritten: 0, skippedManual: false, error: "feed unavailable or project not found" };
      if (opts.mirror && r.mirroredNewFiles) scheduleAppRestart();
      return { ok: true, unitsWritten: r.unitsWritten, skippedManual: r.skippedManual };
    }
    const r = await syncOneProject(development.dev, development.feedProjectId, accountId, opts);
    if (!r.ok) return { ok: false, unitsWritten: 0, skippedManual: false, error: "feed unavailable or project not found" };
    if (opts.mirror && r.mirroredNewFiles) scheduleAppRestart();
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

export type StatusOnlySyncChange = { developmentId: string; developmentName: string; slug: string; unitRef: string; from: string; to: string };

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
      select: { id: true, feedProjectId: true, slug: true, developerName: true, publicName: true },
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
        if (feedStatus == null) {
          // Unit not found in today's (successfully-fetched) feed response —
          // the developer no longer lists it. Never delete or guess "sold":
          // flip to "unlisted" so it drops off the public site but keeps its
          // full row (price/area/photos/ref/feedRef), and returns automatically
          // the day it reappears in the feed (see UnitsView.tsx's filter and
          // recomputeDevelopmentDerivedState's back-in-stock handling below).
          // Hard rule: "sold" is terminal — a unit that was genuinely sold and
          // then disappears (the expected, common case) must stay "sold", never
          // get relabeled "unlisted" just because it's no longer for sale. An
          // already-"unlisted" unit is left alone too — nothing to change, and
          // re-writing it every run would be noise, not signal.
          if (unit.status === "sold" || unit.status === "unlisted") { skipped++; continue; }
          await prisma.developmentUnit.update({ where: { id: unit.id }, data: { status: "unlisted" } });
          matched++; updated++;
          changes.push({
            developmentId: development.id,
            developmentName: development.publicName || development.developerName || development.id,
            slug: development.slug || development.developerName || development.id,
            unitRef: unit.ref || unit.feedRef || unit.id,
            from: unit.status || "(none)",
            to: "unlisted",
          });
          continue;
        }
        matched++;
        // Same hard rule as above, the other direction: a unit already marked
        // "sold" never springs back to available/reserved just because the
        // feed briefly reports it differently (a stale re-list, a feed glitch) —
        // sold is a one-way door once set.
        if (unit.status === "sold") continue;
        if (feedStatus !== unit.status) {
          await prisma.developmentUnit.update({ where: { id: unit.id }, data: { status: feedStatus } });
          updated++;
          changes.push({
            developmentId: development.id,
            developmentName: development.publicName || development.developerName || development.id,
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
