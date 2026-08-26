import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  openShare, listFolder, listTree, downloadFile, isFolder, isPdf, isJunkFile, nameOverlap,
  IMAGE_MIME_RE, AVAILABILITY_FOLDER_RE, PICTURES_FOLDER_RE, PLANS_FOLDER_RE,
  type ShareContext, type SharePointFile,
} from "./sharepoint";
import { extractPdfTables, mapTableColumns, unitsFromTable, type RawTable, type TableUnit } from "./ai/availabilityTable";
import { extractTextFromPdf } from "./ai/projectInfoExtract";
import { generateProjectDescription } from "./ai/projectDescription";
// One pure text→amenities helper, reused rather than re-prompted. Importing this
// ONE function is not the kind of sharing dropboxAvailabilitySync.ts's header
// warns against — that warning is about threading a second provider's client
// through another adapter's provider-specific internals, which is not happening
// here: nothing below touches Dropbox, and this call takes a plain string.
import { extractAmenitiesFromText } from "./dropboxAvailabilitySync";
import { toTitleCaseName } from "@/lib/textCase";
import { normalizeRef } from "./unitRef";
import { recomputeDevelopmentDistances } from "./developmentDistances";
import { recomputeDevelopmentDerivedState } from "./developmentDerivedState";
import { storeUploadedImage, devKeyFor, pdfPagesToJpegs, scheduleAppRestart, beginSyncWindow } from "./imageMirror";

/* Korantina Homes' SharePoint sync (2026-08-26).

   Korantina share one anonymous OneDrive folder, one subfolder per project. It is
   the same folder-is-the-source shape Kuutio (Dropbox) and Olias (Drive) already
   use, with three differences that shaped this module:

   1. THE PRICE LIST IS A PDF, NOT A SPREADSHEET. All 16 of their availability
      lists are "AL_<CODE>.pdf" — a laid-out table, no workbook anywhere in the
      tree. Reading it is ai/availabilityTable.ts's job; see that file for why unit
      VALUES are read geometrically and only the column LABELS go to a model.

   2. ONE PDF CAN HOLD SEVERAL PROJECTS. Golden View's list stacks "MAIN PHASE"
      and "PHASE 6" on one page with different columns; Hill Residences and Hill
      Panorama are two tables in one file; Royal Bay's villas and apartments are
      two tables on two pages. Sascha's rule (2026-08-26): ONE AVAILABILITY TABLE
      = ONE DEVELOPMENT. So a project here is not a folder — it is a TABLE, and a
      folder can produce more than one.

   3. IDENTITY IS NEVER AI-DERIVED, same principle as the Kuutio sync. A table's
      feedKey is built from its folder path plus its ordinal in the document, both
      of which the model never sees and cannot influence. Claude does suggest a
      display NAME for a table (there is no other way to tell Hill Residences from
      Hill Panorama — the PDF itself never names them), but that name is written
      once at creation and is not part of any key, so a re-worded suggestion on a
      later run can never split one project into two.

   Everything writes DRAFT. A table that matches an existing Development this sync
   did not create is skipped untouched, and a table that yields zero units writes
   nothing at all — "no result" is not the same as "this project has no units". */

// Same caps as the Kuutio sync: Korantina's picture folders are their own curated
// marketing set (renders and photoshoots, no site-visit snapshots), and real ones
// run well past 10 — Cap St Georges has 35 images across its phase subfolders.
const MAX_IMAGES = 40;
const MAX_PLANS = 20;

/* Root folders that are not projects. Both confirmed with Sascha on 2026-08-26
   rather than guessed:
   - "Resale Ready Properties" is six resale villas belonging to Cap St Georges and
     Soho, with no prices at all (4 SOLD, 2 RESERVED). As its own "project" it
     would render on the site as a development with nothing for sale.
   - "Unbranded brochures" is marketing collateral, no availability list.
   Matched on the normalised folder name, so a stray capital or double space in
   SharePoint does not quietly turn one of them back into a project. */
const NON_PROJECT_FOLDERS = new Set(["resale ready properties", "unbranded brochures"]);
const isNonProjectFolder = (name: string) => NON_PROJECT_FOLDERS.has(name.trim().toLowerCase().replace(/\s+/g, " "));

const slugKey = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const nn = (v: string | null | undefined) => (v && String(v).trim() ? String(v).trim() : null);

/* ── Discovery ──────────────────────────────────────────────────────────── */

export type AvailabilitySource = {
  /** Folder that OWNS the availability list — "/Gardens View Villas", "/Soho Resort/East Tower". */
  scopePath: string;
  scopeName: string;
  scopeFolderId: string;
  /** The project folder at the share root, which is where media and brochures live. */
  rootFolderName: string;
  rootFolderId: string;
  file: SharePointFile;
  filePath: string;
};

