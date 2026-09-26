import { parse as parseHtml } from "node-html-parser";
import { countableFeedUnits, completenessVerdict } from "./feedSync";
import { prisma } from "./prisma";
import { getAccessToken, listFolder, collectMedia, downloadFile, type DriveFile } from "./googleDrive";
import { storeUploadedImage, pdfPagesToJpegs, devKeyFor, beginSyncWindow, scheduleAppRestart } from "./imageMirror";
import { recomputeDevelopmentDerivedState } from "./developmentDerivedState";
import { recomputeDevelopmentDistances } from "./developmentDistances";
import { logCronRun } from "./cronLog";
import { cleanNumber, parsePriceList, type PlusProject, type PlusUnit } from "./plusProperties";
import { MISSING_PRICE_LIST } from "./plusIncomplete";

/* Plus Properties sync. Spec:
   docs/superpowers/specs/2026-09-25-plus-properties-connector-design.md.
   The pure helpers come first; syncPlusProperties() at the bottom is the only
   code here that touches the database, Drive or the network. */

export const PLUS_DEV = "plusproperties";
export const PLUS_ACCOUNT_SLUG = "plus-properties";
export const PLUS_XML_FOLDER = "1xeFHfoMUGpyAPMgUMe9qMHmyRvyOdnMu";
export const PLUS_PDF_FOLDER = "14Kg7ggLA10DIHqY-fQk2L-BGvN27g5JZ";
export const PLUS_PROJECTS_FOLDER = "1aXXbOSp_-10rLlHHixQzGR-RKnc342AN";
/* The feeds' floor of 20 units cannot bind here: Plus projects hold 4 to 63
   units, so most of them could lose everything without tripping it. 3 is
   Mito's floor, chosen for the same reason. */
export const PLUS_INCOMPLETE_ABS_FLOOR = 3;

/* The project NUMBER is the identity. Price-list names change with every
   version, and the media tree spells the same number differently. Joined
   numbers use "-" or "_" with no spaces ("67_68_69", "70-71"); a spaced dash
   is not a join ("PLUS 4 - 502 Penthouse" is project 4, unit 502). */
export function projectKey(name: string): string | null {
  if (/house\s*-?\s*kiti/i.test(name)) return "house-kiti";
  const m = name.match(/plus\s*(\d+(?:[-_]\d+)*)/i);
  return m ? m[1].replace(/_/g, "-") : null;
}

export const publicNameFor = (key: string) => (key === "house-kiti" ? "House Kiti" : `Plus ${key}`);
export const feedKeyFor = (key: string) => `${PLUS_DEV}:${key}`;

/* What uniqueDevelopmentSlug() will mint from the public name on publish. The
   connector never writes a slug; the dry run uses this to warn about a clash. */
export const slugCandidate = (publicName: string) =>
  publicName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function splitLocation(location: string | null): { town: string | null; district: string | null } {
  if (!location || !location.trim()) return { town: null, district: null };
  /* Greedy: the district is after the LAST dash, spaced or not ("Universal -
     Paphos", "Livadia – Larnaca", "Agios Tychonas-Limassol"). */
  const m = location.trim().match(/^(.*\S)\s*[-–]\s*(\S.*)$/);
  return m ? { town: m[1].trim(), district: m[2].trim() } : { town: null, district: location.trim() };
}

/* The pin (!3d<lat>!4d<lng>) is the place; @lat,lng is only where the map was
   centred, and the two differ (Plus 33: 32.4312 vs 32.4290). Anything outside
   Cyprus is a wrong link, not a location. */
export function coordsFromMapsUrl(raw: string | null): { lat: number; lng: number } | null {
  if (!raw) return null;
  /* A resolved link can arrive percent-encoded ("%213d…%214d…", "q=34.9%2C33.6"). */
  let url = raw;
  try { url = decodeURIComponent(raw); } catch { /* a malformed escape: read the link as it is */ }
  /* "/maps/search/34.916252,+33.634789?entry=tts" (Plus 82, House Kiti) is a
     searched point, like q=, so it ranks with q= and above the viewport
     centre. The "+" (or a decoded %20) after the comma is optional. A Plus
     Code ("q=WJPP+7FG …", Plus 87) matches nothing here and is not decoded. */
  const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    ?? url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
    ?? url.match(/\/maps\/search\/(-?\d+\.\d+),[+\s]*(-?\d+\.\d+)/)
    ?? url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return lat > 34.4 && lat < 35.8 && lng > 32.2 && lng < 34.7 ? { lat, lng } : null;
}

