import crypto from "node:crypto";
import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { dropboxConfigured, getDropboxAccessToken, listSharedFolder, findPriceFile, downloadSharedFile, type DropboxFile } from "./dropbox";
import { extractUnitsForSection, extractAmenitiesForSection, buildCanonicalMatcher, type ExtractedUnit } from "./ai/pricelistExtract";
import { extractColoredRowsFromPdf } from "./ai/pdfPricelistColors";
import { extractTextFromPdf } from "./ai/projectInfoExtract";
import { generateProjectDescription } from "./ai/projectDescription";
import { anthropic, AI_MODEL_FAST } from "./ai/anthropic";
import { toTitleCaseName } from "@/lib/textCase";
import { normalizeRef } from "./unitRef";
import { recomputeDevelopmentDistances } from "./developmentDistances";
import { recomputeDevelopmentDerivedState } from "./developmentDerivedState";
import { resolveMapsUrlToGeo } from "./mapsGeo";
import { storeUploadedImage, storeRawFile, devKeyFor, pdfPagesToJpegs, scheduleAppRestart, beginSyncWindow } from "./imageMirror";
import { workbookToText } from "@/lib/sheetToText";

// Higher than driveAvailabilitySync.ts's MAX_IMAGES=10 — Kuutio's Dropbox
// folders are the developer's own curated marketing set (not a mixed bag of
// site-visit snapshots), and real folders run past 10 (Atrium: 35) with no
// junk observed among them, confirmed 2026-08-13.
const MAX_IMAGES = 40;
const MAX_PLANS = 20;

// Maps a Dropbox folder's trailing "(...)" tag (e.g. "ATRIUM (UNDER
// CONSTRUCTION)") to Development.stage's controlled vocabulary
// (developmentCopy.ts's `stage` Record) — deterministic, no AI needed.
// Matched by keyword, not exact string — confirmed on real data the tag can
// carry extra text (e.g. "GALLERY (OFFPLAN CHLORAKA)" tacks a town name onto
// the stage word). Anything that doesn't match a known keyword is left
// unset rather than guessed, since an unrecognized value would just render
// blank everywhere stage is displayed.
const STAGE_TAG_PATTERNS: [RegExp, string][] = [
  [/under\s*construction/, "under construction"],
  [/off[\s-]?plan/, "off-plan"],
  [/key\s*ready|^ready\b/, "key-ready"],
  [/sold\s*out/, "sold"],
  [/completed/, "completed"],
];
function stageFromFolderName(folderName: string): string | null {
  const m = folderName.match(/\(([^)]+)\)\s*$/);
  if (!m) return null;
  const tag = m[1].trim().toLowerCase();
  return STAGE_TAG_PATTERNS.find(([re]) => re.test(tag))?.[1] ?? null;
}
const IMG_MIME_RE = /^image\/(jpe?g|png|webp)$/i;

/* Dropbox availability sync (2026-08-13, Kuutio) — parallel to
   driveAvailabilitySync.ts, NOT a shared/refactored code path with it (that
   file has already caused two production incidents this session; a new,
   independently-reviewable module is lower risk than threading a Dropbox
   client through its deeply Drive-specific internals).

   Structural difference from every other developer synced so far: project
   IDENTITY is never AI-guessed here. Kuutio's own Dropbox folder names (or,
   for the shared master workbook, its own sheet names) are the ground
   truth, matched deterministically in code; extractUnitsForSection only
   ever extracts PER-UNIT fields inside an already-known boundary — same
   principle pdfPricelistExtract.ts already uses for Motive Point, and for
   the same reason (buildCanonicalMatcher's fuzzy word-overlap scoring is
   what merged VENARA into VENARA VIEW). Confirmed on real data (2026-08-13):
   without this, Kuutio's shared master file — which happens to also contain
   three leftover Olias Homes sheets ("Alder Park", "Pine Park", "Tenera
   Villas") — could have created three spurious cross-developer projects.
   Scoping to Kuutio's own folder list makes that structurally impossible,
   not just filtered after the fact.

   DRAFT-ONLY, units-only for this first version — no image/floor-plan
   mirroring yet (each project's own Photos/Floor plan/Masterplan
   subfolders are known and read for the price file already, so that's a
   contained follow-up, not a redesign). Matches Sascha's explicit
   requirement: first run must not touch Kuutio's 3 existing hand-entered
   projects (dev:"manual") at all, and must show the folder->dataset mapping
   before anything writes. */