/* Finds every availability list under one root project folder.

   Searched two levels deep rather than only at the top, because Soho Resort keeps
   its two lists at "Soho Resort/East Tower/Availability" and ".../West Tower/
   Availability". The folder that CONTAINS the Availability folder becomes the
   project scope — which is what makes East and West two projects rather than one,
   without hardcoding anything about Soho. */
export function findAvailabilitySources(
  tree: { file: SharePointFile; path: string }[],
  rootFolder: SharePointFile,
): AvailabilitySource[] {
  const out: AvailabilitySource[] = [];
  const folderById = new Map(tree.filter((t) => isFolder(t.file)).map((t) => [t.file.id, t]));

  for (const entry of tree) {
    if (!isFolder(entry.file) || !AVAILABILITY_FOLDER_RE.test(entry.file.name)) continue;
    const scopePath = entry.path.slice(0, entry.path.length - entry.file.name.length - 1) || `/${rootFolder.name}`;
    const scopeName = scopePath.split("/").filter(Boolean).slice(-1)[0] || rootFolder.name;
    const scopeEntry = Array.from(folderById.values()).find((f) => f.path === scopePath);
    const files = tree.filter((t) => !isFolder(t.file) && t.path.startsWith(`${entry.path}/`) && isPdf(t.file) && !isJunkFile(t.file.name));
    for (const f of files) {
      out.push({
        scopePath,
        scopeName,
        scopeFolderId: scopeEntry?.file.id ?? rootFolder.id,
        rootFolderName: rootFolder.name,
        rootFolderId: rootFolder.id,
        file: f.file,
        filePath: f.path,
      });
    }
  }
  return out;
}

/** Display name for a table. Folder-derived first; the model's title only qualifies it. */
export function displayName(src: AvailabilitySource, title: string, tableCount: number, index: number): string {
  // "Soho Resort/East Tower" must not become just "East Tower" — the root project
  // name is the half a reader recognises.
  const base = src.scopePath.split("/").filter(Boolean).map(toTitleCaseName).join(" – ");
  if (tableCount <= 1) return base;
  const suffix = title.trim() || `Part ${index + 1}`;
  // Skip the suffix when it merely repeats what the folder already says.
  return nameOverlap(base, suffix) >= 0.9 ? base : `${base} – ${toTitleCaseName(suffix)}`;
}

/* ── Preview (read-only) ────────────────────────────────────────────────── */

export type KorantinaTableResult = {
  feedProjectId: string;
  feedKey: string;
  projectName: string;
  scopePath: string;
  scopeFolderId: string;
  rootFolderName: string;
  rootFolderId: string;
  sourceFile: string;
  page: number;
  tableIndex: number;
  tableTitle: string;
  headers: string[];
  units: TableUnit[];
  dropped: { row: string; reason: string }[];
  mappingCorrections: string[];
  matchedExisting: { id: string; publicName: string; dev: string; publishStatus: string } | null;
};

export type KorantinaPreview = {
  tables: KorantinaTableResult[];
  /** Folders with no availability list at all — reported, never silently skipped. */
  foldersWithoutList: string[];
  /** "<file> page N" entries that look like a table we could not read. */
  unreadablePages: string[];
  skippedFolders: string[];
};

