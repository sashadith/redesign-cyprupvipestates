import { prisma } from "@/lib/prisma";
import { driveConfigured, folderIdFromUrl, getAccessToken, listFolder, findPriceFile, listProjectFolders, getSpreadsheetText, findSubfolder, findInfoDocuments, collectMedia, downloadFile, type DriveFile } from "./googleDrive";
import { extractAvailabilityFromPricelist, buildCanonicalMatcher, type ExtractedPricelistProject, type ExtractStats } from "./ai/pricelistExtract";
import { toTitleCaseName } from "@/lib/textCase";
import { folderProjectName, matchProjectByName, scopeSheetToProject, cleanArea, MAPS_LINK_RE } from "@/lib/driveFolderNames";
import { extractPricelistFromPdf } from "./ai/pdfPricelistExtract";
import { generateProjectDescription } from "./ai/projectDescription";
import { extractTextFromDocx, extractTextFromPdf } from "./ai/projectInfoExtract";
import { storeUploadedImage, storeRawFile, devKeyFor, pdfPagesToJpegs, scheduleAppRestart, beginSyncWindow } from "./imageMirror";
import { resolveMapsUrlToGeo } from "./mapsGeo";
import { normalizeRef } from "./unitRef";
import { recomputeDevelopmentDistances } from "./developmentDistances";
import { recomputeDevelopmentDerivedState } from "./developmentDerivedState";
import { isDropboxShareUrl } from "./dropbox";
import type { ExtractedUnit } from "./ai/pricelistExtract";

const MAX_IMAGES = 10;
const MAX_PLANS = 12;

/* Availability + content sync from a developer's shared Drive folder.
   - content=false (daily cron): light — only unit status/price + counts.
   - content=true ("full import"): also project type / completion / amenities,
     full unit areas, and a generated 4-language description (only when the
     override description is still empty, so admin edits are never overwritten). */

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const nn = (v: string | undefined | null) => (v && String(v).trim() ? String(v).trim() : null);
// See src/lib/unitRef.ts for why this needs to be shared.
const refKey = normalizeRef;
const numFrom = (s?: string | null) => { const m = (s || "").match(/[\d.]+/); return m ? parseFloat(m[0]) : null; };
// The per-call AI re-extraction isn't just ref-unstable — it can also just plain
// miss a field it captured fine on an earlier run (e.g. the floor breakdown /
// parking / pool columns). A full re-sync must never let a thin/noisy pass erase
// previously-captured detail: keep the existing value whenever the fresh one is empty.
function keepIfEmpty<T>(fresh: T, existing: T): T {
  if (Array.isArray(fresh)) return ((fresh as unknown[]).length ? fresh : existing) as T;
  return (fresh == null || fresh === "" ? existing : fresh) as T;
}

// Map the price-list's per-unit extraction onto our columns. Sheets vary a lot
// (one dev gives a single "Internal Area", another splits Ground/Upper floor,
// another adds parking/storage/pool as their own columns) — whatever doesn't have
// a dedicated column (parking, storage, pool, per-unit extras, floor breakdown)
// goes into `attrs`, which the public unit card already renders as a spec list.
function unitFields(u: ExtractedUnit) {
  const attrs: { name: string; value: string }[] = [];
  let areaBuilt = nn(u.areaBuilt);
  if (!areaBuilt && (u.areaGroundFloor || u.areaUpperFloor)) {
    const g = numFrom(u.areaGroundFloor), l = numFrom(u.areaUpperFloor);
    if (g != null || l != null) areaBuilt = `${Math.round((g ?? 0) + (l ?? 0))} m²`;
    if (u.areaGroundFloor) attrs.push({ name: "Ground floor (internal)", value: u.areaGroundFloor });
    if (u.areaUpperFloor) attrs.push({ name: "Upper floor (internal)", value: u.areaUpperFloor });
  }
  if (u.extras) attrs.push({ name: "Details", value: u.extras });
  if (u.parking) attrs.push({ name: "Parking", value: u.parking });
  if (u.storage) attrs.push({ name: "Storage", value: u.storage });
  if (u.pool) attrs.push({ name: "Private pool", value: u.pool });
  return {
    baths: nn(u.bathrooms),
    areaBuilt,
    areaPlot: nn(u.areaPlot),
    areaVeranda: nn(u.areaVeranda),
    areaVerandaOpen: nn(u.areaVerandaOpen),
    attrs,
  };
}

export type DriveSyncResult = {
  ok: boolean;
  skipped?: boolean;
  message: string;
  projects?: number;
  unitsAvailable?: number;
  // Per-project deletion counts from this run's pruning (see writeProject's
  // doc comment on the prunable block) — how many stale units were removed
  // and how many remain, per project, for post-sync review.
  pruned?: { project: string; deleted: number; remaining: number }[];
  /** How the run's projects were sourced (2026-08-24) — the folder-first split.
   *  `skipped` is the whole point of these fields: a project folder that produced
   *  nothing must say so out loud. Silence is what let four Olias folders sit
   *  unsynced for seven weeks without anything anywhere reporting a problem. */
  fromFolders?: number;
  fromMaster?: number;
  folderIssues?: { folder: string; reason: string }[];
};

/** Everything a folder-sourced project already KNOWS about itself, so writeProject
 *  never has to re-derive it by fuzzy matching (2026-08-24). Empty for the
 *  master-sheet path, which has no folder to start from. */
type ProjectHints = {
  /** The project's own Drive subfolder id, straight from the scan that found its
   *  price list there. Skips findSubfolder entirely — that function's word-overlap
   *  fallback is what pulled the WRONG folder's images in the Venara/Venara View
   *  case, and a folder we literally just read the price list out of is not a guess. */
  folderId?: string | null;
  /** The already-existing Development's feedProjectId. The feedKey MUST come from
   *  this and not from a fresh slug(publicName): the two are only equal as long as
   *  nobody ever changes publicName, and the day they diverge, re-slugging silently
   *  creates a SECOND Development row for a project that already exists. */
  feedProjectId?: string | null;
};