const normKey = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const stripTag = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, ""); // "NOBLE (OFFPLAN)" -> "NOBLE"
const refKey = normalizeRef;
const nn = (v: string | undefined | null) => (v && String(v).trim() ? String(v).trim() : null);

async function simplePdfToText(buf: Buffer): Promise<string> {
  const rows = await extractColoredRowsFromPdf(buf);
  return rows.map((r) => r.cells.map((c) => c.text).join("\t")).join("\n");
}

// Deterministic split by getSpreadsheetText's own "### <sheet name>"
// markers — zero AI involved in finding project boundaries.
function splitBySheet(fullText: string): Map<string, string> {
  const out = new Map<string, string>();
  const parts = fullText.split(/^### (.+)$/m);
  for (let i = 1; i < parts.length; i += 2) out.set(parts[i].trim(), parts[i + 1] ?? "");
  return out;
}

// Google Maps short/long link — same set of hosts resolveMapsUrlToGeo
// (mapsGeo.ts) already handles for every other developer.
const MAPS_URL_RE = /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps)\S*/i;

// A project's own Location .docx — confirmed on real data (2026-08-13) to
// sit either directly in the project's root folder ("NOBLE LOCATION.docx")
// or inside its own "LOCATION"-named subfolder (Villa A, Elpez) — check
// both, one level deep only (matches every other per-project subfolder
// convention already confirmed: Photos/Floor plan/Masterplan/Brochure).
async function findMapsUrl(shareUrl: string, projectFolder: DropboxFile, rootFiles: DropboxFile[], at: string): Promise<string | null> {
  const isLocDocx = (f: DropboxFile) => /location/i.test(f.name) && f.mimeType.includes("wordprocessingml");
  const direct = rootFiles.find(isLocDocx);
  const candidates: DropboxFile[] = direct ? [direct] : [];
  if (!candidates.length) {
    const locFolder = rootFiles.find((f) => /location/i.test(f.name) && f.mimeType.includes("folder"));
    if (locFolder) {
      const inner = await listSharedFolder(shareUrl, locFolder.id, at);
      const found = inner.find(isLocDocx);
      if (found) candidates.push(found);
    }
  }
  if (!candidates.length) return null;
  const buf = await downloadSharedFile(shareUrl, candidates[0].id, at);
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value.match(MAPS_URL_RE)?.[0] ?? null;
}

// Photos: whatever the "3.Photos"-style subfolder actually holds, image
// files only (that folder can also contain videos — confirmed on real data,
// Baia/Atrium both had .mp4 files sitting alongside the photos).
async function findPhotos(shareUrl: string, rootFiles: DropboxFile[], at: string): Promise<DropboxFile[]> {
  const folder = rootFiles.find((f) => /photo/i.test(f.name) && f.mimeType.includes("folder"));
  if (!folder) return [];
  const inner = await listSharedFolder(shareUrl, folder.id, at);
  return inner.filter((f) => IMG_MIME_RE.test(f.mimeType)).sort((a, b) => a.name.localeCompare(b.name));
}