/* A project whose Maps link gave no coordinates (a Plus Code, a place name,
   a link that did not resolve) is saved without a pin; the operator sets it. */
export function mapsLinkNote(key: string, mapsUrl: string | null, coords: { lat: number; lng: number } | null): string | null {
  return mapsUrl && !coords ? `${key}: no coordinates in the Maps link — set the pin in the admin` : null;
}

/* Only the "Project Details" block of the developer's page: a <strong> label,
   then a <ul>. Raw facts for the AI description generator and the amenity
   list; the operator reviews every draft before it is published. */
export function projectDetails(html: string): { facts: string[]; energy: string | null } {
  const root = parseHtml(html);
  const label = root.querySelectorAll("strong").find((s) => /project details/i.test(s.text));
  /* Most pages wrap the label in its own <p>, so the <ul> is the label's
     PARENT's next sibling; some wrap nothing, so the <ul> follows the
     <strong> directly. Try the direct sibling first. */
  let el = label?.nextElementSibling ?? null;
  if (!el || el.tagName !== "UL") {
    el = label?.parentNode?.nextElementSibling ?? null;
    while (el && el.tagName !== "UL") el = el.nextElementSibling;
  }
  if (!el) return { facts: [], energy: null };
  const all = el.querySelectorAll("li").map((li) => li.text.replace(/\s+/g, " ").trim()).filter(Boolean);
  /* "Solar Energy Panels" also matches /energy/i; only a fact that ALSO ends
     in a class letter ("… Category: A") is the energy fact. Anything else
     matching /energy/i stays a plain amenity. */
  const energyFact = all.find((f) => /energy/i.test(f) && /:\s*[A-G]\+?\s*$/i.test(f)) ?? null;
  const energy = energyFact?.match(/:\s*([A-G]\+?)\s*$/i)?.[1]?.toUpperCase() ?? null;
  return { facts: all.filter((f) => f !== energyFact), energy };
}

/* How the website's facts land on a Development, per the spec's field mapping:
   all of them, one per line, as the raw `description` the AI generator starts
   from; plain ones ("Common Swimming Pool") as amenities; "Label: value" ones
   as extra facts. The operator reviews every draft before it is published. */
export function detailFields(d: { facts: string[]; energy: string | null } | null): {
  description?: string; amenities?: string[]; extraFacts?: { label: string; value: string }[]; energy?: string;
} {
  if (!d) return {};
  const out: { description?: string; amenities?: string[]; extraFacts?: { label: string; value: string }[]; energy?: string } = {};
  if (d.facts.length) out.description = d.facts.join("\n");
  const plain = d.facts.filter((f) => !/^[^:]{2,40}:\s*\S/.test(f));
  const labelled = d.facts.filter((f) => /^[^:]{2,40}:\s*\S/.test(f)).map((f) => {
    const i = f.indexOf(":");
    return { label: f.slice(0, i).trim(), value: f.slice(i + 1).trim() };
  });
  if (plain.length) out.amenities = plain;
  if (labelled.length) out.extraFacts = labelled;
  if (d.energy) out.energy = d.energy;
  return out;
}

/* The feeds' completeness rule, per project: count only what this sync can
   change (countableFeedUnits), never units already flagged unlisted. */
export function unitsDecision(input: {
  published: boolean;
  stored: { status: string | null }[];
  fresh: { status: string }[];
}): { blocked: boolean; message: string | null } {
  const before = countableFeedUnits(input.stored.filter((u) => u.status !== "unlisted"), input.published);
  const after = countableFeedUnits(input.fresh, input.published);
  const v = completenessVerdict(before, after, PLUS_INCOMPLETE_ABS_FLOOR);
  return v.blocked
    ? { blocked: true, message: `${v.missing} of ${before} units are missing from the price list (${v.pctLabel} %). Nothing was changed.` }
    : { blocked: false, message: null };
}

/* A run that lost most of its Drive requests (an expired token, an outage)
   writes nothing, rather than reading 35 projects as empty. */
