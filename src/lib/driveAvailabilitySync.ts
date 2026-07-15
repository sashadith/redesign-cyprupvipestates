import { prisma } from "@/lib/prisma";
import { driveConfigured, folderIdFromUrl, getAccessToken, listFolder, findPriceFile, getSpreadsheetText, findSubfolder, findInfoDocuments, collectMedia, downloadFile, type DriveFile } from "./googleDrive";
import { extractAvailabilityFromPricelist, buildCanonicalMatcher, type ExtractedPricelistProject } from "./ai/pricelistExtract";
import { generateProjectDescription } from "./ai/projectDescription";
import { extractTextFromDocx, extractTextFromPdf } from "./ai/projectInfoExtract";
import { storeUploadedImage, storeRawFile, devKeyFor, pdfPagesToJpegs, scheduleAppRestart } from "./imageMirror";
import { resolveMapsUrlToGeo } from "./mapsGeo";
import { normalizeRef } from "./unitRef";
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
};

async function writeProject(developerAccountId: string, accountName: string, p: ExtractedPricelistProject, content: boolean, files: DriveFile[], at: string, richUnits: boolean = content): Promise<{ avail: number; mediaChanged: boolean }> {
  // Project-level fields sourced straight from the price-list TEXT (category, completion,
  // amenities, area, map link) cost nothing extra to refresh — no image download, no PDF
  // conversion, no document analysis — so they should update on a fast units-only sync too,
  // not just a full import. Only description generation (which also pulls in separate Drive
  // documents) and images/floor-plans stay gated to `content` specifically, further below.
  const richProject = content || richUnits;
  let mediaChanged = false;
  const projSlug = slug(p.project) || Math.random().toString(36).slice(2, 8);
  const feedKey = `drive:${developerAccountId}:${projSlug}`;
  const avail = p.units.filter((u) => u.status === "available").length;
  const prices = p.units.map((u) => u.price).filter((x): x is number => typeof x === "number");
  const priceFrom = prices.length ? Math.min(...prices) : null;

  // The project's own Drive subfolder — resolved once, used for the maps-link
  // fallback right below, the info-document description source further down, and
  // images/plans at the end. `findSubfolder` only reads the already-fetched `files`
  // listing (no extra API call), so resolving it this early costs nothing.
  const subId = content ? findSubfolder(files, p.project)?.id ?? null : null;

  // The price list's "Location:" row is often a goo.gl/maps.app shortlink that
  // doesn't carry coordinates itself — resolve it via redirect so the map location
  // (previously silently discarded) actually reaches the Development record. Some
  // developers (e.g. Olias Homes) don't put a maps link in the price list at all —
  // it only shows up in the project's own "Project Information" doc — so fall back
  // to scanning that document's text for a maps.app.goo.gl / google.com/maps link
  // when the price list itself didn't have one.
  let mapsUrl = p.mapsUrl;
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
        priceFrom, area: keepIfEmpty(nn(p.location), existingDev?.area ?? null),
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

  // Upsert units by ref. Light sync updates status/price; full import also areas.
  // The ref comes from a fresh AI re-extraction each sync, which isn't byte-stable
  // ("Villa 1" one run, "1" the next) — exact-string matching silently created a
  // duplicate row per unit on every re-sync. Normalize (strip filler words +
  // non-alphanumerics) before matching, and fetch existing units (with their current
  // content fields, so a thin re-extraction can't blank out previously-captured detail).
  const existingUnits = await prisma.developmentUnit.findMany({
    where: { developmentId: dev.id },
    select: { id: true, ref: true, beds: true, baths: true, areaBuilt: true, areaPlot: true, areaVeranda: true, areaVerandaOpen: true, attrs: true, amenities: true },
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
      await prisma.developmentUnit.update({ where: { id: existing.id }, data });
    } else {
      const created = await prisma.developmentUnit.create({ data: { developmentId: dev.id, ...data } });
      existingByKey.set(k, { id: created.id, ref: created.ref, beds: created.beds, baths: created.baths, areaBuilt: created.areaBuilt, areaPlot: created.areaPlot, areaVeranda: created.areaVeranda, areaVerandaOpen: created.areaVerandaOpen, attrs: created.attrs as any, amenities: created.amenities as any });
    }
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
        district: "", town: "", area: p.location ?? "",
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

  return { avail, mediaChanged };
}

export async function syncDeveloperDrive(developerAccountId: string, opts: { force?: boolean; content?: boolean; richUnits?: boolean; onlyFeedProjectId?: string } = {}): Promise<DriveSyncResult> {
  if (!driveConfigured()) return { ok: false, message: "Google Drive is not configured (GOOGLE_* env vars)." };
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct?.driveFolderUrl) return { ok: false, message: "No Drive folder link set for this developer." };
  const folderId = folderIdFromUrl(acct.driveFolderUrl);
  if (!folderId) return { ok: false, message: "Could not read a folder id from the Drive link." };

  const at = await getAccessToken();
  const files = await listFolder(folderId, at);

  // Single-project sync ("Sync with Drive" on one development's own page): some
  // developers keep an authoritative, project-specific price list inside that
  // project's own subfolder (e.g. "Arbeo Park_Sales.xlsx" inside "Arbeo Park/"),
  // separate from — and more current than — the developer-wide master sheet.
  // Prefer that file when it exists; only fall back to the master sheet if the
  // project has no subfolder or no price-list-looking file inside it.
  let price: DriveFile | null = null;
  if (opts.onlyFeedProjectId) {
    const existingDev = await prisma.development.findFirst({
      where: { developerAccountId, feedProjectId: opts.onlyFeedProjectId },
      select: { publicName: true, driveFolderId: true },
    });
    const subId = existingDev?.driveFolderId || findSubfolder(files, existingDev?.publicName ?? "")?.id || null;
    if (subId) {
      const subFiles = await listFolder(subId, at);
      price = findPriceFile(subFiles);
    }
  }
  if (!price) price = findPriceFile(files);
  if (!price) return { ok: false, message: "No price-list spreadsheet found in the folder." };

  if (!opts.force && !opts.content && acct.driveFileId === price.id && acct.driveFileModified === price.modifiedTime) {
    return { ok: true, skipped: true, message: `Unchanged since last sync (${price.name}).` };
  }

  const text = await getSpreadsheetText(price, at);
  // The extra project-level calls (location/mapsUrl/type/completion/amenities/notes)
  // only read the same spreadsheet text — no media involved — so run them for the
  // units-only sync too, not just a full import.
  const extracted = await extractAvailabilityFromPricelist(text, !!opts.content || !!opts.richUnits);
  if (!extracted.length) return { ok: false, message: "Could not extract any projects from the price list." };

  // Extra stability layer: once a project has been synced before, its stored
  // publicName is a more reliable ground truth than a fresh in-document catalog
  // match — the AI's own catalog read isn't fully deterministic run to run. Every
  // extracted project name gets re-resolved against what's already in the DB for
  // this developer BEFORE anything else, so a rephrased catalog entry this run
  // can't silently fork an already-known project into a duplicate Development.
  const existingProjects = await prisma.development.findMany({ where: { developerAccountId, dev: "drive" }, select: { publicName: true } });
  if (existingProjects.length) {
    const toExisting = buildCanonicalMatcher(existingProjects.map((d) => d.publicName));
    for (const p of extracted) {
      const { name, matched } = toExisting(p.project);
      if (matched) p.project = name;
    }
  }

  // Scope to a single project (its own "Sync with Drive" button) — the whole sheet
  // still has to be extracted (the AI reads it as one document), but only this
  // project's Development/units get written, leaving its siblings untouched.
  const projects = opts.onlyFeedProjectId ? extracted.filter((p) => slug(p.project) === opts.onlyFeedProjectId) : extracted;
  if (opts.onlyFeedProjectId && !projects.length) return { ok: false, message: "This project wasn't found in the current price list (it may have been renamed in the sheet)." };

  const richUnits = !!opts.content || !!opts.richUnits;
  let totalAvail = 0;
  let mediaChanged = false;
  for (const p of projects) {
    if (!p.project || !p.units?.length) continue;
    const r = await writeProject(developerAccountId, acct.name, p, !!opts.content, files, at, richUnits);
    totalAvail += r.avail;
    if (r.mediaChanged) mediaChanged = true;
  }

  // Only the whole-developer sync (no single-project scope) tracks the price
  // file's own change-signature — a single-project resync shouldn't mark the
  // whole sheet "seen" and make the next scheduled full sync skip other projects.
  if (!opts.onlyFeedProjectId) {
    await prisma.developerAccount.update({
      where: { id: developerAccountId },
      data: { driveFileId: price.id, driveFileModified: price.modifiedTime, driveSyncedAt: new Date() },
    });
  }

  // New images/plans were mirrored → restart so Next serves them (best-effort).
  if (mediaChanged) scheduleAppRestart();

  return { ok: true, message: `${opts.content ? "Imported" : "Synced"} ${projects.length} project${projects.length === 1 ? "" : "s"} from “${price.name}”.`, projects: projects.length, unitsAvailable: totalAvail };
}

// Every developer with a Drive link. Daily cron uses content=false (availability
// only); content=true does a full rich re-import for all of them.
const intervalMs = (i: string | null | undefined) =>
  i === "off" ? Infinity : i === "weekly" ? 7 * 864e5 : i === "2day" ? 2 * 864e5 : 864e5;

export async function syncAllDrives(force = false, content = false): Promise<{ developer: string; result: DriveSyncResult }[]> {
  const devs = await prisma.developerAccount.findMany({
    where: { NOT: { driveFolderUrl: null } },
    select: { id: true, name: true, driveSyncInterval: true, driveSyncedAt: true },
  });
  const out: { developer: string; result: DriveSyncResult }[] = [];
  for (const d of devs) {
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