// Floor plans + masterplan folded together (same as googleDrive.ts's
// collectMedia: anything under a "draw/plan/floor"-named folder is a plan,
// covers "1. Masterplan" and "2. Floor plan" both via the same regex).
async function findPlans(shareUrl: string, rootFiles: DropboxFile[], at: string): Promise<DropboxFile[]> {
  const folders = rootFiles.filter((f) => /draw|plan|floor/i.test(f.name) && f.mimeType.includes("folder"));
  const out: DropboxFile[] = [];
  for (const folder of folders) {
    const inner = await listSharedFolder(shareUrl, folder.id, at);
    out.push(...inner.filter((f) => IMG_MIME_RE.test(f.mimeType) || f.mimeType === "application/pdf"));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Brochure + (when present) a "Description & Specs" doc — the two real
// marketing-text sources confirmed across all 9 projects. PDFs go through
// the existing marketing-text-only extractor (ignores price tables/legal
// boilerplate by design); docx is used raw, mammoth already strips markup.
export async function gatherSourceText(shareUrl: string, rootFiles: DropboxFile[], at: string): Promise<string> {
  const parts: string[] = [];
  const brochureFolder = rootFiles.find((f) => /brochure/i.test(f.name) && f.mimeType.includes("folder"));
  if (brochureFolder) {
    const inner = await listSharedFolder(shareUrl, brochureFolder.id, at);
    // Try every PDF in the folder, not just the first — confirmed on real
    // data (Atrium) that a folder can hold more than one (a full booklet +
    // a shorter preview), and the extractor can legitimately come back
    // empty for one (image-heavy/scanned layout) while another works fine.
    for (const pdf of inner.filter((f) => f.mimeType === "application/pdf")) {
      const buf = await downloadSharedFile(shareUrl, pdf.id, at);
      const text = await extractTextFromPdf(buf.toString("base64"));
      if (text) { parts.push(text); break; }
    }
  }
  const descFolder = rootFiles.find((f) => /description/i.test(f.name) && f.mimeType.includes("folder"));
  if (descFolder) {
    const inner = await listSharedFolder(shareUrl, descFolder.id, at);
    const docx = inner.find((f) => f.mimeType.includes("wordprocessingml"));
    if (docx) {
      const buf = await downloadSharedFile(shareUrl, docx.id, at);
      const { value } = await mammoth.extractRawText({ buffer: buf });
      if (value.trim()) parts.push(value.trim());
    }
  }
  return parts.join("\n\n");
}

// Short amenities bullet list from the same marketing text — generateProjectDescription
// takes amenities as an INPUT (see projectDescription.ts), it doesn't derive
// them itself; every other developer sources this from their price list's
// own "Notes: In the prices we include…" row (pricelistExtract.ts's
// PROMPT_AMEN), which Kuutio's sheet doesn't have — this is the free-text
// equivalent of that same extraction, same model, same "don't invent" rule.
export async function extractAmenitiesFromText(sourceText: string): Promise<string[]> {
  if (!sourceText.trim()) return [];
  const client = anthropic();
  if (!client) return [];
  try {
    const msg = await client.messages.create({
      model: AI_MODEL_FAST,
      max_tokens: 500,
      tools: [{ name: "data", description: "Extracted amenities.", input_schema: { type: "object", properties: { amenities: { type: "array", items: { type: "string" } } }, required: ["amenities"] } }],
      tool_choice: { type: "tool", name: "data" },
      messages: [{ role: "user", content: `Extract a short list of real included amenities/features from this marketing text (e.g. "Infinity pool", "Underfloor heating", "Concealed A/C", "Private parking"). Short noun phrases, no sentences. Empty list if none found — never invent.\n\n${sourceText.slice(0, 8000)}` }],
    });
    const tool = msg.content.find((b: any) => b.type === "tool_use") as any;
    const list = tool?.input?.amenities;
    return Array.isArray(list) ? list.filter((x) => typeof x === "string" && x.trim()).slice(0, 15) : [];
  } catch {
    return [];
  }
}

export type KuutioProjectResult = {
  folder: string;
  folderId: string; // path relative to the share root — re-list target for content gathering
  projectName: string; // Title Case
  sourceFile: string;
  sectionText: string; // this project's own price-list text — reused for amenities extraction, no re-fetch
  units: ExtractedUnit[];
  matchedExisting: { id: string; publicName: string; dev: string; publishStatus: string } | null;
};

// Read-only: lists every real Kuutio project folder, extracts its own units
// (deterministic boundaries, per-project file preferred over the shared
// master copy — same "project-specific file wins" rule the Drive sync
// already documents), and resolves each against Kuutio's OWN existing
// Development rows only (developerAccountId-scoped — see
// FEED-ADAPTER-GUIDE.md's no-cross-developer-matching rule). Never writes.
export async function previewKuutioSync(developerAccountId: string): Promise<KuutioProjectResult[]> {
  if (!dropboxConfigured()) throw new Error("Dropbox not configured (DROPBOX_* env vars missing)");
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct?.driveFolderUrl) throw new Error("No Dropbox link set for this developer");
  const shareUrl = acct.driveFolderUrl;
  const at = await getDropboxAccessToken();

  const root = await listSharedFolder(shareUrl, "", at);
  const projectFolders = root.filter((f) => f.mimeType.includes("folder"));
  if (!projectFolders.length) throw new Error("No project folders found at the shared link's root");

  const existing = await prisma.development.findMany({
    where: { developerAccountId },
    select: { id: true, publicName: true, dev: true, publishStatus: true },
  });
  const toExisting = buildCanonicalMatcher(existing.map((e) => e.publicName));

  const sheetCache = new Map<string, Map<string, string>>();
  async function getSheets(file: DropboxFile): Promise<Map<string, string>> {
    const buf = await downloadSharedFile(shareUrl, file.id, at);
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    if (sheetCache.has(hash)) return sheetCache.get(hash)!;
    const fullText = workbookToText(buf);
    const sheets = splitBySheet(fullText);
    sheetCache.set(hash, sheets);
    return sheets;
  }

  const results: KuutioProjectResult[] = [];
  for (const folder of projectFolders) {
    const projectName = toTitleCaseName(stripTag(folder.name));
    const inner = await listSharedFolder(shareUrl, folder.id, at);
    const priceFolder = inner.find((i) => /price\s*list|pricelist/i.test(i.name) && i.mimeType.includes("folder"));
    if (!priceFolder) { results.push({ folder: folder.name, folderId: folder.id, projectName, sourceFile: "(no price-list subfolder)", sectionText: "", units: [], matchedExisting: null }); continue; }
    const priceContents = await listSharedFolder(shareUrl, priceFolder.id, at);
    const priceFile = findPriceFile(priceContents);
    if (!priceFile) { results.push({ folder: folder.name, folderId: folder.id, projectName, sourceFile: "(no price file inside)", sectionText: "", units: [], matchedExisting: null }); continue; }

    let sectionText: string | null = null;
    if (priceFile.mimeType === "application/pdf") {
      const buf = await downloadSharedFile(shareUrl, priceFile.id, at);
      sectionText = await simplePdfToText(buf);
    } else {
      const sheets = await getSheets(priceFile);
      const folderKey = normKey(stripTag(folder.name));
      for (const [sheetName, body] of Array.from(sheets.entries())) {
        if (normKey(sheetName) === folderKey) { sectionText = `${sheetName}\n${body}`; break; }
      }
    }

    const units = sectionText?.trim() ? await extractUnitsForSection(sectionText) : [];
    const { name, matched } = toExisting(projectName);
    const matchedExisting = matched ? existing.find((e) => e.publicName === name) ?? null : null;
    results.push({
      folder: folder.name,
      folderId: folder.id,
      projectName,
      sourceFile: priceFile.name,
      sectionText: sectionText || "",
      units,
      matchedExisting: matchedExisting ? { id: matchedExisting.id, publicName: matchedExisting.publicName, dev: matchedExisting.dev, publishStatus: matchedExisting.publishStatus } : null,
    });
  }
  return results;
}

export type KuutioWriteResult = {
  created: { project: string; units: number }[];
  skippedExisting: { project: string; reason: string }[];
  skippedEmpty: string[];
  notDue?: string; // set when a SCHEDULED run was skipped by driveSyncInterval — nothing was read or written
};

// Same vocabulary as the Drive adapter's per-developer interval (daily |
// 2day | weekly | off, DeveloperAccount.driveSyncInterval — the admin
// panel's own dropdown writes it for every developer regardless of
// provider). Deliberately re-stated here rather than imported from
// driveAvailabilitySync.ts: this module's whole premise is that it shares no
// code path with the Drive adapter (see the header comment above), and one
// four-branch map is not worth breaking that for. Until the Dropbox sync
// joined the crontab (2026-08-26) this setting did nothing at all for
// Kuutio — the dropdown was in the UI and silently ignored, because
// syncAllDrives (its only reader) skips Dropbox accounts entirely.
const intervalMs = (i: string | null | undefined) =>
  i === "off" ? Infinity : i === "weekly" ? 7 * 864e5 : i === "2day" ? 2 * 864e5 : 864e5;

// Writes DRAFT-only. A folder that matches an existing Development is NEVER
// touched, full stop — regardless of dev value, not just dev:"manual" (all
// 3 of Kuutio's existing rows happen to be manual today, but this guard
// doesn't rely on that staying true). A folder with zero extracted units
// writes nothing for that folder — structural, not a threshold: no result
// is not the same as "this project has no units".
export async function writeKuutioDraft(developerAccountId: string, opts: { force?: boolean; respectInterval?: boolean } = {}): Promise<KuutioWriteResult> {
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct?.driveFolderUrl) throw new Error("Developer account or its Dropbox link not found");
  const shareUrl = acct.driveFolderUrl;

  // Checked BEFORE beginSyncWindow and before the first Dropbox call: a run
  // that isn't due must cost nothing and must not hold the sync window (which
  // defers unrelated app restarts) for even a moment. Only the scheduled
  // caller passes respectInterval — the admin panel's own button is an
  // explicit human decision and always runs.
  if (opts.respectInterval && !opts.force) {
    const iv = intervalMs(acct.driveSyncInterval);
    const last = acct.driveSyncedAt ? new Date(acct.driveSyncedAt).getTime() : null;
    if (iv === Infinity || (last !== null && Date.now() - last < iv)) {
      const notDue = iv === Infinity
        ? "Interval is off — scheduled run skipped."
        : `Not due yet (${acct.driveSyncInterval ?? "daily"}, last synced ${new Date(last!).toISOString()}).`;
      return { created: [], skippedExisting: [], skippedEmpty: [], notDue };
    }
  }
  // Same protection as the Drive adapter: this run mirrors images over several
  // minutes and must not be cut short by somebody else's restart.
  const releaseSyncWindow = beginSyncWindow("dropbox:kuutio");
  try {
  const at = await getDropboxAccessToken();
  const results = await previewKuutioSync(developerAccountId);

  const created: { project: string; units: number }[] = [];
  const skippedExisting: { project: string; reason: string }[] = [];
  const skippedEmpty: string[] = [];
  let mediaChanged = false;

  for (const r of results) {
    // "Never touch" applies to a match against a FOREIGN row (anything not
    // dev:"dropbox" — Noble/Quatrro/Aion's manual entries today, but this
    // doesn't hardcode "manual" specifically). A match against our OWN
    // previously-created dropbox row is the normal re-sync case, not an
    // anomaly — confirmed necessary on real data: once these 6 projects
    // exist, previewKuutioSync's own matcher naturally matches each folder
    // against its own already-created row, and treating THAT as "foreign"
    // would permanently freeze every dropbox-sourced project after its
    // first sync, including the very re-run meant to backfill content this
    // first version didn't gather yet.
    if (r.matchedExisting && r.matchedExisting.dev !== "dropbox") {
      skippedExisting.push({ project: r.projectName, reason: `matches existing "${r.matchedExisting.publicName}" (dev:${r.matchedExisting.dev}) — never overwritten` });
      continue;
    }
    if (!r.units.length) { skippedEmpty.push(r.projectName); continue; }

    const projSlug = normKey(r.projectName) || crypto.randomUUID();
    const feedKey = `dropbox:${developerAccountId}:${projSlug}`;
    const avail = r.units.filter((u) => u.status === "available").length;
    const prices = r.units.map((u) => u.price).filter((x): x is number => typeof x === "number");
    // "Needs content gathering" — NOT simply "row doesn't exist yet". The
    // very first version of this sync (2026-08-13, deployed and run before
    // this rich-content pass existed) already created these 6 rows with
    // units/price only; a plain existence check would see them as
    // "already synced" and skip content forever. Gallery emptiness is the
    // right proxy: once a project has real photos, this run is done with
    // it (matches "published = frozen" for every other developer) — an
    // empty gallery means content was never gathered, regardless of
    // whether the Development row itself is new.
    const existingRow = await prisma.development.findUnique({ where: { feedKey }, select: { id: true, gallery: true } });
    const isNewDev = opts.force || !existingRow || !(existingRow.gallery as string[] | null)?.length;

    // Rich content — gathered once per NEW project only (re-syncing an
    // already-created dropbox project on a future run only needs to touch
    // units/price above; content stays as first imported, same
    // "published = frozen" precedent as every other developer, applied here
    // from creation since this whole first pass is draft/first-import only).
    let mapsUrl: string | null = null;
    let geo: { lat: number; lng: number } | null = null;
    let sourceText = "";
    let amenities: string[] = [];
    let gallery: string[] = [];
    let plans: string[] = [];
    const stage = stageFromFolderName(r.folder);
    if (isNewDev) {
      const rootFiles = await listSharedFolder(shareUrl, r.folderId, at);
      let priceListAmenities: string[] = [];
      [mapsUrl, sourceText, priceListAmenities] = await Promise.all([
        findMapsUrl(shareUrl, { id: r.folderId, name: r.folder, mimeType: "application/vnd.dropbox.folder", modifiedTime: "" }, rootFiles, at),
        gatherSourceText(shareUrl, rootFiles, at),
        r.sectionText.trim() ? extractAmenitiesForSection(r.sectionText).then((a) => a.amenities) : Promise.resolve([]),
      ]);
      if (mapsUrl) geo = await resolveMapsUrlToGeo(mapsUrl);
      const brochureAmenities = await extractAmenitiesFromText(sourceText);
      // Price list's own Facilities/Notes list is the more structured,
      // authoritative source (confirmed on Atrium: brochure text didn't
      // carry its facilities at all, they're only in the price list) —
      // brochure-derived amenities fill in anything the price list missed.
      const seen = new Set(priceListAmenities.map((a) => a.toLowerCase()));
      amenities = [...priceListAmenities, ...brochureAmenities.filter((a) => !seen.has(a.toLowerCase()))];

      const devKey = devKeyFor(feedKey);
      const photos = (await findPhotos(shareUrl, rootFiles, at)).slice(0, MAX_IMAGES);
      for (const p of photos) {
        try {
          const buf = await downloadSharedFile(shareUrl, p.id, at);
          const url = await storeUploadedImage(buf, devKey);
          if (url) { gallery.push(url); mediaChanged = true; }
        } catch { /* skip one photo */ }
      }
      const planFiles = (await findPlans(shareUrl, rootFiles, at)).slice(0, MAX_PLANS);
      for (const pf of planFiles) {
        try {
          const buf = await downloadSharedFile(shareUrl, pf.id, at);
          if (pf.mimeType === "application/pdf") {
            const pages = await pdfPagesToJpegs(buf);
            for (const pg of pages) { const url = await storeUploadedImage(pg, devKey); if (url) { plans.push(url); mediaChanged = true; } }
          } else {
            const url = await storeUploadedImage(buf, devKey);
            if (url) { plans.push(url); mediaChanged = true; }
          }
        } catch { /* skip one plan */ }
      }
    }

    const descCtx = isNewDev ? {
      district: "", town: "", area: "",
      projectAmenities: amenities, unitAmenities: [],
      unitSummary: `${r.units.length} units, ${avail} available`,
      sourceText, words: 120,
    } : null;
    const description = descCtx && sourceText ? await generateProjectDescription(descCtx).catch(() => null) : null;

    const dev = await prisma.development.upsert({
      where: { feedKey },
      create: {
        developerAccountId, dev: "dropbox", feedProjectId: projSlug, feedKey,
        developerName: r.projectName, publicName: r.projectName, developer: acct.name,
        publishStatus: "draft", unitsTotal: r.units.length, unitsAvailable: avail,
        priceFrom: prices.length ? Math.min(...prices) : null,
        syncedAt: new Date(),
        ...(geo ? { latitude: geo.lat, longitude: geo.lng } : {}),
        ...(amenities.length ? { amenities } : {}),
        ...(gallery.length ? { gallery } : {}),
        ...(plans.length ? { plans } : {}),
        ...(stage ? { stage } : {}),
      },
      update: {
        unitsTotal: r.units.length, unitsAvailable: avail, syncedAt: new Date(),
        ...(geo ? { latitude: geo.lat, longitude: geo.lng } : {}),
        ...(amenities.length ? { amenities } : {}),
        ...(gallery.length ? { gallery } : {}),
        ...(plans.length ? { plans } : {}),
        ...(stage ? { stage } : {}),
      },
    });
    await recomputeDevelopmentDistances(dev.id);

    // Four-language description lives on DevelopmentOverride, not
    // Development itself — same table driveAvailabilitySync.ts's own
    // description-generation step writes to (see its `content &&
    // !dev.override?.descriptionEN?.trim()` guard/upsert).
    if (description) {
      await prisma.developmentOverride.upsert({
        where: { developmentId: dev.id },
        create: { developmentId: dev.id, descriptionEN: description.en, descriptionDE: description.de, descriptionPL: description.pl, descriptionRU: description.ru },
        update: { descriptionEN: description.en, descriptionDE: description.de, descriptionPL: description.pl, descriptionRU: description.ru },
      });
    }

    const existingUnits = await prisma.developmentUnit.findMany({
      where: { developmentId: dev.id },
      select: { id: true, ref: true, source: true },
    });
    const existingByKey = new Map(existingUnits.filter((u) => u.ref).map((u) => [refKey(u.ref!, r.projectName), u]));
    const touchedIds = new Set<string>();

    for (const u of r.units) {
      const ref = String(u.ref || "").trim();
      if (!ref) continue;
      const k = refKey(ref, r.projectName);
      const data = {
        ref,
        type: nn(u.type),
        price: typeof u.price === "number" ? Math.round(u.price) : null,
        status: u.status,
        beds: nn(u.bedrooms),
        baths: nn(u.bathrooms),
        areaBuilt: nn(u.areaBuilt),
        areaPlot: nn(u.areaPlot),
        areaVeranda: nn(u.areaVeranda),
        areaVerandaOpen: nn(u.areaVerandaOpen),
      };
      const existingUnit = existingByKey.get(k);
      if (existingUnit) {
        touchedIds.add(existingUnit.id);
        await prisma.developmentUnit.update({ where: { id: existingUnit.id }, data });
      } else {
        const createdUnit = await prisma.developmentUnit.create({ data: { developmentId: dev.id, ...data } });
        touchedIds.add(createdUnit.id);
      }
    }
    await recomputeDevelopmentDerivedState(dev.id);

    // Same two absolute pruning guards as driveAvailabilitySync.ts's
    // writeProject: never touch source:"manual" (moot here — this path only
    // ever runs for a BRAND NEW Development with no manual units yet, but
    // kept for when a later re-sync of an already-Dropbox-sourced project
    // hits this same code), and only reached at all when this run's
    // extraction was non-empty (the skippedEmpty check above).
    const prunable = existingUnits.filter((eu) => eu.source !== "manual" && !touchedIds.has(eu.id));
    if (prunable.length) await prisma.developmentUnit.deleteMany({ where: { id: { in: prunable.map((u) => u.id) } } });

    created.push({ project: r.projectName, units: r.units.length });
  }

  // New images/plans were mirrored under public/uploads — Next must restart
  // to serve them (see scheduleAppRestart's own doc comment in
  // imageMirror.ts; googleDrive-sourced syncs hit the exact same
  // requirement).
  if (mediaChanged) scheduleAppRestart();

  // Same bookkeeping the Drive adapter does at the end of its own successful
  // run (driveAvailabilitySync.ts's `driveSyncedAt: new Date()`), and the
  // reason the admin panel read "Last synced: never" for Kuutio even after
  // five successful Dropbox syncs: driveSyncedAt had exactly one writer, in
  // the other adapter. It is also what the interval check above reads, so
  // without this a scheduled run would be due every single night forever.
  // driveFileId/driveFileModified are deliberately NOT touched — they hold
  // Drive file ids and a Drive-modifiedTime signature, and there is no
  // Dropbox equivalent stored anywhere yet (a Dropbox skip-signature would
  // be a separate change, not a side effect of this one).
  await prisma.developerAccount.update({ where: { id: developerAccountId }, data: { driveSyncedAt: new Date() } });

  return { created, skippedExisting, skippedEmpty };
  } finally {
    releaseSyncWindow();
  }
}