export function runVerdict(input: { attempted: number; failed: number }): { ok: boolean; reason: string | null } {
  if (input.attempted > 0 && input.failed * 2 > input.attempted) {
    return { ok: false, reason: `${input.failed} of ${input.attempted} Drive request(s) failed — nothing was written` };
  }
  return { ok: true, reason: null };
}

/* Exactly "what the admin unit editor can write and this sync does not" —
   carried over by unit ref so hand-set values survive every run (Cybarco,
   2026-09-24). If the sync ever starts writing one of these, it comes off
   this list in the same commit. */
export const MANUAL_UNIT_FIELDS = ["type", "unitNumber", "guestWc", "orientation", "amenities", "photos", "plans"] as const;

export function carryOverManualUnitFields(kept: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!kept) return {};
  const out: Record<string, unknown> = {};
  for (const f of MANUAL_UNIT_FIELDS) {
    const v = kept[f];
    if (v !== null && v !== undefined) out[f] = v;
  }
  return out;
}

/* Plus 21 writes "0" for "none" (uncovered veranda, common area): a zero area
   is no area, and a zero-valued fact is not written. */
const str = (n: number | null) => (n == null || n === 0 ? null : String(n));
const isZero = (v: string | number) => /^0+(?:\.0+)?$/.test(String(v).trim());

/* One DevelopmentUnit row. areaBuilt is what the public unit table shows
   (Covered Area = areaBuilt + areaVeranda, as for Island Blue), so the interior
   goes there as well as to areaInternal. `storage` is a yes/no column; the
   count lives in attrs. A price only ever travels with an available unit. */
export function unitRow(u: PlusUnit, developmentId: string, index: number, kept?: Record<string, unknown> | null): Record<string, unknown> {
  const attrs: { name: string; value: string }[] = [];
  const add = (name: string, v: string | number | null) => { if (v != null && v !== "" && !isZero(v)) attrs.push({ name, value: String(v) }); };
  add("Parking", u.parking);
  add("Storage", u.storage);
  add("Roof terrace (m²)", u.areaRoof);
  add("Garden (m²)", u.areaGarden);
  add("Common area (m²)", u.areaCommon);
  add("Total area (m²)", u.areaTotal);
  const storageCount = cleanNumber(u.storage) ?? 0;
  return {
    ...carryOverManualUnitFields(kept),
    developmentId, source: "feed",
    ref: u.ref, feedRef: u.ref, label: u.label,
    status: u.status, price: u.status === "available" ? u.price : null, currency: "EUR",
    beds: u.beds, baths: u.baths, floor: u.floor,
    /* "1", "1 Roof", "Yes" → yes. */
    storage: u.storage == null ? null : storageCount > 0 || /yes/i.test(u.storage) ? "yes" : "no",
    areaBuilt: str(u.areaBuilt), areaInternal: str(u.areaBuilt),
    areaVeranda: str(u.areaVeranda), areaVerandaOpen: str(u.areaVerandaOpen), areaPlot: str(u.areaPlot),
    attrs, sortIndex: index,
  };
}

/* A stored unit's identity on the sheet. An admin can rename `ref` in the unit
   editor (saveUnits rewrites ref and keeps feedRef and source), so matching
   anchors on feedRef, as feedSync does, and falls back to ref only for a row
   without one ("" counts as none, as in feedSync's feedRef backfill). */
export const storedUnitKey = (r: { ref?: string | null; feedRef?: string | null }): string | null => r.feedRef || r.ref || null;

/* Whether a freshly mirrored list is what the row already holds: same URLs,
   same order. Mirrored URLs are content-hashed, so a project re-mirrored only
   because one file keeps failing comes back identical and has nothing for a
   restart to pick up. An empty or unwritten fresh list is never a change
   (the semantics of cybarcoSync's mediaListChanged, restated, not imported). */
export function sameList(fresh: string[] | null, stored: unknown): boolean {
  if (!fresh || !fresh.length) return true;
  const s = Array.isArray(stored) ? stored : [];
  return fresh.length === s.length && fresh.every((url, i) => url === s[i]);
}

/* Whether an empty media listing must be ignored. listFolder turns an HTTP
   error into [], so an empty listing of a project that already has media is
   far likelier a Drive hiccup than a developer deleting everything. "Has
   media" cannot rest on the signature alone: after a partial media failure it
   is deliberately left unadvanced (null), while the gallery and plans that did
   mirror are stored. A new project with nothing stored has nothing to lose. */