export async function previewKorantinaSync(developerAccountId: string): Promise<KorantinaPreview> {
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct?.driveFolderUrl) throw new Error("Developer account or its SharePoint link not found");
  const ctx = await openShare(acct.driveFolderUrl);

  const root = await listFolder(ctx, ctx.rootId);
  const projectFolders = root.filter(isFolder);
  if (!projectFolders.length) throw new Error("No project folders found at the shared link's root");

  const existing = await prisma.development.findMany({
    where: { developerAccountId },
    select: { id: true, publicName: true, dev: true, publishStatus: true, feedKey: true },
  });
  const byFeedKey = new Map(existing.map((e) => [e.feedKey, e]));

  const tables: KorantinaTableResult[] = [];
  const foldersWithoutList: string[] = [];
  const unreadablePages: string[] = [];
  const skippedFolders: string[] = [];

  for (const folder of projectFolders) {
    if (isNonProjectFolder(folder.name)) { skippedFolders.push(folder.name); continue; }

    const tree = await listTree(ctx, folder.id, { basePath: `/${folder.name}`, maxDepth: 3 });
    const sources = findAvailabilitySources(tree, folder);
    if (!sources.length) { foldersWithoutList.push(folder.name); continue; }

    for (const src of sources) {
      const buf = await downloadFile(ctx, src.file.id);
      const { tables: rawTables, unparsedPages } = await extractPdfTables(buf);
      for (const p of unparsedPages) unreadablePages.push(`${src.filePath} page ${p}`);
      if (!rawTables.length) { foldersWithoutList.push(`${src.filePath} (no readable table)`); continue; }

      for (const raw of rawTables) {
        const context = `Developer: Korantina Homes. Folder: "${src.scopePath}". File: "${src.file.name}". Page ${raw.page}, table ${raw.index + 1} of ${rawTables.length}.`;
        const mapping = await mapTableColumns(raw, context);
        const { units, dropped } = unitsFromTable(raw, mapping);

        // Ordinal ALWAYS included, even for a single-table document: keying it
        // conditionally would rewrite the feedKey of all 13 single-table projects
        // the first time Korantina adds a second table to one of their lists.
        const feedProjectId = `${slugKey(src.scopePath)}-t${raw.index}`;
        const feedKey = `sharepoint:${developerAccountId}:${feedProjectId}`;
        const matched = byFeedKey.get(feedKey) ?? null;

        tables.push({
          feedProjectId,
          feedKey,
          projectName: displayName(src, mapping.title, rawTables.length, raw.index),
          scopePath: src.scopePath,
          scopeFolderId: src.scopeFolderId,
          rootFolderName: src.rootFolderName,
          rootFolderId: src.rootFolderId,
          sourceFile: src.filePath,
          page: raw.page,
          tableIndex: raw.index,
          tableTitle: mapping.title,
          headers: raw.headers,
          units,
          dropped,
          mappingCorrections: mapping.corrections,
          matchedExisting: matched ? { id: matched.id, publicName: matched.publicName, dev: matched.dev, publishStatus: matched.publishStatus } : null,
        });
      }
    }
  }

  return { tables, foldersWithoutList, unreadablePages, skippedFolders };
}

/* ── Dry run (read-only, diffed against the database) ───────────────────── */

export type KorantinaDryRunProject = {
  project: string;
  feedKey: string;
  sourceFile: string;
  table: string;
  matched: { publicName: string; dev: string; publishStatus: string } | null;
  wouldDo: "create" | "update" | "skip (foreign row — never overwritten)" | "skip (no units extracted)";
  sharepoint: { units: number; available: number; reserved: number; sold: number; priceFrom: number | null };
  db: { units: number; available: number } | null;
  diff: {
    onlyInSharePoint: { ref: string; status: string; price: number | null }[];
    onlyInDb: { ref: string; status: string; price: number | null }[];
    statusChanged: { ref: string; db: string; sharepoint: string }[];
    priceChanged: { ref: string; db: number | null; sharepoint: number | null }[];
  };
  droppedRows: { row: string; reason: string }[];
  mappingCorrections: string[];
};

/* Read-only answer to "does SharePoint still agree with what we publish?", and the
   thing to run before EVERY first import and after any change to Korantina's
   templates. Reads and AI-extracts everything a real sync would; writes nothing —
   no upsert, no image mirroring, no driveSyncedAt, no restart. As expensive as a
   real sync, so it is a deliberate call, never a schedule. */