async function writeProject(developerAccountId: string, accountName: string, p: ExtractedPricelistProject, content: boolean, files: DriveFile[], at: string, richUnits: boolean = content, hints: ProjectHints = {}): Promise<{ avail: number; mediaChanged: boolean; pruned?: { deleted: number; remaining: number } }> {
  // Project-level fields sourced straight from the price-list TEXT (category, completion,
  // amenities, area, map link) cost nothing extra to refresh — no image download, no PDF
  // conversion, no document analysis — so they should update on a fast units-only sync too,
  // not just a full import. Only description generation (which also pulls in separate Drive
  // documents) and images/floor-plans stay gated to `content` specifically, further below.
  const richProject = content || richUnits;
  let mediaChanged = false;
  const projSlug = hints.feedProjectId || slug(p.project) || Math.random().toString(36).slice(2, 8);
  const feedKey = `drive:${developerAccountId}:${projSlug}`;
  const avail = p.units.filter((u) => u.status === "available").length;
  const prices = p.units.map((u) => u.price).filter((x): x is number => typeof x === "number");
  const priceFrom = prices.length ? Math.min(...prices) : null;

  // The project's own Drive subfolder — resolved once, used for the maps-link
  // fallback right below, the info-document description source further down, and
  // images/plans at the end. `findSubfolder` only reads the already-fetched `files`
  // listing (no extra API call), so resolving it this early costs nothing.
  //
  // A folder-sourced project passes its folder in and skips the lookup altogether:
  // it is known, not inferred. It is also resolved on a LIGHT sync for those (the
  // findSubfolder branch stays gated on `content` — that one costs an API call per
  // nested candidate), which is what lets driveFolderId get backfilled below without
  // waiting for someone to run a full import.
  const subId = hints.folderId ?? (content ? (await findSubfolder(files, p.project, at))?.id ?? null : null);

  // The price list's "Location:" row is often a goo.gl/maps.app shortlink that
  // doesn't carry coordinates itself — resolve it via redirect so the map location
  // (previously silently discarded) actually reaches the Development record. Some
  // developers (e.g. Olias Homes) don't put a maps link in the price list at all —
  // it only shows up in the project's own "Project Information" doc — so fall back
  // to scanning that document's text for a maps.app.goo.gl / google.com/maps link
  // when the price list itself didn't have one.
  // The area value the sheet gave us, minus the label/URL/own-name artefacts a
  // two-cell "Location:" row produces — see cleanArea.
  const areaText = cleanArea(p.location, p.project);
  let mapsUrl = p.mapsUrl;
  // A "Location:" cell holding the maps link itself: useless as an area, but it is
  // exactly the link the geocoding step needs and would otherwise never see.
  if (!mapsUrl && MAPS_LINK_RE.test((p.location ?? "").trim())) mapsUrl = (p.location as string).trim();
  if (content && !mapsUrl && subId) {
    try {
      const topFiles = await listFolder(subId, at);
      const infoDocs = findInfoDocuments(topFiles);
      for (const doc of infoDocs) {
        const buf = await downloadFile(doc.id, at);
        const t = doc.mimeType === "application/pdf" ? await extractTextFromPdf(buf.toString("base64")) : await extractTextFromDocx(buf);
        const found = t?.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps)\S*/i);
        if (found) { mapsUrl = found[0]; break; }
      }
    } catch { /* best-effort */ }
  }
  const geo = richProject && mapsUrl ? await resolveMapsUrlToGeo(mapsUrl) : null;
  const existingDev = await prisma.development.findUnique({ where: { feedKey }, select: { category: true, completion: true, amenities: true, area: true, latitude: true, longitude: true } });
  const rich = richProject
    ? {
        category: keepIfEmpty(nn(p.propertyType), existingDev?.category ?? null),
        completion: keepIfEmpty(nn(p.completion), existingDev?.completion ?? null),
        amenities: keepIfEmpty((p.amenities ?? []).filter(Boolean), (existingDev?.amenities as string[]) ?? []),
        // cleanArea on BOTH sides: a junk value already in the database must not
        // survive just because this run's own value came back empty.
        priceFrom, area: keepIfEmpty(areaText, cleanArea(existingDev?.area, p.project)),
        latitude: keepIfEmpty(geo?.lat ?? null, existingDev?.latitude ?? null),
        longitude: keepIfEmpty(geo?.lng ?? null, existingDev?.longitude ?? null),
      }
    : {};

  const dev = await prisma.development.upsert({
    where: { feedKey },
    create: {
      developerAccountId, dev: "drive", feedProjectId: projSlug, feedKey,
      developerName: p.project, publicName: p.project, developer: accountName,
      publishStatus: "draft", unitsTotal: p.units.length, unitsAvailable: avail, syncedAt: new Date(),
      ...rich,
    },
    update: { unitsTotal: p.units.length, unitsAvailable: avail, syncedAt: new Date(), ...rich },
    include: { override: true },
  });

  // The folder link, recorded on EVERY sync path — not only inside the media block
  // far below, which runs on a full import only. A folder-sourced project is matched
  // back to its folder by exactly this column on the next scan, so it has to be
  // there from the first light sync onwards, otherwise the match silently degrades
  // to name-based fuzzy matching on every subsequent run.
  if (subId && dev.driveFolderId !== subId) {
    await prisma.development.update({ where: { id: dev.id }, data: { driveFolderId: subId } });
  }

  // Auto recompute (haversine, src/lib/developmentDistances.ts) — resolves
  // override lat/lng first (so a corrected admin pin always wins over the
  // feed's own geocoding), unconditionally on every sync so a Development
  // that only ever got its coordinates from an earlier light sync still ends
  // up with distances computed as soon as they exist, not just on rich runs.
  await recomputeDevelopmentDistances(dev.id);

  // Upsert units by ref. Light sync updates status/price; full import also areas.
  // The ref comes from a fresh AI re-extraction each sync, which isn't byte-stable
  // ("Villa 1" one run, "1" the next) — exact-string matching silently created a
  // duplicate row per unit on every re-sync. Normalize (strip filler words +
  // non-alphanumerics) before matching, and fetch existing units (with their current
  // content fields, so a thin re-extraction can't blank out previously-captured detail).
  const existingUnits = await prisma.developmentUnit.findMany({
    where: { developmentId: dev.id },
    select: { id: true, ref: true, source: true, beds: true, baths: true, areaBuilt: true, areaPlot: true, areaVeranda: true, areaVerandaOpen: true, attrs: true, amenities: true },
  });
  const existingByKey = new Map<string, (typeof existingUnits)[number]>();
  for (const eu of existingUnits) if (eu.ref) existingByKey.set(refKey(eu.ref, p.project), eu);

  // Amenities that apply to the whole project (from the price list's "Notes:" row,
  // or curated by hand in the admin) live on the Development itself — but the public
  // unit card reads each UNIT's own amenities, not the project's, so nothing showed.
  // Source from `dev.amenities` (the just-upserted, CURRENT value) rather than this
  // run's freshly-extracted `p.amenities` — that way it's whatever the project's
  // amenities actually are right now (admin-edited or notes-derived), not only
  // whatever this particular sync happened to (re-)extract, and it still works on
  // the light nightly sync where no extraction of amenities happens at all.
  const projectAmenities = ((dev.amenities as string[] | null) ?? []).filter(Boolean);

  const touchedIds = new Set<string>();
  for (const u of p.units) {
    const ref = String(u.ref || "").trim();
    if (!ref) continue;
    const base = { ref, price: typeof u.price === "number" ? Math.round(u.price) : null, status: u.status };
    const k = refKey(ref, p.project);
    const existing = existingByKey.get(k);
    let data: Record<string, any> = base;
    if (richUnits) {
      const fresh = { beds: nn(u.bedrooms), ...unitFields(u) };
      data = existing
        ? {
            ...base,
            beds: keepIfEmpty(fresh.beds, existing.beds),
            baths: keepIfEmpty(fresh.baths, existing.baths),
            areaBuilt: keepIfEmpty(fresh.areaBuilt, existing.areaBuilt),
            areaPlot: keepIfEmpty(fresh.areaPlot, existing.areaPlot),
            areaVeranda: keepIfEmpty(fresh.areaVeranda, existing.areaVeranda),
            areaVerandaOpen: keepIfEmpty(fresh.areaVerandaOpen, existing.areaVerandaOpen),
            attrs: keepIfEmpty(fresh.attrs, (existing.attrs as { name: string; value: string }[]) ?? []),
            amenities: keepIfEmpty(projectAmenities, (existing.amenities as string[]) ?? []),
          }
        : { ...base, ...fresh, amenities: projectAmenities };
    }
    if (existing) {
      touchedIds.add(existing.id);
      await prisma.developmentUnit.update({ where: { id: existing.id }, data });
    } else {
      const created = await prisma.developmentUnit.create({ data: { developmentId: dev.id, ...data } });
      touchedIds.add(created.id);
      existingByKey.set(k, { id: created.id, ref: created.ref, source: created.source, beds: created.beds, baths: created.baths, areaBuilt: created.areaBuilt, areaPlot: created.areaPlot, areaVeranda: created.areaVeranda, areaVerandaOpen: created.areaVerandaOpen, attrs: created.attrs as any, amenities: created.amenities as any });
    }
  }
  if (p.units.length) await recomputeDevelopmentDerivedState(dev.id);

  // Pruning (2026-08-13, redesigned after an incident) — the database should
  // mirror the developer's CURRENT price list exactly, nothing more: a unit
  // no longer present gets deleted, not soft-flagged. Exactly two absolute
  // conditions, no percentage/floor threshold (an earlier version copied
  // feedSync's 15%/20-unit guard verbatim, which deleted 75 real units on
  // its first live run — the projects it hit had FEWER than 20 units total,
  // so severe proportional loss sailed past the absolute floor unprotected;
  // full incident + root cause in git history). The threshold approach is
  // deliberately not replaced with a retuned one: verified on real data that
  // "thin" extractions were the developer's OWN spreadsheet edits (Olias
  // deleted already-sold rows across several tabs), not extraction failures
  // — a genuinely smaller list IS the correct new state, not a signal to
  // distrust.
  //  a) source:"manual" units are never deleted — curated rows, explicitly
  //     protected from every sync path (Celestia's bulk-imported photos/
  //     amenities/specs hang off these).
  //  b) an empty or failed extraction writes NOTHING, for this project or
  //     any other — "no result" is not the same as "an empty list is the
  //     real state". Structural, not a check here: syncDeveloperDrive's loop
  //     skips `!p.units?.length` before writeProject is ever called, and a
  //     thrown extraction error fails the whole developer (syncAllDrives'
  //     per-developer try/catch) before any writeProject call happens for
  //     it at all. Only a genuinely non-empty fresh extraction ever reaches
  //     this line, so deletion here is unconditional once reached.
  const prunable = existingUnits.filter((eu) => eu.source !== "manual" && !touchedIds.has(eu.id));
  let pruned: { deleted: number; remaining: number } | undefined;
  if (prunable.length) {
    await prisma.developmentUnit.deleteMany({ where: { id: { in: prunable.map((u) => u.id) } } });
    // Queried fresh rather than computed from existingUnits/touchedIds
    // bookkeeping — this run's upsert loop above can also have CREATED new
    // rows (a genuinely new ref with no prior match), which existingUnits
    // never counted; the true post-prune total is only ever accurate read
    // back from the DB.
    const remaining = await prisma.developmentUnit.count({ where: { developmentId: dev.id } });
    pruned = { deleted: prunable.length, remaining };
  }


  // Generate a description on FULL import, but only when none exists yet.
  if (content && !dev.override?.descriptionEN?.trim()) {
    try {
      const beds = Array.from(new Set(p.units.map((u) => u.bedrooms).filter(Boolean)));
      const sizes = p.units.map((u) => u.areaBuilt).filter(Boolean);
      // Notable per-unit extras (private pools, gyms, etc.) surfaced as "unit features" —
      // the price list rarely has a clean per-unit amenity list, so this is the closest
      // equivalent: whatever stands out enough to be called out in the sheet's own text.
      const unitFeatures = Array.from(new Set(
        p.units.flatMap((u) => [u.pool ? "private pool" : "", u.extras || ""]).filter(Boolean)
      ));

      // The price list itself rarely has real sales copy — but a "Project Information"
      // Word doc, a Presentation or Specifications PDF sitting in the project's own
      // Drive folder often does (overview paragraphs, "Features include" bullet lists).
      // Pull that in as extra source material for the description, capped to a couple
      // of documents (each one costs a parse/AI call, only worth it on a first import).
      let docText = "";
      if (subId) {
        try {
          const topFiles = await listFolder(subId, at);
          const infoDocs = findInfoDocuments(topFiles);
          const docTexts: string[] = [];
          for (const doc of infoDocs) {
            const buf = await downloadFile(doc.id, at);
            const t = doc.mimeType === "application/pdf" ? await extractTextFromPdf(buf.toString("base64")) : await extractTextFromDocx(buf);
            if (t) docTexts.push(t);
          }
          docText = docTexts.join("\n\n");
        } catch { /* best-effort */ }
      }

      const texts = await generateProjectDescription({
        district: "", town: "", area: areaText ?? "",
        category: nn(p.propertyType) ?? undefined, completion: nn(p.completion) ?? undefined,
        priceFrom, projectAmenities: (p.amenities ?? []).filter(Boolean), unitAmenities: unitFeatures,
        unitSummary: [`${p.units.length} units`, beds.length ? beds.join("/") + "-bedroom" : "", sizes.length ? `${sizes[0]}–${sizes[sizes.length - 1]}` : ""].filter(Boolean).join(", "),
        sourceText: [p.notes, docText].filter(Boolean).join("\n\n") || undefined,
        words: 130,
      });
      await prisma.developmentOverride.upsert({
        where: { developmentId: dev.id },
        create: { developmentId: dev.id, descriptionEN: texts.en, descriptionDE: texts.de, descriptionPL: texts.pl, descriptionRU: texts.ru },
        update: { descriptionEN: texts.en, descriptionDE: texts.de, descriptionPL: texts.pl, descriptionRU: texts.ru },
      });
    } catch { /* description is best-effort */ }
  }

  // Images + floor plans from the project subfolder (full import only). Images are
  // incremental by signature (heavy renders — skipped when unchanged); floor plans are
  // (re)collected whenever the project has none stored yet, so already-imaged projects
  // still get their plans WITHOUT re-downloading every render. This also keeps the
  // import resumable/light: listing is cheap, only the missing media is fetched.
  if (content) {
    try {
      if (subId) {
        const { images, plans, sig } = await collectMedia(subId, at, { maxImages: MAX_IMAGES, maxPlans: MAX_PLANS });
        const devKey = devKeyFor(dev.feedKey);
        const update: Record<string, any> = { driveFolderId: subId };

        // Images — incremental by signature (only when changed). IMPORTANT: only record
        // the signature as "seen" when EVERY image in this batch actually mirrored — a
        // transient failure (rate limit, network blip, a mid-sync crash/restart) must
        // never be remembered as done, or the project is silently stuck at 0 images
        // forever (nothing in Drive ever changes again to trigger a retry). This bit us
        // for real: Arbeo Park's 11 CGI renders all failed to download once, the
        // signature got saved anyway, and it stayed empty across every sync since.
        if (images.length && sig !== dev.driveImagesModified) {
          const urls: string[] = [];
          for (const img of images) {
            try { const buf = await downloadFile(img.id, at); const url = await storeUploadedImage(buf, devKey); if (url) urls.push(url); } catch { /* skip one image */ }
          }
          if (urls.length) { update.gallery = urls; mediaChanged = true; }
          if (urls.length === images.length) update.driveImagesModified = sig;
        }

        // Floor plans — collect whenever none are stored yet (small PDFs, decoupled from images).
        // PDFs are rasterized to JPEG page(s) — the public site only renders <img>, so a raw
        // PDF url would be a broken image there; falls back to the raw PDF if that fails.
        const hasPlans = Array.isArray((dev as any).plans) && (dev as any).plans.length > 0;
        if (plans.length && !hasPlans) {
          const planUrls: string[] = [];
          for (const pf of plans) {
            try {
              const buf = await downloadFile(pf.id, at);
              if (pf.mimeType === "application/pdf") {
                const pages = await pdfPagesToJpegs(buf);
                if (pages.length) {
                  for (const pg of pages) { const url = await storeUploadedImage(pg, devKey); if (url) planUrls.push(url); }
                  continue;
                }
                const url = await storeRawFile(buf, devKey, "pdf");
                if (url) planUrls.push(url);
              } else {
                const url = await storeUploadedImage(buf, devKey);
                if (url) planUrls.push(url);
              }
            } catch { /* skip one plan */ }
          }
          if (planUrls.length) { update.plans = planUrls; mediaChanged = true; }
        }

        if (Object.keys(update).length > 1 || dev.driveFolderId !== subId) {
          await prisma.development.update({ where: { id: dev.id }, data: update });
        }
      }
    } catch { /* media is best-effort */ }
  }

  return { avail, mediaChanged, ...(pruned ? { pruned } : {}) };
}

