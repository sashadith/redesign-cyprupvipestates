"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { extractProjectFromPdfs } from "@/lib/ai/pdfExtract";
import { generateProjectDescription } from "@/lib/ai/projectDescription";
import type { FourLang } from "@/lib/ai/areaContent";
import { storeUploadedImage, storeRawFile, devKeyFor, pdfPagesToJpegs, scheduleAppRestart, mirrorAny } from "@/lib/imageMirror";
import { resolveMapsUrlToGeo } from "@/lib/mapsGeo";
import { recomputeDevelopmentDistances } from "@/lib/developmentDistances";
import { recomputeDevelopmentDerivedState } from "@/lib/developmentDerivedState";
import { listedUnits } from "@/lib/developmentAvailability";
import { syncDeveloperDrive, type DriveSyncResult } from "@/lib/driveAvailabilitySync";
import { syncOneDevelopment, type SyncOneDevelopmentResult } from "@/lib/feedSync";
import { uniqueDevelopmentSlug } from "@/lib/developmentSeo";
import { generateSeoMeta, getSeoPromptTemplate, saveSeoPromptTemplate, type SeoMetaResult } from "@/lib/ai/seoMeta";
import { getDbProject } from "@/lib/developmentRender";
import { pingIndexNow, absUrl } from "@/lib/indexnow";
import { localizedHref } from "@/lib/locale";
import { syncErrorMessage } from "@/lib/syncErrorMessage";

const asArr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

// "Sync with Drive" on a single development's own page — full re-import (rich data +
// description + images), but scoped to just this project so its siblings aren't touched.
export async function syncThisDevelopmentAction(developmentId: string): Promise<DriveSyncResult> {
  const d = await prisma.development.findUnique({ where: { id: developmentId }, select: { developerAccountId: true, feedProjectId: true, dev: true } });
  if (!d || d.dev !== "drive") return { ok: false, message: "This development isn't Drive-synced." };
  try {
    const r = await syncDeveloperDrive(d.developerAccountId, { force: true, content: true, onlyFeedProjectId: d.feedProjectId });
    revalidatePath(`/admin/developments/${developmentId}`);
    revalidatePath("/admin/developments");
    return r;
  } catch (e) {
    return { ok: false, message: syncErrorMessage(e) };
  }
}

// "Sync with Drive" on the Units block specifically — price/availability list only,
// same light path the nightly cron uses. No image download, no PDF conversion, no
// document analysis, so this stays fast regardless of how large the media folder is.
export async function syncThisDevelopmentUnitsAction(developmentId: string): Promise<DriveSyncResult> {
  const d = await prisma.development.findUnique({ where: { id: developmentId }, select: { developerAccountId: true, feedProjectId: true, dev: true } });
  if (!d || d.dev !== "drive") return { ok: false, message: "This development isn't Drive-synced." };
  try {
    const r = await syncDeveloperDrive(d.developerAccountId, { force: true, content: false, richUnits: true, onlyFeedProjectId: d.feedProjectId });
    revalidatePath(`/admin/developments/${developmentId}`);
    revalidatePath("/admin/developments");
    return r;
  } catch (e) {
    return { ok: false, message: syncErrorMessage(e) };
  }
}