export async function dryRunKorantinaSync(developerAccountId: string): Promise<{ projects: KorantinaDryRunProject[]; notes: string[]; summary: string }> {
  const preview = await previewKorantinaSync(developerAccountId);
  const out: KorantinaDryRunProject[] = [];

  for (const t of preview.tables) {
    const units = t.units.filter((u) => u.ref.trim());
    const prices = units.map((u) => u.price).filter((p): p is number => typeof p === "number");
    const foreign = !!t.matchedExisting && t.matchedExisting.dev !== "sharepoint";

    // Same precedence writeKorantinaDraft applies, restated in the same order so
    // the two can be compared line by line: foreign match wins over emptiness.
    const wouldDo: KorantinaDryRunProject["wouldDo"] = foreign
      ? "skip (foreign row — never overwritten)"
      : !units.length
        ? "skip (no units extracted)"
        : t.matchedExisting ? "update" : "create";

    const dbUnits = t.matchedExisting
      ? await prisma.developmentUnit.findMany({ where: { developmentId: t.matchedExisting.id }, select: { ref: true, feedRef: true, status: true, price: true, source: true } })
      : [];
    const key = (r: string) => normalizeRef(r, t.projectName);
    const dbByRef = new Map(dbUnits.filter((u) => u.feedRef || u.ref).map((u) => [key((u.feedRef || u.ref)!), u]));
    const spByRef = new Map(units.map((u) => [key(u.ref), u]));

    const onlyInSharePoint = units.filter((u) => !dbByRef.has(key(u.ref))).map((u) => ({ ref: u.ref, status: u.status, price: u.price }));
    const onlyInDb = dbUnits
      .filter((u) => { const k = u.feedRef || u.ref; return !k || !spByRef.has(key(k)); })
      .map((u) => ({ ref: u.feedRef || u.ref || "(no ref)", status: u.status ?? "?", price: u.price }));
    const statusChanged: KorantinaDryRunProject["diff"]["statusChanged"] = [];
    const priceChanged: KorantinaDryRunProject["diff"]["priceChanged"] = [];
    for (const u of units) {
      const db = dbByRef.get(key(u.ref));
      if (!db) continue;
      if ((db.status ?? "") !== u.status) statusChanged.push({ ref: u.ref, db: db.status ?? "?", sharepoint: u.status });
      if ((db.price ?? null) !== (u.price ?? null)) priceChanged.push({ ref: u.ref, db: db.price ?? null, sharepoint: u.price ?? null });
    }

    out.push({
      project: t.projectName,
      feedKey: t.feedKey,
      sourceFile: t.sourceFile,
      table: `page ${t.page}, table ${t.tableIndex + 1}${t.tableTitle ? ` ("${t.tableTitle}")` : ""}`,
      matched: t.matchedExisting ? { publicName: t.matchedExisting.publicName, dev: t.matchedExisting.dev, publishStatus: t.matchedExisting.publishStatus } : null,
      wouldDo,
      sharepoint: {
        units: units.length,
        available: units.filter((u) => u.status === "available").length,
        reserved: units.filter((u) => u.status === "reserved").length,
        sold: units.filter((u) => u.status === "sold").length,
        priceFrom: prices.length ? Math.min(...prices) : null,
      },
      db: t.matchedExisting ? { units: dbUnits.length, available: dbUnits.filter((u) => u.status === "available").length } : null,
      diff: { onlyInSharePoint, onlyInDb, statusChanged, priceChanged },
      droppedRows: t.dropped,
      mappingCorrections: t.mappingCorrections,
    });
  }

  const notes = [
    ...preview.skippedFolders.map((f) => `Skipped (not a project): ${f}`),
    ...preview.foldersWithoutList.map((f) => `No availability list: ${f}`),
    ...preview.unreadablePages.map((p) => `Page looks like a table but could not be read: ${p}`),
  ];
  const totalUnits = out.reduce((n, p) => n + p.sharepoint.units, 0);
  const totalDropped = out.reduce((n, p) => n + p.droppedRows.length, 0);
  const summary = `${out.length} tables, ${totalUnits} units (${out.filter((p) => p.wouldDo === "create").length} would be created, ${out.filter((p) => p.wouldDo === "update").length} updated, ${out.filter((p) => p.wouldDo.startsWith("skip")).length} skipped), ${totalDropped} rows dropped, ${notes.length} notes`;
  return { projects: out, notes, summary };
}

/* ── Media assignment ───────────────────────────────────────────────────── */

export type MediaUnit = {
  id: string;
  /** Full path in the share tree. */
  path: string;
  /** The folder's own name — what the assignment is scored against. */
  name: string;
  kind: "pictures" | "plans";
};

/* Which folders can supply media to ONE table.

   Two rules, both driven by real folder layouts in this tree rather than by
   guesswork:

   OWNERSHIP. A table takes media from its own scope first ("Soho Resort/East
   Tower/Plans"), plus any media folder that is a DIRECT child of the root project
   folder ("Soho Resort/Pictures and Videos" — shared marketing renders for the
   whole resort). It never reaches into a SIBLING scope: without that restriction,
   Soho East Tower would pull in "Soho Resort/West Tower/Pictures" and "Soho
   Resort/Soho Villas/Pictures" — the villas being a part of the resort that has no
   availability list at all and is therefore not a project here.

   GRANULARITY. When one scope produced several tables, each media folder is also
   expanded into its immediate subfolders, because that is exactly where these
   developers put the split: "Plans/Phase 1 (Hill Residences)" vs "Plans/Phase 2
   (Hill Panorama)", "Pictures/Villas" vs "Pictures/Apartments", "Plans/Plans Phase
   6". Without the expansion, Hill Panorama would get no floor plans and Golden
   View's Phase 6 plans would land in BOTH of its projects. */