/* ── Folder-first project discovery (2026-08-24, Olias Homes) ───────────────
   A developer whose projects each carry their own price list inside their own
   Drive folder. See googleDrive.ts's listProjectFolders for the why; this half
   is the identity resolution: which Development row (if any) a folder IS. */

type FolderProject = {
  folder: DriveFile;
  price: DriveFile;
  /** Resolved public name — an existing row's, or the cleaned folder name. */
  project: string;
  /** Non-null only when this folder resolved to a Development that already exists. */
  feedProjectId: string | null;
};
type FolderScan = { usable: FolderProject[]; issues: { folder: string; reason: string }[] };

/** Every source file this run reads, as one signature. Sorted so folder listing
 *  order can never make an unchanged source set look changed. */
const sourceSignature = (master: DriveFile | null, projects: FolderProject[]) =>
  [master ? `${master.id}:${master.modifiedTime}` : "-", ...projects.map((f) => `${f.price.id}:${f.price.modifiedTime}`).sort()].join("|");

/** A Development as the folder resolver needs to see it. Narrow on purpose: this
 *  function must stay pure and directly testable against real folder names and
 *  real rows, without a Drive round trip. */
export type ExistingProjectRow = { id: string; publicName: string; feedProjectId: string; driveFolderId: string | null; dev: string };

