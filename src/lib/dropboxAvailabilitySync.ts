import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { dropboxConfigured, getDropboxAccessToken, listSharedFolder, findPriceFile, downloadSharedFile, type DropboxFile } from "./dropbox";
import { extractUnitsForSection, buildCanonicalMatcher, type ExtractedUnit } from "./ai/pricelistExtract";
import { extractColoredRowsFromPdf } from "./ai/pdfPricelistColors";
import { toTitleCaseName } from "@/lib/textCase";
import { normalizeRef } from "./unitRef";
import { recomputeDevelopmentDistances } from "./developmentDistances";
import { recomputeDevelopmentDerivedState } from "./developmentDerivedState";

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

export type KuutioProjectResult = {
  folder: string;
  projectName: string; // Title Case
  sourceFile: string;
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
    const wb = XLSX.read(buf, { type: "buffer" });
    const fullText = wb.SheetNames.map((n) => `### ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n");
    const sheets = splitBySheet(fullText);
    sheetCache.set(hash, sheets);
    return sheets;
  }

  const results: KuutioProjectResult[] = [];
  for (const folder of projectFolders) {
    const projectName = toTitleCaseName(stripTag(folder.name));
    const inner = await listSharedFolder(shareUrl, folder.id, at);
    const priceFolder = inner.find((i) => /price\s*list|pricelist/i.test(i.name) && i.mimeType.includes("folder"));
    if (!priceFolder) { results.push({ folder: folder.name, projectName, sourceFile: "(no price-list subfolder)", units: [], matchedExisting: null }); continue; }
    const priceContents = await listSharedFolder(shareUrl, priceFolder.id, at);
    const priceFile = findPriceFile(priceContents);
    if (!priceFile) { results.push({ folder: folder.name, projectName, sourceFile: "(no price file inside)", units: [], matchedExisting: null }); continue; }

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
      projectName,
      sourceFile: priceFile.name,
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
};

// Writes DRAFT-only. A folder that matches an existing Development is NEVER
// touched, full stop — regardless of dev value, not just dev:"manual" (all
// 3 of Kuutio's existing rows happen to be manual today, but this guard
// doesn't rely on that staying true). A folder with zero extracted units
// writes nothing for that folder — structural, not a threshold: no result
// is not the same as "this project has no units".
export async function writeKuutioDraft(developerAccountId: string): Promise<KuutioWriteResult> {
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct) throw new Error("Developer account not found");
  const results = await previewKuutioSync(developerAccountId);

  const created: { project: string; units: number }[] = [];
  const skippedExisting: { project: string; reason: string }[] = [];
  const skippedEmpty: string[] = [];

  for (const r of results) {
    if (r.matchedExisting) {
      skippedExisting.push({ project: r.projectName, reason: `matches existing "${r.matchedExisting.publicName}" (dev:${r.matchedExisting.dev}) — never overwritten` });
      continue;
    }
    if (!r.units.length) { skippedEmpty.push(r.projectName); continue; }

    const projSlug = normKey(r.projectName) || crypto.randomUUID();
    const feedKey = `dropbox:${developerAccountId}:${projSlug}`;
    const avail = r.units.filter((u) => u.status === "available").length;
    const prices = r.units.map((u) => u.price).filter((x): x is number => typeof x === "number");

    const dev = await prisma.development.upsert({
      where: { feedKey },
      create: {
        developerAccountId, dev: "dropbox", feedProjectId: projSlug, feedKey,
        developerName: r.projectName, publicName: r.projectName, developer: acct.name,
        publishStatus: "draft", unitsTotal: r.units.length, unitsAvailable: avail,
        priceFrom: prices.length ? Math.min(...prices) : null,
        syncedAt: new Date(),
      },
      update: { unitsTotal: r.units.length, unitsAvailable: avail, syncedAt: new Date() },
    });
    await recomputeDevelopmentDistances(dev.id);

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

  return { created, skippedExisting, skippedEmpty };
}