export function mediaUnitsFor(
  tree: { file: SharePointFile; path: string }[],
  rootPath: string,
  scopePath: string,
  otherScopePaths: string[],
  expand: boolean,
): MediaUnit[] {
  const isUnder = (p: string, parent: string) => p === parent || p.startsWith(`${parent}/`);
  const kindOf = (name: string): MediaUnit["kind"] | null =>
    PICTURES_FOLDER_RE.test(name) ? "pictures" : PLANS_FOLDER_RE.test(name) ? "plans" : null;

  const roots = tree.filter((t) => {
    if (!isFolder(t.file) || !kindOf(t.file.name)) return false;
    const mine = isUnder(t.path, scopePath);
    const sharedAtRoot = t.path === `${rootPath}/${t.file.name}`;
    const inSibling = otherScopePaths.some((sp) => sp !== scopePath && isUnder(t.path, sp));
    return (mine || sharedAtRoot) && !inSibling;
  });

  const units: MediaUnit[] = [];
  const seen = new Set<string>();
  for (const r of roots) {
    const kind = kindOf(r.file.name)!;
    // Skip a folder already covered as a subfolder of another matched folder
    // (Golden View has both "Plans" and "Plans/Plans Phase 6").
    if (!seen.has(r.path)) { units.push({ id: r.file.id, path: r.path, name: r.file.name, kind }); seen.add(r.path); }
    if (!expand) continue;
    for (const child of tree) {
      if (!isFolder(child.file)) continue;
      if (child.path !== `${r.path}/${child.file.name}`) continue; // immediate children only
      if (seen.has(child.path)) continue;
      units.push({ id: child.file.id, path: child.path, name: child.file.name, kind });
      seen.add(child.path);
    }
  }
  return units;
}

/* Assigns each media unit to one table, by name overlap against the table TITLES —
   the short distinguishing label ("Villas", "Apartments", "Phase 6", "Hill
   Panorama"), not the full display name, because a folder called "Villas" shares
   only one word with "Royal Bay Resort – Villas" and would score below any useful
   threshold.

   A subfolder INHERITS its parent's assignment unless its own name makes a clear
   case of its own. That inheritance is not a nicety: Hill Panorama's photos live in
   "Pictures Hill Panorama/EXT", "/INT" and six "PIC_HP_V*_3D" folders, and scoring
   each of those names on its own gives zero for both tables — so all 44 of Hill
   Panorama's photos landed in Hill Residences until this existed. Royal Bay is the
   other half of the same test: its "Pictures/Apartments" folder DOES name itself,
   and still wins over its parent's assignment.

   A unit that matches nothing and has no assigned parent falls to the FIRST table,
   so an ambiguous folder is never dropped. */
export function assignMediaUnits(units: MediaUnit[], tableTitles: string[]): number[] {
  const out: number[] = [];
  units.forEach((u, i) => {
    if (tableTitles.length <= 1) { out[i] = 0; return; }
    const scores = tableTitles.map((t) => (t.trim() ? nameOverlap(u.name, t) : 0));
    const best = Math.max(...scores);
    if (best >= 0.34 && scores.filter((sc) => sc === best).length === 1) { out[i] = scores.indexOf(best); return; }
    // Deepest already-assigned ancestor wins; units are emitted parent-before-child
    // by mediaUnitsFor, so the ancestor's own answer is already settled here.
    let inherited = 0, depth = -1;
    units.forEach((other, j) => {
      if (j >= i || !u.path.startsWith(`${other.path}/`)) return;
      const d = other.path.split("/").length;
      if (d > depth) { depth = d; inherited = out[j]; }
    });
    out[i] = inherited;
  });
  return out;
}

/* Folders whose photos are documentation rather than marketing. They are still
   imported — an admin may well want them — but they go to the BACK of the queue,
   because MAX_IMAGES cuts the list and these folders are big: Royal Bay's
   "Construction Progress June 2025" alone holds 34 photos and would have consumed
   most of that project's 40-image budget ahead of its own villa renders. */
const LOW_PRIORITY_MEDIA_RE = /construction|progress|site\s*visit|old\b/i;

/** Marketing folders first, documentation folders last; stable within each group. */
export function orderMediaUnits(units: MediaUnit[]): MediaUnit[] {
  return units
    .map((u, i) => ({ u, i, low: LOW_PRIORITY_MEDIA_RE.test(u.path) ? 1 : 0 }))
    .sort((a, b) => a.low - b.low || a.i - b.i)
    .map((x) => x.u);
}

/* Files belonging to one media unit. A file inside a deeper unit belongs to THAT
   unit, not to its parent — otherwise every Phase 6 plan would be collected twice,
   once for Golden View's Phase 6 and again for its Main Phase via the parent
   "Plans" folder. */
export function filesForUnit(
  tree: { file: SharePointFile; path: string }[],
  unit: MediaUnit,
  allUnits: MediaUnit[],
): { file: SharePointFile; path: string }[] {
  const deeper = allUnits.filter((u) => u.path !== unit.path && u.path.startsWith(`${unit.path}/`));
  return tree.filter((t) =>
    !isFolder(t.file) &&
    t.path.startsWith(`${unit.path}/`) &&
    !isJunkFile(t.file.name) &&
    !deeper.some((d) => t.path.startsWith(`${d.path}/`)),
  );
}

/* ── Write ──────────────────────────────────────────────────────────────── */

export type KorantinaWriteResult = {
  created: { project: string; units: number }[];
  updated: { project: string; units: number }[];
  skippedExisting: { project: string; reason: string }[];
  skippedEmpty: string[];
  notes: string[];
  notDue?: string;
};