/* The identity half of the scan, pure: which Development each project folder IS.
   Split out from the I/O so it can be exercised against production folder names
   and production rows directly — this is the part where a mistake is expensive
   (a hijacked row, or a duplicate Development whose sync then prunes the original's
   units), and "it compiles" is not evidence that it maps correctly. */
export function resolveFolderProjects(folders: { folder: DriveFile; price: DriveFile | null }[], existing: ExistingProjectRow[]): FolderScan {
  const byFolderId = new Map(existing.filter((e) => e.driveFolderId).map((e) => [e.driveFolderId!, e]));

  const usable: FolderProject[] = [];
  const issues: { folder: string; reason: string }[] = [];
  const claimedKeys = new Set<string>();

  for (const { folder, price } of folders) {
    if (!price) { issues.push({ folder: folder.name, reason: "no price list in this folder" }); continue; }
    const cleaned = folderProjectName(folder.name);

    // driveFolderId first: an id we stored ourselves is a fact and outranks every
    // name comparison. It is also what disambiguates the genuinely ambiguous pairs
    // — "Tenera Homes - Geroskipou" vs "Tenera Villas" score identically against
    // "Tenera Villas 1A & 1B" on word overlap alone, and only the stored folder id
    // decides that correctly rather than by a length tie-break.
    let hit = byFolderId.get(folder.id) ?? null;
    if (!hit) {
      // Both the cleaned name and the raw folder name are offered, so a developer
      // whose stored publicName happens to keep the location suffix still matches.
      const m = matchProjectByName([cleaned, folder.name], (e) => e.publicName, existing);
      if (m.ambiguous.length) {
        issues.push({ folder: folder.name, reason: `matches more than one existing project (${m.ambiguous.map((e) => `“${e.publicName}”`).join(", ")}) — left alone, resolve by hand` });
        continue;
      }
      hit = m.hit;
    }

    // Never adopt a row this adapter doesn't own (hand-entered projects, another
    // source's rows) — the same rule dropboxAvailabilitySync.ts applies to Kuutio's
    // three manual entries. Reported rather than silently skipped.
    if (hit && hit.dev !== "drive") {
      issues.push({ folder: folder.name, reason: `matches existing “${hit.publicName}” (dev:${hit.dev}) — not owned by the Drive sync, left untouched` });
      continue;
    }

    // Two folders resolving to the same Development would each call writeProject
    // for the same feedKey, and the second would prune away everything the first
    // just wrote — neither knows the other exists. Structurally excluded here,
    // the same way mergedBySlug does it for the master-sheet path.
    const projectKey = hit?.feedProjectId ?? slug(cleaned);
    if (claimedKeys.has(projectKey)) {
      issues.push({ folder: folder.name, reason: `resolves to the same project as an earlier folder (“${hit?.publicName ?? cleaned}”) — skipped` });
      continue;
    }
    claimedKeys.add(projectKey);

    // An existing row keeps its publicName verbatim: FEED-ADAPTER-GUIDE.md §3 —
    // published projects are frozen, names are never re-derived from the source.
    // toTitleCaseName applies only where a name is born from raw source text.
    usable.push({ folder, price, project: hit ? hit.publicName : toTitleCaseName(cleaned), feedProjectId: hit?.feedProjectId ?? null });
  }
  return { usable, issues };
}

