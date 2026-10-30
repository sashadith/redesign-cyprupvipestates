import { prisma } from "@/lib/prisma";
import { dropboxConfigured, getDropboxAccessToken, listSharedFolder, downloadSharedFile, isDropboxShareUrl, type DropboxFile } from "./dropbox";
import { readPdfPages, tablesFromPages, mapTableColumns, unitsFromTable, type TableUnit } from "./ai/availabilityTable";
import { findStylianidesPriceList, normalizeStylianidesTable, stylianidesMappingContext, fixStylianidesMapping, refineStylianidesUnits, mergeTableUnits, refDrift } from "./stylianides";
import { normalizeRef } from "./unitRef";
import { recomputeDevelopmentDerivedState } from "./developmentDerivedState";
import { beginSyncWindow } from "./imageMirror";

/* Stylianides Group — price-list sync (2026-10-30). The pure rules are in
   stylianides.ts; this file is the Dropbox + database half.

   ONE PROJECT = ONE DROPBOX LINK. Stylianides have no shared parent folder, so
   there is nothing to discover: a project exists because someone created its
   Development (dev "stylianides", scripts/stylianides-setup.mjs) and put the
   project's own share link into Development.driveFolderId. That column is the
   Drive SUBFOLDER id for Drive developers; for this one it holds the link,
   which is why the link is never in the repo and why the account itself has no
   driveFolderUrl (drive-sync and the Kuutio route therefore never see it).

   UNITS ONLY. Gallery, plans, facts and texts are set up once by hand and are
   content (frozen once published); this sync refreshes what the price list is
   authoritative for — status, price, the unit's own figures — and nothing else.
   It never writes a description: the operator's texts are written by a person.

   WHAT IT WILL NOT DO:
   - write anything for a project whose list produced no units, or whose
     references drifted (refDrift) — "no result" is not "everything sold";
   - delete or sell a unit that is missing from the list: it becomes
     "unlisted" (FEED-ADAPTER-GUIDE §4) and comes back if the list has it again;
     an already sold one stays sold;
   - touch a source:"manual" unit;
   - re-read an unchanged file: each price list's path and modified time is
     remembered in DeveloperAccount.driveFileModified (same column and meaning
     as the Drive sync's), so a daily run costs one folder listing per project
     and calls the column mapper only when Stylianides upload a new list. */

export const STYLIANIDES_DEV = "stylianides";

const intervalMs = (i: string | null | undefined) =>
  i === "off" ? Infinity : i === "weekly" ? 7 * 864e5 : i === "2day" ? 2 * 864e5 : 864e5;
const nn = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

type ProjectRow = { id: string; publicName: string; driveFolderId: string | null; publishStatus: string };

export type StylianidesProjectResult = {
  project: string;
  developmentId: string;
  file?: string;
  outcome: "written" | "unchanged" | "refused" | "dry-run";
  units?: number;
  available?: number;
  changes?: string[];
  issues: string[];
};

export type StylianidesSyncResult = {
  ok: boolean;
  message: string;
  notDue?: string;
  projects: StylianidesProjectResult[];
};

// Keyed by the Development as well: two projects' folders can hold files with
// the same name, and their signatures must never satisfy each other.
const sigOf = (developmentId: string, f: DropboxFile) => `${developmentId}:${f.id}:${f.modifiedTime}`;

/** Reads one price list into units. Throws only on transport errors. */
async function readPriceList(p: ProjectRow, file: DropboxFile, token: string) {
  const issues: string[] = [];
  const pages = await readPdfPages(await downloadSharedFile(p.driveFolderId!, file.id, token));
  const { tables, unparsedPages } = tablesFromPages(pages);
  if (unparsedPages.length) issues.push(`page(s) ${unparsedPages.join(", ")} look like content but held no readable table`);

  const perTable: TableUnit[][] = [];
  for (const raw of tables) {
    const t = normalizeStylianidesTable(raw);
    const mapping = fixStylianidesMapping(await mapTableColumns(t, stylianidesMappingContext(p.publicName)), t.headers);
    if (mapping.corrections.length) issues.push(`table ${t.index + 1}: column mapping corrected — ${mapping.corrections.join("; ")}`);
    const ext = unitsFromTable(t, mapping);
    for (const d of ext.dropped) issues.push(`table ${t.index + 1}: row not imported (${d.reason}): ${d.row}`);
    perTable.push(ext.units);
  }
  const merged = mergeTableUnits(perTable, p.publicName);
  if (merged.duplicates.length) issues.push(`reference(s) listed twice, first row kept: ${merged.duplicates.join(", ")}`);
  return { units: refineStylianidesUnits(merged.units), issues };
}