// Same vocabulary as every other adapter's per-developer interval (the admin
// panel's dropdown writes DeveloperAccount.driveSyncInterval regardless of
// provider). Re-stated rather than imported for the same reason the Kuutio sync
// re-states it: one four-branch map is not worth coupling two adapters.
const intervalMs = (i: string | null | undefined) =>
  i === "off" ? Infinity : i === "weekly" ? 7 * 864e5 : i === "2day" ? 2 * 864e5 : 864e5;

export async function writeKorantinaDraft(
  developerAccountId: string,
  opts: { force?: boolean; respectInterval?: boolean } = {},
): Promise<KorantinaWriteResult> {
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct?.driveFolderUrl) throw new Error("Developer account or its SharePoint link not found");

  // Checked BEFORE the sync window and before the first SharePoint call: a run
  // that isn't due must cost nothing and must not hold the window (which defers
  // unrelated app restarts) for even a moment. Only the scheduled caller passes
  // respectInterval — a human pressing the button has already decided.
  if (opts.respectInterval && !opts.force) {
    const iv = intervalMs(acct.driveSyncInterval);
    const last = acct.driveSyncedAt ? new Date(acct.driveSyncedAt).getTime() : null;
    if (iv === Infinity || (last !== null && Date.now() - last < iv)) {
      return {
        created: [], updated: [], skippedExisting: [], skippedEmpty: [], notes: [],
        notDue: iv === Infinity
          ? "Interval is off — scheduled run skipped."
          : `Not due yet (${acct.driveSyncInterval ?? "daily"}, last synced ${new Date(last!).toISOString()}).`,
      };
    }
  }

  const releaseSyncWindow = beginSyncWindow("sharepoint:korantina");
  try {
    const ctx = await openShare(acct.driveFolderUrl);
    const preview = await previewKorantinaSync(developerAccountId);

    const created: { project: string; units: number }[] = [];
    const updated: { project: string; units: number }[] = [];
    const skippedExisting: { project: string; reason: string }[] = [];
    const skippedEmpty: string[] = [];
    let mediaChanged = false;
    const unlistedNotes: string[] = [];

    // Group by root folder so each folder's tree is listed once, and so the media
    // split (below) can see all of that folder's tables at the same time.
    const byRootFolder = new Map<string, KorantinaTableResult[]>();
    for (const t of preview.tables) {
      const list = byRootFolder.get(t.rootFolderId) ?? [];
      list.push(t);
      byRootFolder.set(t.rootFolderId, list);
    }

    for (const [rootFolderId, group] of Array.from(byRootFolder.entries())) {
      // Listed once per root folder and reused by every table it produced — a
      // whole-tree walk is ~30 SharePoint calls for a folder like Cap St Georges.
      let tree: { file: SharePointFile; path: string }[] | null = null;

      for (const t of group) {
        /* "Never touch" applies to a match against a FOREIGN row — anything not
           dev:"sharepoint". A match against our OWN previously-created row is the
           normal re-sync case: treating that as foreign would permanently freeze
           every Korantina project after its first sync. */
        if (t.matchedExisting && t.matchedExisting.dev !== "sharepoint") {
          skippedExisting.push({ project: t.projectName, reason: `matches existing "${t.matchedExisting.publicName}" (dev:${t.matchedExisting.dev}) — never overwritten` });
          continue;
        }
        const units = t.units.filter((u) => u.ref.trim());
        if (!units.length) { skippedEmpty.push(t.projectName); continue; }

        const avail = units.filter((u) => u.status === "available").length;
        const prices = units.map((u) => u.price).filter((p): p is number => typeof p === "number");

        const existingRow = await prisma.development.findUnique({ where: { feedKey: t.feedKey }, select: { id: true, gallery: true, publishStatus: true } });
        // "Needs content gathering", not "row does not exist": a project created by
        // an earlier units-only run must still get its gallery. An empty gallery is
        // the right proxy — once a project has real photos this run is done with it,
        // matching "published = frozen" for every other developer.
        const published = existingRow?.publishStatus === "published";
        const needsContent = !published && (opts.force || !existingRow || !(existingRow.gallery as string[] | null)?.length);

        let gallery: string[] = [];
        let plans: string[] = [];
        let amenities: string[] = [];
        let sourceText = "";

        if (needsContent) {
          if (!tree) tree = await listTree(ctx, rootFolderId, { basePath: `/${t.rootFolderName}`, maxDepth: 4 });

          // Sibling tables of the SAME scope share its media and split it by title;
          // tables in a different scope (Soho's other tower) are walled off by
          // mediaUnitsFor's ownership rule.
          const siblings = group.filter((g) => g.scopePath === t.scopePath);
          const otherScopes = Array.from(new Set(group.map((g) => g.scopePath)));
          const units_ = mediaUnitsFor(tree, `/${t.rootFolderName}`, t.scopePath, otherScopes, siblings.length > 1);
          const titles = siblings.map((g) => g.tableTitle);
          const assignment = assignMediaUnits(units_, titles);
          const myIndex = siblings.indexOf(t);
          const mine = units_.filter((_, i) => assignment[i] === myIndex);

          const devKey = devKeyFor(t.feedKey);
          const photoFiles = orderMediaUnits(mine)
            .filter((u) => u.kind === "pictures")
            .flatMap((u) => filesForUnit(tree!, u, units_))
            .filter((f) => IMAGE_MIME_RE.test(f.file.mimeType))
            .slice(0, MAX_IMAGES);
          for (const p of photoFiles) {
            try {
              const url = await storeUploadedImage(await downloadFile(ctx, p.file.id), devKey);
              if (url) { gallery.push(url); mediaChanged = true; }
            } catch { /* one photo failing must not abort the project */ }
          }

          const planFiles = orderMediaUnits(mine)
            .filter((u) => u.kind === "plans")
            .flatMap((u) => filesForUnit(tree!, u, units_))
            .filter((f) => IMAGE_MIME_RE.test(f.file.mimeType) || isPdf(f.file))
            .slice(0, MAX_PLANS);
          for (const pf of planFiles) {
            try {
              const buf = await downloadFile(ctx, pf.file.id);
              if (isPdf(pf.file)) {
                for (const page of await pdfPagesToJpegs(buf)) {
                  const url = await storeUploadedImage(page, devKey);
                  if (url) { plans.push(url); mediaChanged = true; }
                }
              } else {
                const url = await storeUploadedImage(buf, devKey);
                if (url) { plans.push(url); mediaChanged = true; }
              }
            } catch { /* skip one plan */ }
          }

          // Marketing copy comes from the project's own brochures — the only place
          // in this tree that has any prose at all (the availability lists are pure
          // tables). Capped at two files: brochures here run to 14 MB and every one
          // of them is read by a model.
          const brochures = tree
            .filter((f) => !isFolder(f.file) && isPdf(f.file) && /brochure|portfolio/i.test(f.path))
            .slice(0, 2);
          for (const b of brochures) {
            try { sourceText += `\n${await extractTextFromPdf((await downloadFile(ctx, b.file.id)).toString("base64"))}`; }
            catch { /* a brochure we cannot read is not a reason to fail the project */ }
          }
          sourceText = sourceText.trim();
          if (sourceText) amenities = await extractAmenitiesFromText(sourceText).catch(() => []);
        }

        const description = needsContent && sourceText
          ? await generateProjectDescription({
              district: "", town: "", area: "",
              projectAmenities: amenities, unitAmenities: [],
              unitSummary: `${units.length} units, ${avail} available`,
              sourceText, words: 120,
            }).catch(() => null)
          : null;

        const dev = await prisma.development.upsert({
          where: { feedKey: t.feedKey },
          create: {
            developerAccountId, dev: "sharepoint", feedProjectId: t.feedProjectId, feedKey: t.feedKey,
            developerName: t.projectName, publicName: t.projectName, developer: acct.name,
            publishStatus: "draft",
            unitsTotal: units.length, unitsAvailable: avail,
            priceFrom: prices.length ? Math.min(...prices) : null,
            priceTo: prices.length ? Math.max(...prices) : null,
            syncedAt: new Date(),
            ...(amenities.length ? { amenities } : {}),
            ...(gallery.length ? { gallery } : {}),
            ...(plans.length ? { plans } : {}),
          },
          update: {
            // publicName is deliberately NOT updated: it is partly model-suggested
            // for multi-table documents, and an admin may have renamed it. Units,
            // prices and counts are what a re-sync is for.
            unitsTotal: units.length, unitsAvailable: avail,
            priceFrom: prices.length ? Math.min(...prices) : null,
            priceTo: prices.length ? Math.max(...prices) : null,
            syncedAt: new Date(),
            ...(amenities.length ? { amenities } : {}),
            ...(gallery.length ? { gallery } : {}),
            ...(plans.length ? { plans } : {}),
          },
        });
        await recomputeDevelopmentDistances(dev.id);

        if (description) {
          await prisma.developmentOverride.upsert({
            where: { developmentId: dev.id },
            create: { developmentId: dev.id, descriptionEN: description.en, descriptionDE: description.de, descriptionPL: description.pl, descriptionRU: description.ru },
            update: { descriptionEN: description.en, descriptionDE: description.de, descriptionPL: description.pl, descriptionRU: description.ru },
          });
        }

        const existingUnits = await prisma.developmentUnit.findMany({
          where: { developmentId: dev.id },
          select: { id: true, ref: true, feedRef: true, source: true, status: true, label: true, name: true },
        });
        /* Matched on feedRef — the developer's own reference — NOT on `ref`, which
           is the admin-editable display value (FEED-ADAPTER-GUIDE.md §4, a class of
           bug repaired three times on Cirvis). `ref` falls back as the key only for
           rows written before feedRef was populated. */
        const matchKey = (u: { feedRef?: string | null; ref?: string | null }) =>
          normalizeRef((u.feedRef || u.ref || "").toString(), t.projectName);
        const existingByKey = new Map(
          existingUnits.filter((u) => u.feedRef || u.ref).map((u) => [matchKey(u), u]),
        );
        const touchedIds = new Set<string>();

        for (let i = 0; i < units.length; i++) {
          const u = units[i];
          // Everything a re-sync is allowed to refresh. `ref` and `label` are
          // deliberately absent: they belong to the admin once the row exists.
          const syncedFields = {
            feedRef: u.ref,
            type: nn(u.type),
            price: typeof u.price === "number" ? Math.round(u.price) : null,
            status: u.status,
            beds: nn(u.beds),
            baths: nn(u.baths),
            areaBuilt: nn(u.areaBuilt),
            areaInternal: nn(u.areaInternal),
            areaPlot: nn(u.areaPlot),
            areaVeranda: nn(u.areaVeranda),
            areaVerandaOpen: nn(u.areaVerandaOpen),
            floor: nn(u.floor),
            attrs: u.attrs.length ? u.attrs : undefined,
            sortIndex: i,
          };
          const existingUnit = existingByKey.get(normalizeRef(u.ref, t.projectName));
          if (existingUnit) {
            touchedIds.add(existingUnit.id);
            await prisma.developmentUnit.update({ where: { id: existingUnit.id }, data: syncedFields });
          } else {
            const createdUnit = await prisma.developmentUnit.create({
              data: { developmentId: dev.id, ref: u.ref, label: u.label, ...syncedFields },
            });
            touchedIds.add(createdUnit.id);
          }
        }
        await recomputeDevelopmentDerivedState(dev.id);

        /* A unit that is no longer in the PDF flips to "unlisted" — it is NOT
           deleted and NOT marked sold. That is FEED-ADAPTER-GUIDE.md §4's rule and
           it matters more here than for an XML feed: "missing from the list" and
           "the table read badly this once" look identical, and this source is a
           laid-out PDF that Korantina re-export by hand. An unlisted row keeps its
           history, drops off every public surface (see isListedUnit in
           developmentAvailability.ts), and silently comes back if the next list
           has it again.

           Three rows are never touched: source:"manual" (hand-entered), already
           "sold" (disappearing after a sale is normal and it should keep saying
           sold), and already "unlisted" (so the note below reports a real change
           rather than repeating itself every week). */
        const vanished = existingUnits.filter((eu) =>
          eu.source !== "manual" && !touchedIds.has(eu.id) && eu.status !== "sold" && eu.status !== "unlisted");
        if (vanished.length) {
          await prisma.developmentUnit.updateMany({ where: { id: { in: vanished.map((u) => u.id) } }, data: { status: "unlisted" } });
          await recomputeDevelopmentDerivedState(dev.id);
          unlistedNotes.push(`${t.projectName}: ${vanished.length} unit(s) no longer in the list → unlisted (${vanished.slice(0, 5).map((u) => u.ref || u.label || u.name || u.id).join(", ")})`);
        }

        (existingRow ? updated : created).push({ project: t.projectName, units: units.length });
      }
    }

    if (mediaChanged) scheduleAppRestart();
    await prisma.developerAccount.update({ where: { id: developerAccountId }, data: { driveSyncedAt: new Date() } });

    const notes = [
      ...preview.skippedFolders.map((f) => `Skipped (not a project): ${f}`),
      ...preview.foldersWithoutList.map((f) => `No availability list: ${f}`),
      ...preview.unreadablePages.map((p) => `Page looks like a table but could not be read: ${p}`),
      ...preview.tables.filter((t) => t.dropped.length).map((t) => `${t.projectName}: ${t.dropped.length} row(s) not imported (${t.dropped.slice(0, 3).map((d) => d.reason).join("; ")})`),
      ...preview.tables.filter((t) => t.mappingCorrections.length).map((t) => `${t.projectName}: column mapping corrected — ${t.mappingCorrections.join("; ")}`),
      ...unlistedNotes,
    ];
    return { created, updated, skippedExisting, skippedEmpty, notes };
  } finally {
    releaseSyncWindow();
  }
}

/** Stable id for logging a run without exposing the share link. */
export const shareFingerprint = (url: string) => crypto.createHash("sha256").update(url).digest("hex").slice(0, 12);