async function scanProjectFolders(developerAccountId: string, rootFiles: DriveFile[], at: string): Promise<FolderScan> {
  const folders = await listProjectFolders(rootFiles, at);
  if (!folders.length) return { usable: [], issues: [] };
  // Scoped to THIS developer's own rows, always — FEED-ADAPTER-GUIDE.md §4:
  // a matching function must never be able to reach across developers.
  const existing = await prisma.development.findMany({
    where: { developerAccountId },
    select: { id: true, publicName: true, feedProjectId: true, driveFolderId: true, dev: true },
  });
  return resolveFolderProjects(folders, existing);
}

export type DriveFolderPreview = {
  folder: string;
  priceFile: string | null;
  project: string;
  status: "existing" | "new" | "skipped";
  reason?: string;
};

/* Read-only dry run of the scan above: which folder maps to which project, which
   file it would read, and — the part that matters — which folders produce nothing
   and why. No AI calls, no downloads, no writes; just listings. Exists so "why is
   this project not on the site?" is a question with an answer in the admin panel
   rather than a code-reading exercise. */
export async function previewDriveFolders(developerAccountId: string): Promise<{ ok: boolean; message: string; rows: DriveFolderPreview[] }> {
  if (!driveConfigured()) return { ok: false, message: "Google Drive is not configured (GOOGLE_* env vars).", rows: [] };
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct?.driveFolderUrl) return { ok: false, message: "No Drive folder link set for this developer.", rows: [] };
  if (isDropboxShareUrl(acct.driveFolderUrl)) return { ok: false, message: "This developer uses Dropbox, not Google Drive.", rows: [] };
  const folderId = folderIdFromUrl(acct.driveFolderUrl);
  if (!folderId) return { ok: false, message: "Could not read a folder id from the Drive link.", rows: [] };

  const at = await getAccessToken();
  const rootFiles = await listFolder(folderId, at);
  const scan = await scanProjectFolders(developerAccountId, rootFiles, at);
  const master = findPriceFile(rootFiles);

  const rows: DriveFolderPreview[] = [
    ...scan.usable.map((f): DriveFolderPreview => ({
      folder: f.folder.name,
      priceFile: f.price.name,
      project: f.project,
      status: f.feedProjectId ? "existing" : "new",
    })),
    ...scan.issues.map((i): DriveFolderPreview => ({ folder: i.folder, priceFile: null, project: "—", status: "skipped", reason: i.reason })),
  ].sort((a, b) => a.folder.localeCompare(b.folder));

  const created = rows.filter((r) => r.status === "new").length;
  return {
    ok: true,
    message:
      `${scan.usable.length} folder${scan.usable.length === 1 ? "" : "s"} with their own price list` +
      (created ? `, ${created} of which would be created as a new project` : "") +
      `. Master sheet: ${master ? `“${master.name}”` : "none"}.`,
    rows,
  };
}