const isNonEmptyList = (v: unknown) => Array.isArray(v) && v.length > 0;

export function keepStoredMediaOnEmptyListing(input: {
  images: unknown[]; plans: unknown[];
  storedSig: string | null | undefined; storedGallery: unknown; storedPlans: unknown;
}): boolean {
  if (input.images.length || input.plans.length) return false;
  return !!input.storedSig || isNonEmptyList(input.storedGallery) || isNonEmptyList(input.storedPlans);
}

/* The same hiccup, one list at a time: listFolder answers per subfolder, so
   the images can come back [] while the plans list fine (or the reverse).
   An empty fresh list over a non-empty stored one keeps the stored one, and
   the signature is held so the next run retries; the other list is written
   normally. */
export function partialMediaListing(input: {
  images: unknown[]; plans: unknown[]; storedGallery: unknown; storedPlans: unknown;
}): { keepGallery: boolean; keepPlans: boolean; holdSig: boolean } {
  const keepGallery = !input.images.length && isNonEmptyList(input.storedGallery);
  const keepPlans = !input.plans.length && isNonEmptyList(input.storedPlans);
  return { keepGallery, keepPlans, holdSig: keepGallery || keepPlans };
}

/* Stored Plus projects without a price list this run.
   - One that already has feed units got them from a price list. If only its
     PDF is left (or nothing), re-gathering it as "pdf-only" would rewrite its
     row and freeze its units with no signal. It is skipped whole — no
     Development, unit or media write — and raised as a plus-incomplete alarm,
     which the project's next clean run clears (ok=true on the same key).
   - One that never had feed units (Plus 4, 29, 72: PDF-only from the start)
     and still has its PDF is written as a presentation page, as always; one
     absent altogether is left exactly as it is, and the note is the only trace. */
export { MISSING_PRICE_LIST };
export const missingPriceListNote = (key: string) => `${key}: ${MISSING_PRICE_LIST}`;
export const absentProjectNote = (key: string) => `${key}: no price list in the folder this run — left as it is`;

export function missingPriceListDecision(input: {
  xmlKeys: string[]; pdfKeys: string[]; stored: { key: string; hasFeedUnits: boolean }[];
}): { skip: string[]; noteOnly: string[] } {
  const xml = new Set(input.xmlKeys), pdf = new Set(input.pdfKeys);
  const skip: string[] = [], noteOnly: string[] = [];
  for (const s of input.stored) {
    if (xml.has(s.key)) continue;
    if (s.hasFeedUnits) skip.push(s.key);
    else if (!pdf.has(s.key)) noteOnly.push(s.key);
  }
  return { skip, noteOnly };
}

/* The feed-sync freeze, restated here like Cybarco does: content an admin has
   curated stays put once a project is published; location only once set.
   Units and prices always sync. */
const FROZEN_WHEN_PUBLISHED = ["publicName", "description", "amenities", "gallery", "plans"] as const;
const FROZEN_WHEN_PUBLISHED_IF_SET = ["district", "town", "latitude", "longitude"] as const;

function freezeForPublished(data: Record<string, unknown>, existing: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  for (const k of FROZEN_WHEN_PUBLISHED) delete out[k];
  for (const k of FROZEN_WHEN_PUBLISHED_IF_SET) if (existing[k] != null && existing[k] !== "") delete out[k];
  return out;
}

export type PlusPlanRow = {
  key: string; publicName: string; source: "xml" | "pdf-only"; exists: boolean; published: boolean;
  units: { available: number; reserved: number; sold: number };
  images: number; plans: number; coords: boolean; facts: number;
  slug: string; slugTaken: boolean; blocked: string | null; notes: string[];
};

export type PlusRunResult = {
  ok: boolean; reason: string | null; dryRun: boolean;
  projects: number; created: number; units: number;
  failed: string[]; blocked: string[]; notes: string[]; plan: PlusPlanRow[];
};

/* The cron log line and the failure notification. Telegram refuses anything
   over 4096 characters and nothing here chunks, so only the first three of a
   kind are named and each is clipped. */
const clip = (s: string, n = 150) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
export function summarizePlusRun(r: PlusRunResult): string {
  return [
    `${r.projects} project(s), ${r.created} created, ${r.units} unit(s) written`,
    `${r.failed.length} failed, ${r.blocked.length} blocked, ${r.notes.length} note(s)`,
    r.failed.length ? `failed: ${r.failed.slice(0, 3).map((x) => clip(x)).join("; ")}` : null,
    r.notes.length ? `notes: ${r.notes.slice(0, 3).map((x) => clip(x)).join("; ")}` : null,
    r.reason,
  ].filter(Boolean).join(", ");
}