// (C) Generate a fresh 4-language description from ALL project data, no project name.
export async function generateDescription(developmentId: string, words: number, tuning?: { emphasize?: string; avoid?: string }): Promise<{ ok: boolean; texts?: FourLang; error?: string }> {
  try {
    const d = await prisma.development.findUnique({ where: { id: developmentId }, include: { override: true, units: true } });
    if (!d) return { ok: false, error: "Not found" };
    const ov = d.override;
    const area = ov?.area || d.area || "";
    const slug = area.toLowerCase().replace(/ph/g, "f").replace(/[^a-z]/g, "");
    const areaRow = area ? await prisma.areaDescription.findFirst({ where: { areaSlug: slug } }) : null;

    // Describes the KIND of home, never how many or how big. The count and the
    // size range used to be in here and went straight into saved description
    // text that nothing ever regenerates — see the no-digit rule in
    // src/lib/ai/projectDescription.ts. Bedrooms survive because they describe
    // the homes themselves; the prompt requires them spelled out as words.
    // Listed units only, so a type or bedroom count carried solely by units that
    // vanished from the feed can't be advertised (same population the public
    // page renders — see listedUnits).
    const listed = listedUnits(d.units);
    const types = Array.from(new Set(listed.map((u) => u.type).filter(Boolean)));
    const beds = Array.from(new Set(listed.map((u) => u.beds).filter(Boolean))).sort();
    const unitSummary = [
      types.length ? types.join(" / ") : "",
      beds.length ? beds.join("/") + "-bedroom" : "",
    ].filter(Boolean).join(", ");

    const texts = await generateProjectDescription({
      district: ov?.district || d.district || "",
      town: ov?.town || d.town || "",
      area,
      areaText: areaRow?.textEN || undefined,
      category: d.category || undefined,
      stage: ov?.stage || d.stage || undefined,
      completion: ov?.completion || d.completion || undefined,
      priceFrom: d.priceFrom,
      projectAmenities: asArr(ov?.amenities).length ? asArr(ov?.amenities) : asArr(d.amenities),
      unitAmenities: Array.from(new Set(d.units.flatMap((u) => asArr(u.amenities)))),
      unitSummary,
      sourceText: d.description || undefined,
      words,
      emphasize: tuning?.emphasize,
      avoid: tuning?.avoid,
    });
    return { ok: true, texts };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// SEO meta title/description — Claude-generated alternative to the free auto-template
// (src/lib/developmentSeo.ts). Reuses the same ProjectVM the public page and the
// auto-template both read, so "what Claude sees" matches "what's actually live".
export async function generateSeoMetaAction(developmentId: string, tuning?: { emphasize?: string; avoid?: string }): Promise<{ ok: boolean; result?: SeoMetaResult; error?: string }> {
  try {
    const d = await prisma.development.findUnique({ where: { id: developmentId }, select: { dev: true, feedProjectId: true } });
    if (!d) return { ok: false, error: "Not found" };
    const vm = await getDbProject(d.dev, d.feedProjectId);
    if (!vm) return { ok: false, error: "Could not load project data" };
    const result = await generateSeoMeta(vm, tuning);
    return { ok: true, result };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// The prompt behind "Generate with Claude" in the SEO section — ONE shared row,
// editable from any project's page, applies to every future generation everywhere.
export async function saveSeoPromptAction(text: string): Promise<void> {
  await saveSeoPromptTemplate(text);
}

// (D) Internal uniqueness — Jaccard on 3-word shingles vs our OTHER descriptions.
function shingles(s: string): Set<string> {
  const w = s.toLowerCase().match(/[a-zäöüßа-яąćęłńóśźż]+/g) || [];
  const out = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}
export async function checkDescriptionUniqueness(developmentId: string, text: string): Promise<{ uniqueness: number; sim: number; mostSimilar: string }> {
  const mine = shingles(text);
  if (mine.size === 0) return { uniqueness: 100, sim: 0, mostSimilar: "" };
  const others = await prisma.developmentOverride.findMany({
    where: { developmentId: { not: developmentId }, NOT: { descriptionEN: null } },
    select: { descriptionEN: true, development: { select: { publicName: true } } },
  });
  let maxSim = 0, who = "";
  for (const o of others) {
    const b = shingles(o.descriptionEN || "");
    if (!b.size) continue;
    let inter = 0;
    mine.forEach((x) => { if (b.has(x)) inter++; });
    const s = inter / (mine.size + b.size - inter);
    if (s > maxSim) { maxSim = s; who = o.development?.publicName || ""; }
  }
  return { uniqueness: Math.round((1 - maxSim) * 100), sim: Math.round(maxSim * 100), mostSimilar: who };
}

// Process uploaded image files → mirrored WebP → return their public URLs (the
// client adds them to the gallery; saveGallery persists the final order).
// Note: none of the three upload* actions below schedule a restart themselves —
// the client uploads one file per call (see GalleryManager/UnitImages/
// FloorPlansManager) to stay well under the server-action body-size limit, and
// scheduling a restart per file would crash-loop pm2 with N restarts 4s apart
// (bit us for feed-sync's image mirroring — see feedSync.ts). The client calls
// scheduleUploadsRestartAction() itself exactly ONCE after the whole batch finishes.
export async function scheduleUploadsRestartAction() {
  scheduleAppRestart();
}

export async function uploadDevImages(developmentId: string, formData: FormData): Promise<string[]> {
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const dev = await prisma.development.findUnique({ where: { id: developmentId }, select: { feedKey: true } });
  if (!dev) return [];
  const devKey = devKeyFor(dev.feedKey);
  const urls: string[] = [];
  for (const f of files) {
    const url = await storeUploadedImage(Buffer.from(await f.arrayBuffer()), devKey);
    if (url) urls.push(url);
  }
  return urls;
}

// Upload images for a single UNIT → return their public URLs.
export async function uploadUnitImages(unitId: string, formData: FormData): Promise<string[]> {
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const unit = await prisma.developmentUnit.findUnique({ where: { id: unitId }, select: { development: { select: { feedKey: true } } } });
  if (!unit) return [];
  const devKey = devKeyFor(unit.development.feedKey);
  const urls: string[] = [];
  for (const f of files) {
    const url = await storeUploadedImage(Buffer.from(await f.arrayBuffer()), devKey);
    if (url) urls.push(url);
  }
  return urls;
}

// Persist a unit's ordered photos (first = cover). Marks the unit manual.
// Every image URL an admin action persists is mirrored first (2026-08-04) —
// any external URL left in the DB is a dependency on a third-party server
// we don't control (availability, resolution). mirrorAny() is a no-op for
// URLs already under /uploads/ (the common case: reordering an existing
// gallery), so this only costs real time for genuinely new/external images.
export async function setUnitPhotos(unitId: string, photos: string[]) {
  const clean = photos.map((u) => String(u).trim()).filter(Boolean);
  const unit = await prisma.developmentUnit.findUnique({ where: { id: unitId }, select: { developmentId: true, development: { select: { feedKey: true } } } });
  if (!unit) return;
  const { urls, anyNew } = await mirrorAny(clean, devKeyFor(unit.development.feedKey));
  await prisma.developmentUnit.update({ where: { id: unitId }, data: { photos: urls as any, source: "manual" } });
  if (anyNew) scheduleAppRestart();
  revalidatePath(`/admin/developments/${unit.developmentId}`);
}

// Copy this unit's photos to every OTHER unit in the development that is 100%
// identical (same type / beds / baths / areas). Returns how many were updated.
export async function applyPhotosToIdentical(unitId: string): Promise<number> {
  const u = await prisma.developmentUnit.findUnique({ where: { id: unitId }, include: { development: { select: { feedKey: true } } } });
  if (!u) return 0;
  const twins = await prisma.developmentUnit.findMany({
    where: {
      developmentId: u.developmentId,
      id: { not: u.id },
      type: u.type,
      beds: u.beds,
      baths: u.baths,
      areaBuilt: u.areaBuilt,
      areaVeranda: u.areaVeranda,
    },
    select: { id: true },
  });
  if (twins.length) {
    const { urls, anyNew } = await mirrorAny((u.photos as string[] | null) ?? [], devKeyFor(u.development.feedKey));
    await prisma.developmentUnit.updateMany({ where: { id: { in: twins.map((t) => t.id) } }, data: { photos: urls as any, source: "manual" } });
    if (anyNew) scheduleAppRestart();
    revalidatePath(`/admin/developments/${u.developmentId}`);
  }
  return twins.length;
}

// Persist the admin-managed gallery order + hero. Wins over the feed gallery.
// Drops any URL the admin just saved into gallery/plans out of the stored
// Development.newFromFeed candidate list — otherwise a "New in feed" image
// they've already added would keep showing up as still-new until the next
// force-mirror happens to recompute the list from scratch. driftCounts is
// left as-is (it reflects hash-level drift, not the picker list; the next
// sync recomputes it anyway).
async function dropFromNewFromFeed(developmentId: string, key: "gallery" | "plans", justSaved: string[]) {
  const d = await prisma.development.findUnique({ where: { id: developmentId }, select: { newFromFeed: true } });
  const current = d?.newFromFeed as { gallery?: string[]; plans?: string[]; driftCounts?: any } | null;
  const list = current?.[key];
  if (!Array.isArray(list) || !list.length) return;
  const saved = new Set(justSaved);
  const remaining = list.filter((u) => !saved.has(u));
  if (remaining.length === list.length) return; // nothing picked from this list, no write needed
  await prisma.development.update({ where: { id: developmentId }, data: { newFromFeed: { ...current, [key]: remaining } as any } });
}

export async function saveGallery(developmentId: string, gallery: string[], mainImage: string | null) {
  const clean = gallery.map((u) => String(u).trim()).filter(Boolean);
  const dev = await prisma.development.findUnique({ where: { id: developmentId }, select: { feedKey: true } });
  if (!dev) return;
  const devKey = devKeyFor(dev.feedKey);
  const { urls, anyNew: galleryNew } = await mirrorAny(clean, devKey);
  const heroInput = mainImage ? mainImage.trim() : "";
  const { urls: heroUrls, anyNew: heroNew } = heroInput ? await mirrorAny([heroInput], devKey) : { urls: [""], anyNew: false };
  await prisma.developmentOverride.upsert({
    where: { developmentId },
    update: { gallery: urls as any, mainImage: heroUrls[0] || urls[0] || null },
    create: { developmentId, gallery: urls as any, mainImage: heroUrls[0] || urls[0] || null },
  });
  await dropFromNewFromFeed(developmentId, "gallery", urls);
  if (galleryNew || heroNew) scheduleAppRestart();
  revalidatePath(`/admin/developments/${developmentId}`);
}

// Floor-plan images live on Development.plans (the drive sync only (re)collects plans
// when none are stored, so admin edits persist). Upload accepts images or PDFs — a PDF
// is rasterized to JPEG page(s) so the public site (which only renders <img>) always
// gets an image; if conversion isn't available it falls back to storing the raw PDF.
export async function uploadDevPlans(developmentId: string, formData: FormData): Promise<string[]> {
  const files = formData.getAll("plans").filter((f): f is File => f instanceof File && f.size > 0);
  const dev = await prisma.development.findUnique({ where: { id: developmentId }, select: { feedKey: true } });
  if (!dev) return [];
  const devKey = devKeyFor(dev.feedKey);
  const urls: string[] = [];
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      const pages = await pdfPagesToJpegs(buf);
      if (pages.length) {
        for (const pg of pages) { const url = await storeUploadedImage(pg, devKey); if (url) urls.push(url); }
        continue;
      }
      const url = await storeRawFile(buf, devKey, "pdf");
      if (url) urls.push(url);
    } else {
      const url = await storeUploadedImage(buf, devKey);
      if (url) urls.push(url);
    }
  }
  return urls;
}

// Persist the admin-managed floor-plan order / deletions.
export async function savePlans(developmentId: string, plans: string[]) {
  const clean = plans.map((u) => String(u).trim()).filter(Boolean);
  const dev = await prisma.development.findUnique({ where: { id: developmentId }, select: { feedKey: true } });
  if (!dev) return;
  const { urls, anyNew } = await mirrorAny(clean, devKeyFor(dev.feedKey));
  await prisma.development.update({ where: { id: developmentId }, data: { plans: urls as any } });
  await dropFromNewFromFeed(developmentId, "plans", urls);
  if (anyNew) scheduleAppRestart();
  revalidatePath(`/admin/developments/${developmentId}`);
}

// Upload developer PDFs → Claude extracts → pre-fills EMPTY override fields and
// (re)creates the manually-sourced units. Never overwrites existing admin values;
// the sync never touches "manual" units. Human reviews before publishing.
export async function importFromPdfs(formData: FormData) {
  const id = String(formData.get("id"));
  const files = formData.getAll("pdfs").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return;

  const pdfs: { base64: string }[] = [];
  for (const f of files) pdfs.push({ base64: Buffer.from(await f.arrayBuffer()).toString("base64") });

  const emphasize = String(formData.get("emphasize") || "");
  const avoid = String(formData.get("avoid") || "");
  let data;
  try {
    data = await extractProjectFromPdfs(pdfs, { emphasize, avoid });
  } catch (e) {
    // No message slot in this form (see PdfImport.tsx) — surface the real
    // cause in the server log instead of letting it crash into Next's
    // redacted digest, same reasoning as syncErrorMessage's callers.
    console.error(`importFromPdfs(${id}) failed:`, syncErrorMessage(e));
    return;
  }
  if (!data) return;

  const dev = await prisma.development.findUnique({ where: { id }, include: { override: true } });
  if (!dev) return;
  const ov = dev.override;
  const amenities = data.amenities?.length ? data.amenities : ((ov?.amenities as string[]) ?? []);

  const fields = {
    alias: ov?.alias || data.name || null,
    descriptionEN: ov?.descriptionEN || data.description || null,
    completion: ov?.completion || data.completion || null,
    vatApplies: ov?.vatApplies ?? data.vatApplies ?? null,
    amenities: amenities as any,
  };
  await prisma.developmentOverride.upsert({
    where: { developmentId: id },
    update: fields,
    create: { developmentId: id, ...fields },
  });

  // The PDF unit list is authoritative → replace ALL units (also removes the
  // feed's partial/duplicate units). The sync then leaves this development alone.
  await prisma.developmentUnit.deleteMany({ where: { developmentId: id } });
  if (data.units?.length) {
    await prisma.developmentUnit.createMany({
      data: data.units.map((u, i) => ({
        developmentId: id,
        ref: u.ref || null,
        label: [u.block ? `Block ${u.block}` : "", u.ref].filter(Boolean).join(" · ") || u.ref || null,
        type: u.type || null,
        status: u.status || "available",
        price: u.price != null ? Math.round(u.price) : null,
        beds: u.beds != null ? String(u.beds) : null,
        baths: u.baths != null ? String(u.baths) : null,
        areaBuilt: u.totalM2 != null ? `${u.totalM2} m²` : null,
        areaInternal: u.internalM2 != null ? `${u.internalM2} m²` : null,
        areaVeranda: u.verandaM2 != null ? `${u.verandaM2} m²` : null,
        sortIndex: i,
        source: "manual",
      })),
    });
  }
  await recomputeDevelopmentDerivedState(id);
  revalidatePath(`/admin/developments/${id}`);
}

const clean = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
};

// Standalone map-location save — independent of "Save overrides". Previously,
// pasting a link and clicking "Save overrides" would silently write null/null
// whenever resolution failed (bad link format, redirect issue, etc.), with no
// feedback that anything went wrong ("clicked Save, nothing happened"). This
// resolves + saves immediately, never overwrites existing coordinates on
// failure, and reports back clearly either way.
export async function saveMapLocationAction(developmentId: string, rawGeo: string): Promise<{ ok: boolean; message: string; lat?: number; lng?: number }> {
  const text = rawGeo.trim();
  if (!text) return { ok: false, message: "Paste a Google Maps link or \"lat, lng\" first." };
  try {
    const geo = await resolveMapsUrlToGeo(text);
    if (!geo) {
      return { ok: false, message: "Couldn't extract coordinates from that — try the full google.com/maps link (not a shortened share link), or paste \"lat, lng\" directly." };
    }
    await prisma.developmentOverride.upsert({
      where: { developmentId },
      update: { latitude: geo.lat, longitude: geo.lng },
      create: { developmentId, latitude: geo.lat, longitude: geo.lng },
    });
    // Auto recompute (haversine, src/lib/developmentDistances.ts) — the whole
    // point of an admin overriding the pin is usually that the feed's own
    // geocoding was wrong, so the distances shown to visitors must reflect
    // the corrected location immediately, not the next sync.
    await recomputeDevelopmentDistances(developmentId);
    revalidatePath(`/admin/developments/${developmentId}`);
    return { ok: true, message: `Saved: ${geo.lat}, ${geo.lng}`, lat: geo.lat, lng: geo.lng };
  } catch (e) {
    return { ok: false, message: `Failed: ${String((e as any)?.message ?? e).slice(0, 200)}` };
  }
}

export async function saveOverride(formData: FormData) {
  const id = String(formData.get("id"));
  const amenities = formData.getAll("amenities").map((v) => String(v).trim()).filter(Boolean);
  // SEO title/description overrides — only stored if at least one is actually
  // filled in; empty stays `null` so resolveMetaTitle/Description fall through
  // to the auto-generated default (src/lib/developmentSeo.ts) rather than an
  // object of empty strings that would still read as "present".
  const seoEntries = {
    titleEN: clean(formData, "seoTitleEN"), titleDE: clean(formData, "seoTitleDE"), titlePL: clean(formData, "seoTitlePL"), titleRU: clean(formData, "seoTitleRU"),
    descEN: clean(formData, "seoDescEN"), descDE: clean(formData, "seoDescDE"), descPL: clean(formData, "seoDescPL"), descRU: clean(formData, "seoDescRU"),
  };
  const seo = Object.values(seoEntries).some(Boolean) ? seoEntries : null;
  // Map location is saved independently via saveMapLocationAction (its own
  // button) — never touched here, so a re-submit of this form can't silently
  // wipe coordinates that field already saved.
  const data = {
    alias: clean(formData, "alias"),
    district: clean(formData, "district"),
    town: clean(formData, "town"),
    area: clean(formData, "area"),
    heroVideo: clean(formData, "heroVideo"),
    descriptionEN: clean(formData, "descriptionEN"),
    descriptionDE: clean(formData, "descriptionDE"),
    descriptionPL: clean(formData, "descriptionPL"),
    descriptionRU: clean(formData, "descriptionRU"),
    completion: clean(formData, "completion"),
    energy: clean(formData, "energy"),
    // Construction-stage override (Available / Under Construction / Key-Ready /
    // Sold) — lives in DevelopmentOverride, not on Development itself. It used
    // to be written straight to Development.stage on the assumption sync never
    // touches it ("drive sync never writes stage") — true for drive-synced
    // developers, but feedSync.ts DOES write Development.stage on every run for
    // feed-based ones, silently reverting an admin's choice the next sync
    // (Celestia, 2026-07-17/18). Same protection every other field here already
    // has: sync never writes to this table at all.
    stage: clean(formData, "stage"),
    amenities,
    seo: seo as any,
  };
  await prisma.developmentOverride.upsert({
    where: { developmentId: id },
    update: data,
    create: { developmentId: id, ...data },
  });
  // Manual slug edit — only touched when the admin actually typed something (an
  // empty field means "keep whatever's there / let publish auto-assign one
  // later"). Deduped against every OTHER row so two projects can never collide.
  const rawSlug = clean(formData, "slug");
  if (rawSlug) {
    const finalSlug = await uniqueDevelopmentSlug(rawSlug, id);
    await prisma.development.update({ where: { id }, data: { slug: finalSlug } });
  }
  revalidatePath(`/admin/developments/${id}`);
  revalidatePath("/admin/developments");

  if (seo) {
    const dev = await prisma.development.findUnique({ where: { id }, select: { publishStatus: true, slug: true } });
    if (dev?.publishStatus === "published" && dev.slug) {
      const urls = ["en", "de", "pl", "ru"].map((l) => absUrl(localizedHref(l, ["projects", dev.slug!])));
      void pingIndexNow("development-meta-edited", urls);
    }
  }
}

// Bulk-save the unit list from the editor. All units become manually managed
// (source "manual") so the sync stops overwriting them.
export async function saveUnits(developmentId: string, units: any[]) {
  const num = (v: any) => {
    const n = Math.round(Number(String(v ?? "").replace(/[^\d.]/g, "")));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  // Preserve photos + sync-derived extra specs (attrs) across text edits by matching on label/ref —
  // the editor form doesn't surface `attrs` (plot/parking/pool/etc. from the price-list extraction),
  // so without this a manual save would silently wipe them.
  // feedRef needs the same by-key preservation: this delete+recreate would
  // otherwise silently blank it on every manual save, exactly like the
  // ref=label incident it was built to prevent — feedRef is the future
  // status-sync's only match anchor and the form never surfaces it for
  // editing at all (see UnitDetail.tsx, read-only display only). 2026-07-27.
  // source needs the same by-key preservation, for the opposite reason from
  // feedRef: this used to be hardcoded to "manual" on every save, which is
  // what silently locked a feed-managed Development out of all future syncs
  // the moment anyone opened its editor and clicked Save — the root cause of
  // the Cirvis incidents. A save must never change source either way now;
  // "becoming manual" happens only through the explicit toggle
  // (setDevelopmentSyncMode below). A brand-new unit (no prior row to match)
  // defaults to "manual" — it demonstrably didn't come from a sync. 2026-07-27.
  const prev = await prisma.developmentUnit.findMany({ where: { developmentId }, select: { ref: true, label: true, photos: true, attrs: true, feedRef: true, source: true } });
  const photoByKey = new Map<string, any>();
  const attrsByKey = new Map<string, any>();
  const feedRefByKey = new Map<string, string | null>();
  const sourceByKey = new Map<string, string>();
  for (const u of prev) {
    const k = (u.label || u.ref || "").trim().toLowerCase();
    if (k) { photoByKey.set(k, u.photos); attrsByKey.set(k, u.attrs); feedRefByKey.set(k, u.feedRef); sourceByKey.set(k, u.source); }
  }
  // Every photo URL is mirrored before it's persisted (2026-08-04) — this is
  // the main unit-photo editing path (no separate "save photos" step), so
  // it's the one most likely to reintroduce an external URL. Already-local
  // entries are a no-op in mirrorAny(). devKey resolution failing (no feed
  // configured) falls back to the raw client array rather than blocking the
  // whole save.
  const dev = await prisma.development.findUnique({ where: { id: developmentId }, select: { feedKey: true } });
  const devKey = dev ? devKeyFor(dev.feedKey) : null;
  let anyNew = false;
  const rows = await Promise.all((units || []).map(async (u, i) => {
    const label = String(u.label ?? "").trim() || null;
    const key = (label || "").toLowerCase();
    const rawPhotos = Array.isArray(u.photos) ? u.photos.map((x: any) => String(x).trim()).filter(Boolean) : photoByKey.get(key);
    let photos = rawPhotos;
    if (devKey && Array.isArray(rawPhotos) && rawPhotos.length) {
      const r = await mirrorAny(rawPhotos, devKey);
      photos = r.urls;
      if (r.anyNew) anyNew = true;
    }
    return {
      developmentId,
      label,
      // The feed's own reference code — comes from its OWN form field now,
      // never derived from `label`. Previously this was `ref: label`, which
      // clobbered the real feed reference on every save (e.g. Cirvis:
      // "A103Cirvis" → whatever text was typed as the label), permanently
      // breaking any future feed-based matching for that unit. Fixed 2026-07-26.
      ref: String(u.ref ?? "").trim() || null,
      type: String(u.type ?? "").trim() || null,
      beds: String(u.beds ?? "").trim() || null,
      baths: String(u.baths ?? "").trim() || null,
      areaBuilt: String(u.areaBuilt ?? "").trim() || null,
      areaInternal: String(u.areaInternal ?? "").trim() || null,
      areaPlot: String(u.areaPlot ?? "").trim() || null,
      areaVeranda: String(u.areaVeranda ?? "").trim() || null,
      areaVerandaOpen: String(u.areaVerandaOpen ?? "").trim() || null,
      floor: String(u.floor ?? "").trim() || null,
      unitNumber: String(u.unitNumber ?? "").trim() || null,
      storage: String(u.storage ?? "").trim() || null,
      guestWc: String(u.guestWc ?? "").trim() || null,
      orientation: String(u.orientation ?? "").trim() || null,
      amenities: (Array.isArray(u.amenities) ? u.amenities : []) as any,
      price: num(u.price),
      status: ["available", "reserved", "sold"].includes(u.status) ? u.status : "available",
      // The editor now edits photos directly (no separate "Save photos" button) —
      // the client is authoritative when it sends an array; only fall back to the
      // stored value for any caller that doesn't send photos at all. Mirrored above.
      photos: photos as any,
      attrs: (attrsByKey.get(key) ?? null) as any,
      // Never sourced from the form — feedRef has no editable field at all
      // (UnitDetail.tsx shows it read-only). Preserved by key exactly like
      // photos/attrs above, or this delete+recreate would blank it.
      feedRef: feedRefByKey.get(key) ?? null,
      sortIndex: i,
      source: sourceByKey.get(key) ?? "manual",
    };
  }));
  await prisma.developmentUnit.deleteMany({ where: { developmentId } });
  if (rows.length) await prisma.developmentUnit.createMany({ data: rows });
  if (anyNew) scheduleAppRestart();
  await recomputeDevelopmentDerivedState(developmentId);
  revalidatePath(`/admin/developments/${developmentId}`);
}

// Teil 3 (sync control panel): the deliberate manual↔auto toggle — the ONLY
// place source is allowed to change, now that saveUnits() above preserves it.
// feed→manual is a pure protection upgrade (no data at risk, no confirm
// needed server-side — the button's own client-side confirm is enough).
// manual→feed is the dangerous direction: it doesn't delete anything itself,
// but it re-exposes every unit to the next sync's deleteMany+createMany,
// which for a curated project (real photos/attrs/amenities the feed can't
// reproduce) is effectively unrecoverable data loss within 24h. The
// data-loss numbers themselves are computed client-side from data already
// on the page (SyncControlPanel.tsx) — this action only flips the flag.
export async function setDevelopmentSyncMode(developmentId: string, mode: "manual" | "feed") {
  await prisma.developmentUnit.updateMany({ where: { developmentId }, data: { source: mode } });
  revalidatePath(`/admin/developments/${developmentId}`);
}

// Teil 2 (sync control panel): "Units aus Feed neu ziehen" — pulls this one
// Development immediately instead of waiting for the 4am cron. Mirrors
// images now (2026-08-04) — was mirror:false "by design" (avoid the
// app-restart disruption of a single click), but that meant this exact
// button could silently overwrite an already-mirrored gallery/unit-photo
// array with the feed's raw external URLs, which is worse than the
// disruption it was avoiding. scheduleAppRestart() is itself debounced and
// only fires when something was actually written (see feedSync.ts/
// imageMirror.ts), so a routine click stays fast and restart-free.
export async function syncOneDevelopmentAction(developmentId: string): Promise<SyncOneDevelopmentResult> {
  // forceMirror (2026-08-08): admin-initiated click, deliberately bypasses
  // the published-project mirror freeze the nightly cron respects — see
  // feedSync.ts's syncOneProject for the freeze itself.
  const result = await syncOneDevelopment(developmentId, { mirror: true, forceMirror: true });
  revalidatePath(`/admin/developments/${developmentId}`);
  return result;
}

// Publication lifecycle. Publishing requires the gate to pass (checked here too,
// not only in the UI). The required-field list is extensible.
export async function setStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  let slug: string | undefined;
  if (status === "published") {
    const d = await prisma.development.findUnique({ where: { id }, include: { override: true } });
    if (d) {
      const description = d.override?.descriptionEN || d.description;
      const area = d.override?.area || d.area;
      const areaDesc = area ? await prisma.areaDescription.findFirst({ where: { areaSlug: area.toLowerCase().replace(/ph/g, "f").replace(/[^a-z]/g, ""), status: "approved" } }) : null;
      const missing = [!description && "description", !area && "area", !areaDesc && "area description"].filter(Boolean);
      if (missing.length) return; // gate not met — no-op (UI shows why)
      // Every publish needs a real, SEO-facing URL — assign one automatically the
      // first time a development goes live (never reassigned afterwards, so
      // published URLs stay stable even if the public name changes later).
      if (!d.slug) slug = await uniqueDevelopmentSlug(d.override?.alias || d.publicName, d.id);
    }
  }
  const updated = await prisma.development.update({
    where: { id },
    data: { publishStatus: status, publishedAt: status === "published" ? new Date() : null, ...(slug ? { slug } : {}) },
  });
  revalidatePath(`/admin/developments/${id}`);
  revalidatePath("/admin/developments");

  // Fire-and-forget — never awaited, never blocks this action's response.
  if ((status === "published" || status === "archived") && updated.slug) {
    const urls = ["en", "de", "pl", "ru"].map((l) => absUrl(localizedHref(l, ["projects", updated.slug!])));
    urls.push(absUrl("/projects"));
    void pingIndexNow(`development-${status}`, urls);
  }
}