export async function syncDeveloperDrive(developerAccountId: string, opts: { force?: boolean; content?: boolean; richUnits?: boolean; onlyFeedProjectId?: string } = {}): Promise<DriveSyncResult> {
  if (!driveConfigured()) return { ok: false, message: "Google Drive is not configured (GOOGLE_* env vars)." };
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct?.driveFolderUrl) return { ok: false, message: "No Drive folder link set for this developer." };
  // Guarded here too, not just in syncAllDrives()'s batch loop — the admin
  // panel's "Sync now" buttons (developments/actions.ts, developments/[id]/
  // actions.ts) call this directly with a specific developerAccountId,
  // bypassing that filter. A clear message beats the confusing "Could not
  // read a folder id" this would otherwise throw for any Dropbox account.
  if (isDropboxShareUrl(acct.driveFolderUrl)) {
    return { ok: false, message: "This developer uses Dropbox, not Google Drive — sync via the Kuutio Dropbox sync route instead." };
  }
  const folderId = folderIdFromUrl(acct.driveFolderUrl);
  if (!folderId) return { ok: false, message: "Could not read a folder id from the Drive link." };

  // Held for the whole run: a minutes-long job that mirrors images, which any
  // OTHER mirror-triggered restart would kill mid-loop — exactly what the 4am
  // feed-sync cron did to it on 2026-08-25. See beginSyncWindow in imageMirror.ts.
  const releaseSyncWindow = beginSyncWindow(`drive:${acct.name}`);
  try {
  const at = await getAccessToken();
  const rootFiles = await listFolder(folderId, at);

  /* Source discovery, in strict priority order (2026-08-24):
       1. every project folder's OWN price list — folder = project identity
       2. the developer-wide master sheet at the root, for whatever (1) did not cover
     (1) winning is not a preference, it is the correctness rule: where a developer
     keeps both, the per-project sheet is the one they actually maintain. Olias Homes'
     root master sheet is a stale partial copy that does not even mention four of
     their projects (Amalfi Homes, Birch Park, Caldera Estate, Osmia Bee Home) —
     each of which has had a folder and its own "Sales Catalogue - <Project>.xlsx"
     for weeks, and simply never existed for us, because project creation only ever
     read that one master sheet. (2) is still required and not a legacy path: Alder
     Park, Pine Park and Triangle House exist ONLY in the master sheet, with no
     folder of their own at all. */
  const scan = await scanProjectFolders(developerAccountId, rootFiles, at);
  const master = findPriceFile(rootFiles);
  if (!scan.usable.length && !master) {
    return { ok: false, message: "No price list found — neither in the folder root nor in any project subfolder.", folderIssues: scan.issues };
  }

  // The change-signature now spans EVERY source file, not just the master sheet:
  // with per-project price lists, "the root sheet hasn't changed" says nothing about
  // whether a project's own catalogue has. Deliberately a composite string rather
  // than a new column — driveFileModified has no other reader (checked), and one
  // signature for "the source set as a whole" keeps the skip decision honest: any
  // file added, removed or touched anywhere invalidates it.
  const sig = sourceSignature(master, scan.usable);
  const sourceCount = scan.usable.length + (master ? 1 : 0);
  if (!opts.force && !opts.content && !opts.onlyFeedProjectId && acct.driveFileModified === sig) {
    return { ok: true, skipped: true, message: `Unchanged since last sync (${sourceCount} source file${sourceCount === 1 ? "" : "s"}).` };
  }

  const content = !!opts.content;
  const richUnits = content || !!opts.richUnits;
  // The extra project-level calls (location/mapsUrl/type/completion/amenities/notes)
  // only read the same spreadsheet text — no media involved — so run them for the
  // units-only sync too, not just a full import.
  const richness = content || richUnits;

  let totalAvail = 0;
  let mediaChanged = false;
  let fromFolders = 0;
  let fromMaster = 0;
  const pruned: { project: string; deleted: number; remaining: number }[] = [];
  const folderIssues = [...scan.issues];
  // Everything pass 1 owns. Pass 2 must not touch any of it: the master sheet's
  // stale copy of the same project would treat its own thinner row set as the
  // complete truth and prune away what the project's own catalogue just wrote.
  const claimed = new Set<string>();
  const claimedNames: string[] = [];

  // ── Pass 1 — each project folder's own price list ────────────────────────
  // Every project this developer has a folder for — the only names a stray tab in
  // one project's workbook may be recognised as belonging to somebody else.
  const siblingNames = scan.usable.map((f) => f.project);
  const folderProjects = opts.onlyFeedProjectId
    ? scan.usable.filter((f) => (f.feedProjectId ?? slug(f.project)) === opts.onlyFeedProjectId)
    : scan.usable;

  for (const fp of folderProjects) {
    let extracted: ExtractedPricelistProject[];
    try {
      const text = scopeSheetToProject(await getSpreadsheetText(fp.price, at), fp.project, siblingNames);
      // knownProject — identity is a FACT here (this file was read out of that
      // project's own folder), so the catalog call and buildCanonicalMatcher's
      // fuzzy word-overlap scoring are skipped entirely. Nothing can be dropped
      // for "belonging to no known project", which is exactly the master-sheet
      // failure mode that cost Arbeo Park 22 of its 28 flats (2026-08-23).
      extracted = await extractAvailabilityFromPricelist(text, richness, { knownProject: fp.project });
    } catch (e: any) {
      // One unreadable project sheet must never fail the other fifteen.
      folderIssues.push({ folder: fp.folder.name, reason: `could not read “${fp.price.name}” (${String(e?.message ?? e).slice(0, 120)})` });
      continue;
    }
    const p = extracted[0];
    if (!p?.units?.length) {
      // "No result" is not "this project has no units" — write nothing, say so.
      folderIssues.push({ folder: fp.folder.name, reason: `no units extracted from “${fp.price.name}”` });
      continue;
    }
    // knownProject already forces this, but the write path derives feedKey from it —
    // pin it explicitly rather than trusting an extraction invariant.
    p.project = fp.project;
    claimed.add(fp.feedProjectId ?? slug(fp.project));
    claimed.add(slug(fp.project));
    claimedNames.push(fp.project);
    const r = await writeProject(developerAccountId, acct.name, p, content, rootFiles, at, richUnits, { folderId: fp.folder.id, feedProjectId: fp.feedProjectId });
    fromFolders++;
    totalAvail += r.avail;
    if (r.mediaChanged) mediaChanged = true;
    if (r.pruned) pruned.push({ project: p.project, ...r.pruned });
  }

  // ── Pass 2 — the developer-wide master sheet, for what pass 1 did not own ──
  // Surfaced in the sync's own result message. The canonical-name filter used to
  // discard rows in total silence — Arbeo Park lost 22 of 28 flats that way and
  // it only came to light because the survivors showed up as duplicates next to
  // the curated rows. A number in the message makes the next one obvious.
  // Holder object rather than a bare `let`: the only assignment happens inside a
  // callback, which TypeScript's control-flow analysis cannot see, so a plain
  // variable narrows to `never` by the time the message is built.
  const extractStats: { value: ExtractStats | null } = { value: null };
  // A single-project sync that pass 1 already served has no business re-reading
  // the whole master sheet — that would be one full extraction of every other
  // project's rows just to throw them away.
  const needMaster = !!master && (!opts.onlyFeedProjectId || folderProjects.length === 0);

  if (master && needMaster) {
    let extracted: ExtractedPricelistProject[] = [];
    if (master.mimeType === "application/pdf") {
      // PDF price list (2026-08-12, Motive Point) — status comes from the document's
      // own text color, never from AI reading; see pdfPricelistExtract.ts's doc
      // comment. A blocked result means too many units had unresolvable color —
      // nothing gets written, same as the "no price-list found" case.
      const buf = await downloadFile(master.id, at);
      const result = await extractPricelistFromPdf(buf, richness);
      if (result.blocked) {
        // Fails the run only when pass 1 produced nothing either — a blocked master
        // sheet must not discard projects already written from their own catalogues.
        if (!fromFolders) return { ok: false, message: result.message, folderIssues };
        folderIssues.push({ folder: master.name, reason: result.message });
      } else extracted = result.projects;
    } else {
      const text = await getSpreadsheetText(master, at);
      extracted = await extractAvailabilityFromPricelist(text, richness, {
        onStats: (s) => { extractStats.value = s; },
      });
    }

    // Extra stability layer: once a project has been synced before, its stored
    // publicName is a more reliable ground truth than a fresh in-document catalog
    // match — the AI's own catalog read isn't fully deterministic run to run. Every
    // extracted project name gets re-resolved against what's already in the DB for
    // this developer BEFORE anything else, so a rephrased catalog entry this run
    // can't silently fork an already-known project into a duplicate Development.
    const existingProjects = await prisma.development.findMany({ where: { developerAccountId, dev: "drive" }, select: { publicName: true } });
    if (extracted.length && existingProjects.length) {
      const toExisting = buildCanonicalMatcher(existingProjects.map((d) => d.publicName));
      for (const p of extracted) {
        const { name, matched } = toExisting(p.project);
        if (matched) p.project = name;
      }
    }

    // Merge entries that now share the same canonical project (2026-08-13
    // incident) — the extraction can non-deterministically split one real
    // project into two separate result entries within a single run (confirmed
    // on real data: Olivelia Homes fragmented into a 20-unit and a handful-
    // unit entry in the same sync), and the reconciliation pass above only
    // reassigns each entry's OWN `.project` string — it never merges the
    // underlying unit arrays. Two entries that still share a name after that
    // pass would otherwise both call writeProject() independently for the
    // SAME feedKey/Development row below, each treating its own partial list
    // as "the complete fresh extraction" — the second call then prunes
    // everything the first call had just correctly written, since neither
    // knows the other exists. Grouping by the exact same slug() used for
    // feedKey guarantees this structurally: anything that would ever target
    // the same Development row is combined into one entry before any write.
    const mergedBySlug = new Map<string, ExtractedPricelistProject>();
    for (const p of extracted) {
      const k = slug(p.project);
      const existingEntry = mergedBySlug.get(k);
      if (existingEntry) existingEntry.units.push(...p.units);
      else mergedBySlug.set(k, p);
    }

    // Drop everything pass 1 already wrote. Slug equality catches the ordinary case;
    // the name match catches the master sheet writing the same project slightly
    // differently ("Tenera Villas" vs the row's "Tenera Villas 1A & 1B"), which slug
    // equality alone sails straight past and then prunes. Same deterministic matcher
    // as the folder pass, and for the same reason — word overlap here would have
    // excluded Blossom Park from the master sheet because Birch Park was claimed.
    // An ambiguous name counts as owned: skipping a project for one run is
    // recoverable, writing it onto the wrong row is not.
    const ownedByFolder = (name: string) => {
      if (!claimedNames.length) return false;
      const m = matchProjectByName([name], (n) => n, claimedNames);
      return !!m.hit || m.ambiguous.length > 0;
    };
    let rest = Array.from(mergedBySlug.values()).filter((p) => !claimed.has(slug(p.project)) && !ownedByFolder(p.project));
    // Scope to a single project (its own "Sync with Drive" button) — the whole sheet
    // still has to be extracted (the AI reads it as one document), but only this
    // project's Development/units get written, leaving its siblings untouched.
    if (opts.onlyFeedProjectId) rest = rest.filter((p) => slug(p.project) === opts.onlyFeedProjectId);

    for (const p of rest) {
      if (!p.project || !p.units?.length) continue;
      const r = await writeProject(developerAccountId, acct.name, p, content, rootFiles, at, richUnits);
      fromMaster++;
      totalAvail += r.avail;
      if (r.mediaChanged) mediaChanged = true;
      if (r.pruned) pruned.push({ project: p.project, ...r.pruned });
    }
  }

  const total = fromFolders + fromMaster;
  if (!total) {
    return {
      ok: false,
      message: opts.onlyFeedProjectId
        ? "This project wasn't found in any current price list (it may have been renamed, or its folder's catalogue is unreadable)."
        : "Could not extract any projects from the available price lists.",
      folderIssues,
    };
  }

  // Only the whole-developer sync (no single-project scope) tracks the source
  // signature — a single-project resync shouldn't mark the whole source set
  // "seen" and make the next scheduled full sync skip other projects.
  if (!opts.onlyFeedProjectId) {
    await prisma.developerAccount.update({
      where: { id: developerAccountId },
      data: { driveFileId: master?.id ?? null, driveFileModified: sig, driveSyncedAt: new Date() },
    });
  }

  // New images/plans were mirrored → restart so Next serves them (best-effort).
  if (mediaChanged) scheduleAppRestart();

  const sources: string[] = [];
  if (fromFolders) sources.push(`${fromFolders} from their own project price list`);
  if (fromMaster && master) sources.push(`${fromMaster} from “${master.name}”`);
  return {
    ok: true,
    message:
      `${content ? "Imported" : "Synced"} ${total} project${total === 1 ? "" : "s"}` +
      (sources.length ? ` (${sources.join(", ")}).` : ".") +
      // Only when rows were actually discarded — a clean run stays quiet.
      (extractStats.value && extractStats.value.dropped > 0
        ? ` ${extractStats.value.dropped} of ${extractStats.value.extracted} extracted rows were discarded as belonging to no known project` +
          (extractStats.value.droppedNames.length ? ` (${extractStats.value.droppedNames.slice(0, 4).join(", ")})` : "") + "."
        : "") +
      // The folders that contributed nothing, named. This is the diagnostic the
      // old adapter never had: a project sitting in Drive and not on the site
      // now says why, in the sync's own result, instead of just not being there.
      (folderIssues.length
        ? ` ${folderIssues.length} folder${folderIssues.length === 1 ? "" : "s"} contributed nothing: ` +
          folderIssues.slice(0, 5).map((i) => `${i.folder} — ${i.reason}`).join("; ") +
          (folderIssues.length > 5 ? ", …" : "") + "."
        : ""),
    projects: total, unitsAvailable: totalAvail, fromFolders, fromMaster,
    ...(pruned.length ? { pruned } : {}),
    ...(folderIssues.length ? { folderIssues } : {}),
  };
  } finally {
    // Released before scheduleAppRestart's waiter can see it, on every exit path —
    // early "no price list" returns and thrown errors included.
    releaseSyncWindow();
  }
}