type Gathered = {
  key: string; source: "xml" | "pdf-only"; project: PlusProject | null; mediaFolder: string | null;
  coords: { lat: number; lng: number } | null; details: { facts: string[]; energy: string | null } | null;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function resolvedUrl(url: string): Promise<string | null> {
  try { const r = await fetch(url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(20000) }); return r.url || null; } catch { return null; }
}

async function mediaFolders(token: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const city of (await listFolder(PLUS_PROJECTS_FOLDER, token)).filter((f) => f.mimeType === FOLDER_MIME)) {
    for (const p of (await listFolder(city.id, token)).filter((f) => f.mimeType === FOLDER_MIME)) {
      const key = projectKey(p.name);
      if (key && !out.has(key)) out.set(key, p.id);
    }
  }
  return out;
}

export async function syncPlusProperties(accountId: string, opts: { force?: boolean; dryRun?: boolean } = {}): Promise<PlusRunResult> {
  const acct = await prisma.developerAccount.findUnique({ where: { id: accountId }, select: { id: true, name: true } });
  if (!acct) throw new Error(`Plus Properties: no DeveloperAccount ${accountId}`);
  const result: PlusRunResult = { ok: true, reason: null, dryRun: !!opts.dryRun, projects: 0, created: 0, units: 0, failed: [], blocked: [], notes: [], plan: [] };
  const release = beginSyncWindow("plus-sync");
  let anyNewMedia = false;
  try {
    /* ── gather everything first; nothing below this block writes ── */
    const token = await getAccessToken();
    let attempted = 0, failedReq = 0;
    const tryDrive = async <T>(fn: () => Promise<T>): Promise<T | null> => {
      attempted++;
      try { return await fn(); } catch { failedReq++; return null; }
    };
    /* Newest first: if the developer drops a new version beside the old one,
       the newest file is the list and the older one is reported, not synced. */
    const xmlListing = await tryDrive(() => listFolder(PLUS_XML_FOLDER, token));
    const xmlFiles = (xmlListing ?? [])
      .filter((f: DriveFile) => /\.xml$/i.test(f.name))
      .sort((a: DriveFile, b: DriveFile) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
    const pdfFiles = ((await tryDrive(() => listFolder(PLUS_PDF_FOLDER, token))) ?? []).filter((f: DriveFile) => /\.pdf$/i.test(f.name));
    const folders = (await tryDrive(() => mediaFolders(token))) ?? new Map<string, string>();
    const gathered: Gathered[] = [];
    const xmlKeys = new Set<string>();
    for (const f of xmlFiles) {
      const key = projectKey(f.name);
      if (!key) { result.notes.push(`ignored price list without a project number: ${f.name}`); continue; }
      if (xmlKeys.has(key)) { result.notes.push(`older price list for ${publicNameFor(key)} ignored: ${f.name}`); continue; }
      xmlKeys.add(key);
      /* A price list that could not be fetched fails its project, exactly
         like one that could not be parsed. It must never degrade into a
         "PDF-only" page that rewrites the row and skips the units silently. */
      const bytes = await tryDrive(() => downloadFile(f.id, token));
      if (!bytes) { result.failed.push(`${key}: price list could not be downloaded`); continue; }
      let project: PlusProject;
      try { project = await parsePriceList(bytes.toString("utf8")); }
      catch (e) { result.failed.push(`${key}: ${e instanceof Error ? e.message : String(e)}`); continue; }
      gathered.push({ key, source: "xml", project, mediaFolder: folders.get(key) ?? null, coords: null, details: null });
    }
    /* PDF-only projects (Plus 4, 29, 72 on 2026-09-25) become presentation
       pages without units — the spec's "all 35 projects exist as drafts".
       A stored project that already has feed units and lost only its price
       list is gathered here too, then held back from every write below
       (missingPriceListDecision). */
    for (const f of pdfFiles) {
      const key = projectKey(f.name);
      if (!key || xmlKeys.has(key) || gathered.some((g) => g.key === key)) continue;
      gathered.push({ key, source: "pdf-only", project: null, mediaFolder: folders.get(key) ?? null, coords: null, details: null });
    }
    for (const g of gathered) {
      if (g.project?.mapsUrl) {
        g.coords = coordsFromMapsUrl(await resolvedUrl(g.project.mapsUrl));
        const note = mapsLinkNote(g.key, g.project.mapsUrl, g.coords);
        if (note) result.notes.push(note);
      }
      if (g.project?.websiteUrl) {
        /* A hanging host must not hold the sync window: 20 s, then no facts. */
        try { g.details = projectDetails(await (await fetch(g.project.websiteUrl, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(20000) })).text()); }
        catch { g.details = null; }
      }
    }
    const verdict = runVerdict({ attempted, failed: failedReq });
    if (!verdict.ok) return { ...result, ok: false, reason: verdict.reason };
    /* Without the price-list folder every project would be read as PDF-only
       under a green run (1 failed request of 3 passes the verdict). */
    if (!xmlListing || !xmlFiles.length) {
      return { ...result, ok: false, reason: xmlListing ? "the price-list folder holds no .xml price list — nothing was written" : "the price-list folder could not be listed — nothing was written" };
    }

    /* ── the plan, and in a dry run the whole answer ── */
    const existingRows = await prisma.development.findMany({
      where: { dev: PLUS_DEV },
      select: { id: true, feedKey: true, publishStatus: true, driveImagesModified: true, gallery: true, plans: true, district: true, town: true, latitude: true, longitude: true },
    });
    const byFeedKey = new Map(existingRows.map((r) => [r.feedKey, r] as const));
    /* A key with a price list (read or not) is handled below. A stored one
       without, that already has feed units, is skipped and alarmed; one that
       never had any is written from its PDF, or only noted when absent. */
    const withFeedUnits = new Set((await prisma.developmentUnit.findMany({
      where: { source: "feed", development: { dev: PLUS_DEV } }, select: { developmentId: true }, distinct: ["developmentId"],
    })).map((u) => u.developmentId));
    const pdfKeys: string[] = [];
    for (const f of pdfFiles) { const k = projectKey(f.name); if (k) pdfKeys.push(k); }
    const missing = missingPriceListDecision({
      xmlKeys: Array.from(xmlKeys), pdfKeys,
      stored: existingRows.map((r) => ({ key: r.feedKey.slice(PLUS_DEV.length + 1), hasFeedUnits: withFeedUnits.has(r.id) })),
    });
    result.notes.push(...missing.noteOnly.map(absentProjectNote), ...missing.skip.map(missingPriceListNote));
    const skipKeys = new Set(missing.skip);
    const toWrite = gathered.filter((g) => !skipKeys.has(g.key));
    const slugs = gathered.map((g) => slugCandidate(publicNameFor(g.key)));
    const [takenDev, takenLegacy] = await Promise.all([
      prisma.development.findMany({ where: { slug: { in: slugs } }, select: { slug: true, feedKey: true } }),
      prisma.project.findMany({ where: { slug: { in: slugs } }, select: { slug: true } }),
    ]);
    for (const g of gathered) {
      const existing = byFeedKey.get(feedKeyFor(g.key));
      const slug = slugCandidate(publicNameFor(g.key));
      const units = g.project?.units ?? [];
      const count = (s: string) => units.filter((u) => u.status === s).length;
      const media = g.mediaFolder && opts.dryRun ? await tryDrive(() => collectMedia(g.mediaFolder!, token, { maxDepth: 4 })) : null;
      result.plan.push({
        key: g.key, publicName: publicNameFor(g.key), source: g.source, exists: !!existing,
        published: existing?.publishStatus === "published",
        units: { available: count("available"), reserved: count("reserved"), sold: count("sold") },
        images: media?.images.length ?? 0, plans: media?.plans.length ?? 0,
        coords: !!g.coords, facts: g.details?.facts.length ?? 0,
        slug, slugTaken: takenDev.some((t) => t.slug === slug && t.feedKey !== feedKeyFor(g.key)) || takenLegacy.some((t) => t.slug === slug),
        blocked: skipKeys.has(g.key) ? MISSING_PRICE_LIST : null, notes: g.project?.notes ?? [],
      });
    }
    if (opts.dryRun) return { ...result, projects: toWrite.length };

    /* A real run only: the Action Center raises "price list looks incomplete"
       for each, until its list is back and a clean run logs ok=true. */
    for (const k of missing.skip) await logCronRun(`plus-incomplete:${k}`, false, MISSING_PRICE_LIST);

    /* ── write, one project at a time; a failure costs only that project ── */
    for (const g of toWrite) {
      try {
        for (const n of g.project?.notes ?? []) result.notes.push(`${g.key}: ${n}`);
        /* A token lasts an hour and a full run with media can outlast it. */
        const projectToken = await getAccessToken();
        const feedKey = feedKeyFor(g.key);
        const existing = byFeedKey.get(feedKey) ?? null;
        const published = existing?.publishStatus === "published";
        const devKey = devKeyFor(feedKey);
        /* One bad image or plan costs that file, not the project. Any failure
           leaves the media signature where it was, so the next run retries. */
        let mediaFailed = 0;
        /* A published project's gallery and plans are frozen, so mirroring them
           would only store files nobody uses and schedule a restart. */
        const mirrorMedia = !!g.mediaFolder && (!published || !!opts.force);
        let media: Awaited<ReturnType<typeof collectMedia>> | null = null;
        if (mirrorMedia) {
          try { media = await collectMedia(g.mediaFolder!, projectToken, { maxDepth: 4 }); }
          catch { mediaFailed++; result.notes.push(`${g.key}: media folder could not be listed — will retry next run`); }
        }
        /* An empty listing of a folder that had media is far likelier a Drive
           hiccup than a developer deleting everything: never overwrite with it. */
        if (media && keepStoredMediaOnEmptyListing({
          images: media.images, plans: media.plans,
          storedSig: existing?.driveImagesModified, storedGallery: existing?.gallery, storedPlans: existing?.plans,
        })) {
          result.notes.push(`${g.key}: media listing came back empty — kept the stored media`);
          media = null;
        }
        let gallery: string[] | null = null, plans: string[] | null = null;
        let holdSig = false;
        if (media && (opts.force || existing?.driveImagesModified !== media.sig)) {
          const partial = partialMediaListing({ images: media.images, plans: media.plans, storedGallery: existing?.gallery, storedPlans: existing?.plans });
          gallery = [];
          for (const img of media.images) {
            try {
              const url = await storeUploadedImage(await downloadFile(img.id, projectToken), devKey);
              if (url) gallery.push(url); else mediaFailed++;
            } catch { mediaFailed++; }
          }
          const imagesFailed = mediaFailed;
          plans = [];
          for (const p of media.plans) {
            try {
              const buf = await downloadFile(p.id, projectToken);
              const pages = p.mimeType === "application/pdf" ? await pdfPagesToJpegs(buf, 60) : [buf];
              let storedPages = 0;
              for (const page of pages) { const url = await storeUploadedImage(page, devKey); if (url) { plans.push(url); storedPages++; } }
              if (pages.length === 0 || storedPages < pages.length) mediaFailed++;
            } catch { mediaFailed++; }
          }
          /* A list where every file failed keeps what the row already has
             rather than being overwritten with nothing. */
          if (!gallery.length && imagesFailed) gallery = null;
          if (!plans.length && mediaFailed > imagesFailed) plans = null;
          if (partial.keepGallery) { gallery = null; result.notes.push(`${g.key}: no images listed this run — kept the stored gallery`); }
          if (partial.keepPlans) { plans = null; result.notes.push(`${g.key}: no plans listed this run — kept the stored plans`); }
          holdSig = partial.holdSig;
          if (mediaFailed) result.notes.push(`${g.key}: ${mediaFailed} media file(s) failed — will retry next run`);
          anyNewMedia = anyNewMedia || !sameList(gallery, existing?.gallery) || !sameList(plans, existing?.plans);
        }
        const { town, district } = splitLocation(g.project?.location ?? null);
        const units = g.project?.units ?? [];
        const row: Record<string, unknown> = {
          developerAccountId: acct.id, dev: PLUS_DEV, feedProjectId: g.key, feedKey,
          developerName: g.project?.title ?? publicNameFor(g.key), publicName: publicNameFor(g.key), developer: acct.name,
          currency: "EUR", syncedAt: new Date(),
          ...(town ? { town } : {}), ...(district ? { district } : {}),
          ...(g.project?.stage ? { stage: g.project.stage, status: g.project.stage } : {}),
          ...(g.coords ? { latitude: g.coords.lat, longitude: g.coords.lng } : {}),
          ...detailFields(g.details),
          ...(gallery ? { gallery } : {}), ...(plans ? { plans } : {}),
          ...(media && gallery && mediaFailed === 0 && !holdSig ? { driveImagesModified: media.sig } : {}),
        };
        const dev = existing
          ? await prisma.development.update({ where: { feedKey }, data: (published ? freezeForPublished(row, existing) : row) as never })
          : await prisma.development.create({ data: { ...row, publishStatus: "draft" } as never });
        if (!existing) result.created++;
        result.projects++;
        /* As feedSync does; the function itself prefers an admin's override pin. */
        if (dev.latitude != null && dev.longitude != null) await recomputeDevelopmentDistances(dev.id);

        if (g.project) {
          const stored = await prisma.developmentUnit.findMany({
            where: { developmentId: dev.id, source: "feed" },
            select: { id: true, ref: true, feedRef: true, status: true, type: true, unitNumber: true, guestWc: true, orientation: true, amenities: true, photos: true, plans: true },
          });
          const decision = unitsDecision({ published, stored, fresh: units });
          if (decision.blocked) {
            result.blocked.push(`${g.key}: ${decision.message}`);
            await logCronRun(`plus-incomplete:${g.key}`, false, decision.message ?? undefined);
          } else {
            const keep = new Map<string, Record<string, unknown> & { id: string }>();
            for (const r of stored) { const k = storedUnitKey(r); if (k) keep.set(k, r as unknown as Record<string, unknown> & { id: string }); }
            /* A unit the admin has edited by hand (setUnitPhotos flips it to
               source "manual") wins: the sheet neither updates it nor creates
               a feed twin with the same ref beside it. */
            const manualRefs = new Set((await prisma.developmentUnit.findMany({
              where: { developmentId: dev.id, source: "manual" }, select: { ref: true, feedRef: true },
            })).map(storedUnitKey).filter((r): r is string => !!r));
            const writable = units.map((u, i) => ({ u, i })).filter(({ u }) => !manualRefs.has(u.ref));
            if (writable.length < units.length) result.notes.push(`${g.key}: ${units.length - writable.length} unit(s) edited by hand are left as they are`);
            if (!published) {
              /* One transaction: a failed create must not leave a draft with no units. */
              await prisma.$transaction([
                prisma.developmentUnit.deleteMany({ where: { developmentId: dev.id, source: "feed" } }),
                ...(writable.length ? [prisma.developmentUnit.createMany({ data: writable.map(({ u, i }) => unitRow(u, dev.id, i, keep.get(u.ref))) as never })] : []),
              ]);
            } else {
              const fresh = new Set(units.map((u) => u.ref));
              for (const { u, i } of writable) {
                const hit = keep.get(u.ref);
                const data = unitRow(u, dev.id, i, hit) as never;
                if (hit) await prisma.developmentUnit.update({ where: { id: hit.id }, data });
                else await prisma.developmentUnit.create({ data });
              }
              for (const r of stored) {
                const k = storedUnitKey(r);
                if (k && !fresh.has(k) && r.status !== "sold" && r.status !== "unlisted") {
                  await prisma.developmentUnit.update({ where: { id: r.id }, data: { status: "unlisted" } });
                }
              }
            }
            /* The price range follows the units just written; derived state
               does not recompute it. None available clears it, so a sold-out
               project shows no stale "from" price. */
            const prices = units.filter((u) => u.status === "available" && u.price != null).map((u) => u.price as number);
            await prisma.development.update({
              where: { id: dev.id },
              data: { priceFrom: prices.length ? Math.min(...prices) : null, priceTo: prices.length ? Math.max(...prices) : null },
            });
            result.units += writable.length;
            await logCronRun(`plus-incomplete:${g.key}`, true, `price list complete — ${units.length} unit(s)`);
          }
        }
        await recomputeDevelopmentDerivedState(dev.id);
      } catch (e) {
        result.failed.push(`${g.key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    /* "Last synced" on the developer admin page, as for Cybarco. */
    await prisma.developerAccount.update({ where: { id: acct.id }, data: { driveSyncedAt: new Date() } });
    return result;
  } finally {
    release();
    if (anyNewMedia && !opts.dryRun) scheduleAppRestart();
  }
}