function unitData(u: TableUnit, i: number) {
  return {
    feedRef: u.ref,
    type: nn(u.type),
    price: typeof u.price === "number" ? Math.round(u.price) : null,
    status: u.status,
    beds: nn(u.beds),
    baths: nn(u.baths),
    floor: nn(u.floor),
    areaInternal: nn(u.areaInternal),
    areaBuilt: nn(u.areaBuilt),
    areaPlot: nn(u.areaPlot),
    areaVeranda: nn(u.areaVeranda),
    areaVerandaOpen: nn(u.areaVerandaOpen),
    attrs: u.attrs.length ? u.attrs : undefined,
    sortIndex: i,
  };
}

const SHOWN: (keyof ReturnType<typeof unitData>)[] = ["status", "price", "type", "beds", "baths", "floor", "areaInternal", "areaBuilt", "areaPlot", "areaVeranda", "areaVerandaOpen"];

export async function syncStylianides(
  developerAccountId: string,
  opts: { force?: boolean; respectInterval?: boolean; dryRun?: boolean; onlyDevelopmentId?: string } = {},
): Promise<StylianidesSyncResult> {
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct) throw new Error("Stylianides developer account not found");
  if (!dropboxConfigured()) throw new Error("Dropbox is not configured (DROPBOX_APP_KEY / DROPBOX_APP_SECRET / DROPBOX_REFRESH_TOKEN)");

  // Checked before the first Dropbox call: a run that isn't due costs nothing.
  if (opts.respectInterval && !opts.force && !opts.dryRun) {
    const iv = intervalMs(acct.driveSyncInterval);
    const last = acct.driveSyncedAt ? acct.driveSyncedAt.getTime() : null;
    if (iv === Infinity || (last !== null && Date.now() - last < iv)) {
      const notDue = iv === Infinity ? "Interval is off — scheduled run skipped." : `Not due yet (${acct.driveSyncInterval ?? "daily"}, last synced ${new Date(last!).toISOString()}).`;
      return { ok: true, message: notDue, notDue, projects: [] };
    }
  }

  const rows: ProjectRow[] = await prisma.development.findMany({
    where: { developerAccountId, dev: STYLIANIDES_DEV, publishStatus: { not: "archived" }, ...(opts.onlyDevelopmentId ? { id: opts.onlyDevelopmentId } : {}) },
    select: { id: true, publicName: true, driveFolderId: true, publishStatus: true },
    orderBy: { publicName: "asc" },
  });

  const prevSigs = new Set((acct.driveFileModified ?? "").split("|").filter(Boolean));
  const nextSigs: string[] = [];
  const results: StylianidesProjectResult[] = [];
  const release = opts.dryRun ? () => {} : beginSyncWindow("dropbox:stylianides");
  try {
    const token = await getDropboxAccessToken();
    for (const p of rows) {
      const r: StylianidesProjectResult = { project: p.publicName, developmentId: p.id, outcome: "refused", issues: [] };
      results.push(r);
      if (!isDropboxShareUrl(p.driveFolderId)) { r.issues.push("no Dropbox link on this project (driveFolderId)"); continue; }

      let file: DropboxFile | null;
      try { file = findStylianidesPriceList(await listSharedFolder(p.driveFolderId!, "", token)); }
      catch (e) { r.issues.push(`could not list the folder: ${e instanceof Error ? e.message : String(e)}`); continue; }
      if (!file) { r.issues.push("no price list PDF at the folder root"); continue; }
      r.file = file.name;
      const sig = sigOf(p.id, file);
      // Checked before the download: an unchanged list costs one listing, no model call.
      if (!opts.force && !opts.dryRun && prevSigs.has(sig)) { r.outcome = "unchanged"; nextSigs.push(sig); continue; }

      let read: Awaited<ReturnType<typeof readPriceList>>;
      try { read = await readPriceList(p, file, token); }
      catch (e) { r.issues.push(`could not read ${file.name}: ${e instanceof Error ? e.message : String(e)}`); continue; }
      r.issues.push(...read.issues);
      if (!read.units.length) { r.issues.push("the price list produced no units — nothing written"); continue; }

      const existing = await prisma.developmentUnit.findMany({
        where: { developmentId: p.id },
        select: { id: true, ref: true, feedRef: true, source: true, status: true, type: true, price: true, beds: true, baths: true, floor: true, areaInternal: true, areaBuilt: true, areaPlot: true, areaVeranda: true, areaVerandaOpen: true },
      });
      const key = (u: { feedRef?: string | null; ref?: string | null }) => normalizeRef((u.feedRef || u.ref || "").toString(), p.publicName);
      const listedRefs = existing.filter((u) => u.source !== "manual" && u.status !== "unlisted").map((u) => u.feedRef || u.ref || "");
      const drift = refDrift(listedRefs, read.units.map((u) => u.ref), p.publicName);
      if (drift) { r.issues.push(drift); continue; }

      const byKey = new Map(existing.filter((u) => u.feedRef || u.ref).map((u) => [key(u), u]));
      const touched = new Set<string>();
      const plan: { id?: string; ref: string; data: ReturnType<typeof unitData> }[] = [];
      r.changes = [];
      read.units.forEach((u, i) => {
        const data = unitData(u, i);
        const cur = byKey.get(normalizeRef(u.ref, p.publicName));
        if (cur?.source === "manual") { touched.add(cur.id); return; }
        if (cur) {
          touched.add(cur.id);
          const diff = SHOWN.filter((k) => String((cur as any)[k] ?? "") !== String((data as any)[k] ?? ""));
          if (diff.length) r.changes!.push(`${u.ref}: ${diff.map((k) => `${k} ${(cur as any)[k] ?? "—"}→${(data as any)[k] ?? "—"}`).join(", ")}`);
        } else {
          r.changes!.push(`${u.ref}: new (${data.type ?? "?"}, ${data.beds ?? "?"} bd, ${data.status}${data.price ? ` €${data.price.toLocaleString("en")}` : ""})`);
        }
        plan.push({ id: cur?.id, ref: u.ref, data });
      });
      const vanished = existing.filter((u) => u.source !== "manual" && !touched.has(u.id) && u.status !== "sold" && u.status !== "unlisted");
      for (const v of vanished) r.changes.push(`${v.feedRef || v.ref}: no longer in the list → unlisted`);

      const avail = read.units.filter((u) => u.status === "available");
      const prices = avail.map((u) => u.price).filter((x): x is number => typeof x === "number");
      r.units = read.units.length;
      r.available = avail.length;

      if (opts.dryRun) { r.outcome = "dry-run"; continue; }

      for (const x of plan) {
        if (x.id) await prisma.developmentUnit.update({ where: { id: x.id }, data: x.data });
        else await prisma.developmentUnit.create({ data: { developmentId: p.id, ref: x.ref, ...x.data } });
      }
      if (vanished.length) await prisma.developmentUnit.updateMany({ where: { id: { in: vanished.map((v) => v.id) } }, data: { status: "unlisted" } });
      await prisma.development.update({
        where: { id: p.id },
        data: {
          unitsTotal: read.units.length, unitsAvailable: avail.length,
          priceFrom: prices.length ? Math.min(...prices) : null,
          priceTo: prices.length ? Math.max(...prices) : null,
          syncedAt: new Date(),
        },
      });
      await recomputeDevelopmentDerivedState(p.id);
      r.outcome = "written";
      nextSigs.push(sig);
    }

    if (!opts.dryRun) {
      // A project limited run (onlyDevelopmentId) must not forget the others' signatures.
      const keep = opts.onlyDevelopmentId ? Array.from(prevSigs).filter((s) => !s.startsWith(`${opts.onlyDevelopmentId}:`)) : [];
      await prisma.developerAccount.update({
        where: { id: developerAccountId },
        data: { driveFileModified: Array.from(new Set([...keep, ...nextSigs])).sort().join("|") || null, driveSyncedAt: new Date() },
      });
    }
  } finally {
    release();
  }

  const refused = results.filter((r) => r.outcome === "refused");
  const written = results.filter((r) => r.outcome === "written");
  const unchanged = results.filter((r) => r.outcome === "unchanged");
  const message = opts.dryRun
    ? `dry run: ${results.length} project(s) read, ${refused.length} refused`
    : `${written.length} written, ${unchanged.length} unchanged, ${refused.length} refused${refused.length ? ` (${refused.map((r) => `${r.project}: ${r.issues[r.issues.length - 1] ?? "?"}`).join("; ")})` : ""}`;
  // A refused project fails the run: an unread price list behind a published
  // page is exactly what cron-health and the failure streak exist to surface.
  return { ok: refused.length === 0, message, projects: results };
}