// Every developer with a Drive link. Daily cron uses content=false (availability
// only); content=true does a full rich re-import for all of them.
const intervalMs = (i: string | null | undefined) =>
  i === "off" ? Infinity : i === "weekly" ? 7 * 864e5 : i === "2day" ? 2 * 864e5 : 864e5;

// Deliberately standalone rather than importing from ./sharepoint: that module
// is part of the Korantina connector, which is not in the repository (untracked
// locally, absent from every release — the /api/cron/korantina-sync route
// returns 404 in production as of 2026-09-03). This guard must work whether or
// not that connector ever lands.
function isSharePointFolderUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.endsWith(".sharepoint.com") || h === "onedrive.live.com" || h === "1drv.ms";
  } catch {
    return false;
  }
}

export async function syncAllDrives(force = false, content = false): Promise<{ developer: string; result: DriveSyncResult }[]> {
  const devs = await prisma.developerAccount.findMany({
    where: { NOT: { driveFolderUrl: null } },
    select: { id: true, name: true, driveFolderUrl: true, driveSyncInterval: true, driveSyncedAt: true },
  });
  const out: { developer: string; result: DriveSyncResult }[] = [];
  for (const d of devs) {
    // DeveloperAccount has no dedicated provider column — a Dropbox-based
    // developer (Kuutio, 2026-08-13) reuses this same driveFolderUrl field
    // for its Dropbox share link, and has its own dedicated sync route
    // (api/cron/kuutio-sync) rather than going through here. Skip by URL
    // rather than by name/account, so this stays correct for any future
    // Dropbox developer too — without this, folderIdFromUrl() below throws
    // "Could not read a folder id from the Drive link." every scheduled run
    // (confirmed root cause of Kuutio's 2026-08-14 digest failure).
    if (isDropboxShareUrl(d.driveFolderUrl)) continue;
    // Same story, second provider. Korantina Homes is on SharePoint with its
    // own route (api/cron/korantina-sync, 03:20 daily) and its own sync
    // (sharepointAvailabilitySync); this generic 04:30 run collected it anyway
    // and failed on folderIdFromUrl every time it came due — reported
    // 2026-09-03, one day after the account fell due again.
    //
    // Note this must NOT be solved the way AGG was, by setting
    // driveSyncInterval to "off": writeKorantinaDraft honours that same field
    // (respectInterval), so turning it off would silence the sync that
    // actually works. Skipping by URL leaves the interval free to mean what it
    // means for the real owner of this developer.
    if (isSharePointFolderUrl(d.driveFolderUrl)) continue;
    // Respect the per-developer interval for the scheduled (non-forced) availability run.
    if (!force && !content) {
      const iv = intervalMs(d.driveSyncInterval);
      if (iv === Infinity) continue;
      if (d.driveSyncedAt && Date.now() - new Date(d.driveSyncedAt).getTime() < iv) continue;
    }
    try {
      out.push({ developer: d.name, result: await syncDeveloperDrive(d.id, { force, content }) });
    } catch (e: any) {
      out.push({ developer: d.name, result: { ok: false, message: String(e?.message ?? e).slice(0, 200) } });
    }
  }
  return out;
}
